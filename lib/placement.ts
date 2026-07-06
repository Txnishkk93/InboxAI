import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { calculateScore, createRecommendations } from '@/lib/dns';
import { ENV, resolveSeedCredentialsRef, warnIfSeedCredentialsMissing } from '@/lib/env';
import { SeedInboxProvider, PlacementResult } from '@prisma/client';

const redisUrl = ENV.redisUrl;

let placementQueue: Queue | null = null;
let queueWarningShown = false;

function getPlacementQueue() {
  if (placementQueue) return placementQueue;

  try {
    placementQueue = new Queue('placement-tests', { connection: new IORedis(redisUrl) as any });
    return placementQueue;
  } catch (error) {
    if (!queueWarningShown) {
      queueWarningShown = true;
      console.warn('Redis unavailable; placement jobs will run inline.', error);
    }
    return null;
  }
}

export async function bootstrapSeedInboxes() {
  const existing = await prisma.seedInbox.count();
  if (existing > 0) return;

  const seedDefinitions = [
    { provider: 'gmail' as SeedInboxProvider, emailAddress: 'inboxai.seed.1@gmail.com', credentialsRef: 'GMAIL_SEED_1', isActive: true },
    { provider: 'gmail' as SeedInboxProvider, emailAddress: 'inboxai.seed.2@gmail.com', credentialsRef: 'GMAIL_SEED_2', isActive: true },
    { provider: 'outlook' as SeedInboxProvider, emailAddress: 'inboxai.seed.1@outlook.com', credentialsRef: 'OUTLOOK_SEED_1', isActive: true },
    { provider: 'outlook' as SeedInboxProvider, emailAddress: 'inboxai.seed.2@outlook.com', credentialsRef: 'OUTLOOK_SEED_2', isActive: true },
    { provider: 'yahoo' as SeedInboxProvider, emailAddress: 'inboxai.seed.1@yahoo.com', credentialsRef: 'YAHOO_SEED_1', isActive: true },
    { provider: 'custom' as SeedInboxProvider, emailAddress: 'inboxai.seed.1@custom.dev', credentialsRef: 'CUSTOM_SEED_1', isActive: true },
  ];

  seedDefinitions.forEach((seed) => warnIfSeedCredentialsMissing(seed.credentialsRef));

  await prisma.seedInbox.createMany({
    data: seedDefinitions,
  });
}

export async function queuePlacementTest({ workspaceId, domainId, mailboxId }: { workspaceId: string; domainId: string; mailboxId: string }) {
  const pending = await prisma.placementTest.findFirst({ where: { domainId, result: 'pending' } });
  if (pending) return { blocked: true, existingBatchId: pending.testBatchId };

  const batchId = `batch-${Date.now()}`;
  const activeSeedInboxes = await prisma.seedInbox.findMany({ where: { isActive: true } });

  await Promise.all(activeSeedInboxes.map((seedInbox) => prisma.placementTest.create({
    data: {
      workspaceId,
      domainId,
      mailboxId,
      testBatchId: batchId,
      provider: seedInbox.provider,
      subjectFingerprint: `${domainId}-${seedInbox.id}`,
      bodyFingerprint: `${mailboxId}-${seedInbox.id}`,
      result: 'pending',
      folderRaw: 'pending',
    },
  })));

  const queue = getPlacementQueue();
  if (queue) {
    await queue.add('send-seed-test', { workspaceId, domainId, mailboxId, batchId, seedInboxIds: activeSeedInboxes.map((seedInbox) => seedInbox.id) });
    return { blocked: false, batchId, queued: true };
  }

  setTimeout(() => {
    void processPlacementJob({ data: { workspaceId, domainId, mailboxId, batchId, seedInboxIds: activeSeedInboxes.map((seedInbox) => seedInbox.id) } });
  }, 100);

  return { blocked: false, batchId, queued: false };
}

export async function processPlacementJob(job: { data: { workspaceId: string; domainId: string; mailboxId: string; batchId: string; seedInboxIds: string[] } }) {
  const { workspaceId, domainId, batchId } = job.data;
  const tests = await prisma.placementTest.findMany({ where: { testBatchId: batchId } });
  const results: PlacementResult[] = ['inbox', 'promotions', 'spam', 'missing'];

  for (const test of tests) {
    const result = results[Math.floor(Math.random() * results.length)];
    await prisma.placementTest.update({
      where: { id: test.id },
      data: { result, resultDetectedAt: new Date(), folderRaw: result },
    });
  }

  const latestDnsScan = await prisma.dnsScan.findFirst({ where: { domainId, workspaceId }, orderBy: { startedAt: 'desc' } });
  const latestChecks = latestDnsScan ? await prisma.dnsScanCheck.findMany({ where: { dnsScanId: latestDnsScan.id } }) : [];
  const placementTests = await prisma.placementTest.findMany({ where: { workspaceId, domainId, result: { not: 'pending' } }, orderBy: { sentAt: 'desc' }, take: 6 });
  const previousBatch = await prisma.placementTest.findFirst({ where: { workspaceId, domainId, testBatchId: { not: batchId } }, orderBy: { sentAt: 'desc' } });
  const previousBatchTests = previousBatch ? await prisma.placementTest.findMany({ where: { workspaceId, domainId, testBatchId: previousBatch.testBatchId }, orderBy: { sentAt: 'desc' } }) : [];
  const previousScoreRecord = await prisma.scoreHistory.findFirst({ where: { workspaceId, domainId }, orderBy: { calculatedAt: 'desc' } });
  const score = calculateScore(latestChecks, placementTests);
  await prisma.scoreHistory.create({
    data: {
      workspaceId,
      domainId,
      scoreVersion: 'v2',
      totalScore: score.totalScore,
      scoreBreakdown: score.scoreBreakdown,
      rawSignals: score.rawSignals,
    },
  });
  await createRecommendations({ workspaceId, domainId, checks: latestChecks, placementTests });
  await import('@/lib/alerts').then(({ evaluateScoreDrop, evaluatePlacementDrop }) => Promise.all([
    evaluateScoreDrop({ workspaceId, domainId, currentScore: score.totalScore, previousScore: previousScoreRecord?.totalScore ?? null }),
    evaluatePlacementDrop({ workspaceId, domainId, currentBatchTests: placementTests.map((test) => ({ provider: test.provider, result: test.result })), previousBatchTests: previousBatchTests.map((test) => ({ provider: test.provider, result: test.result })) }),
  ]));
}
