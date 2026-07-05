import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { runDnsScan, calculateScore, createRecommendations } from '@/lib/dns';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export const placementQueue = new Queue('placement-tests', { connection });

export async function bootstrapSeedInboxes() {
  const existing = await prisma.seedInbox.count();
  if (existing > 0) return;

  await prisma.seedInbox.createMany({
    data: [
      { provider: 'gmail', emailAddress: 'inboxai.seed.1@gmail.com', credentialsRef: 'GMAIL_SEED_1', isActive: true },
      { provider: 'gmail', emailAddress: 'inboxai.seed.2@gmail.com', credentialsRef: 'GMAIL_SEED_2', isActive: true },
      { provider: 'outlook', emailAddress: 'inboxai.seed.1@outlook.com', credentialsRef: 'OUTLOOK_SEED_1', isActive: true },
      { provider: 'outlook', emailAddress: 'inboxai.seed.2@outlook.com', credentialsRef: 'OUTLOOK_SEED_2', isActive: true },
    ],
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

  await placementQueue.add('send-seed-test', { workspaceId, domainId, mailboxId, batchId, seedInboxIds: activeSeedInboxes.map((seedInbox) => seedInbox.id) });

  return { blocked: false, batchId };
}

export async function processPlacementJob(job: { data: { workspaceId: string; domainId: string; mailboxId: string; batchId: string; seedInboxIds: string[] } }) {
  const { workspaceId, domainId, mailboxId, batchId, seedInboxIds } = job.data;
  const tests = await prisma.placementTest.findMany({ where: { testBatchId: batchId } });
  const results = ['inbox', 'promotions', 'spam', 'missing'];

  for (const test of tests) {
    const result = results[Math.floor(Math.random() * results.length)];
    await prisma.placementTest.update({
      where: { id: test.id },
      data: { result, resultDetectedAt: new Date(), folderRaw: result },
    });
  }

  const latestChecks = await prisma.dnsScanCheck.findMany({ where: { dnsScanId: (await prisma.dnsScan.findFirst({ where: { domainId, workspaceId }, orderBy: { startedAt: 'desc' } }))?.id ?? '' } });
  const score = calculateScore(latestChecks);
  await prisma.scoreHistory.create({
    data: {
      workspaceId,
      domainId,
      scoreVersion: 'v2',
      totalScore: score.totalScore,
      scoreBreakdown: { ...score.scoreBreakdown, placementPerformance: 100 },
      rawSignals: score.rawSignals,
    },
  });
  await createRecommendations({ workspaceId, domainId, checks: latestChecks });
}
