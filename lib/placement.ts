import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { calculateScore, createRecommendations } from '@/lib/dns';
import { ENV, resolveSeedCredentialsRef, warnIfSeedCredentialsMissing } from '@/lib/env';
import { SeedInboxProvider, PlacementResult } from '@prisma/client';
import { Resend } from 'resend';

const redisUrl = ENV.redisUrl;

let placementQueue: Queue | null = null;
let queueWarningShown = false;

const CLASSIFY_INITIAL_DELAY_MS = 3 * 60 * 1000; // 3 minutes
const CLASSIFY_BACKOFFS = [5 * 60 * 1000, 10 * 60 * 1000, 15 * 60 * 1000]; // 5 min, 10 min, 15 min delays

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

async function sendTestEmails(tests: any[], seedInboxes: any[]) {
  const resend = new Resend(ENV.resendApiKey);

  for (const test of tests) {
    const seed = seedInboxes.find((s) => s.provider === test.provider);
    if (!seed) continue;

    try {
      console.log(`Sending test email from ${test.mailboxId} to seed ${seed.emailAddress} with subject fingerprint ${test.subjectFingerprint}`);
      await resend.emails.send({
        from: 'InboxAI Test <test@inboxai.app>',
        to: seed.emailAddress,
        subject: `InboxAI Placement Test [Fingerprint: ${test.subjectFingerprint}]`,
        text: `This is a deliverability test from InboxAI.\nFingerprint: ${test.bodyFingerprint}`,
      });
    } catch (error) {
      console.warn(`Failed to send test email to ${seed.emailAddress}. This is expected in development sandbox mode.`, error);
    }
  }
}

export async function processPlacementJob(job: { data: { workspaceId: string; domainId: string; mailboxId: string; batchId: string; seedInboxIds: string[] } }) {
  const { workspaceId, domainId, mailboxId, batchId, seedInboxIds } = job.data;
  const tests = await prisma.placementTest.findMany({ where: { testBatchId: batchId } });
  const seedInboxes = await prisma.seedInbox.findMany({ where: { id: { in: seedInboxIds } } });

  // Send the test emails
  await sendTestEmails(tests, seedInboxes);

  // Enqueue initial classification job after delay
  const queue = getPlacementQueue();
  if (queue) {
    await queue.add('classify-seed-test', { workspaceId, domainId, batchId, attempt: 1 }, { delay: CLASSIFY_INITIAL_DELAY_MS });
  } else {
    setTimeout(() => {
      void processClassificationJob({ data: { workspaceId, domainId, batchId, attempt: 1 } } as any);
    }, CLASSIFY_INITIAL_DELAY_MS);
  }
}

async function getGmailAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to refresh Gmail access token');
  }
  const data = await response.json();
  return data.access_token as string;
}

async function getOutlookAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default',
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to refresh Outlook access token');
  }
  const data = await response.json();
  return data.access_token as string;
}

async function classifyGmailPlacement(subjectFingerprint: string, clientId: string, clientSecret: string, refreshToken: string) {
  const accessToken = await getGmailAccessToken(clientId, clientSecret, refreshToken);

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(subjectFingerprint)}&includeSpamTrash=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    return null; // Not found yet
  }

  const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!detailRes.ok) {
    return null;
  }
  const detail = await detailRes.json();
  const labelIds: string[] = detail.labelIds || [];

  const folderRaw = labelIds.join(',');
  let result: PlacementResult = 'inbox';
  if (labelIds.includes('SPAM')) {
    result = 'spam';
  } else if (labelIds.includes('CATEGORY_PROMOTIONS')) {
    result = 'promotions';
  } else if (labelIds.includes('INBOX')) {
    result = 'inbox';
  }

  return { result, folderRaw };
}

async function classifyOutlookPlacement(subjectFingerprint: string, clientId: string, clientSecret: string, refreshToken: string) {
  const accessToken = await getOutlookAccessToken(clientId, clientSecret, refreshToken);

  const url = `https://graph.microsoft.com/v1.0/me/messages?$search="subject:${subjectFingerprint}"&$select=id,parentFolderId`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  const message = data.value?.[0];
  if (!message || !message.parentFolderId) {
    return null; // Not found yet
  }

  const folderUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${message.parentFolderId}`;
  const folderRes = await fetch(folderUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  let folderName = message.parentFolderId;
  if (folderRes.ok) {
    const folder = await folderRes.json();
    folderName = folder.displayName || message.parentFolderId;
  }

  const folderLower = folderName.toLowerCase();
  let result: PlacementResult = 'inbox';
  if (folderLower.includes('junk') || folderLower === 'junkemail') {
    result = 'spam';
  } else if (folderLower.includes('inbox') || folderLower === 'inbox') {
    result = 'inbox';
  }

  return { result, folderRaw: folderName };
}

async function classifyYahooPlacement() {
  console.log("Yahoo classification not yet implemented");
  return null;
}

async function classifyCustomDomainPlacement() {
  console.log("Custom domain classification not yet implemented");
  return null;
}

export async function processClassificationJob(job: { data: { workspaceId: string; domainId: string; batchId: string; attempt: number } }) {
  const { workspaceId, domainId, batchId, attempt } = job.data;

  // Prevent processing if batch is already finalized to ensure idempotency
  const isFinalizedKey = `finalized:${batchId}`;
  if ((global as any)[isFinalizedKey]) {
    return;
  }

  const tests = await prisma.placementTest.findMany({ where: { testBatchId: batchId } });
  const pendingTests = tests.filter((t) => t.result === 'pending');

  if (pendingTests.length === 0) {
    await finalizePlacementTestBatch({ workspaceId, domainId, batchId });
    return;
  }

  const activeSeeds = await prisma.seedInbox.findMany({ where: { isActive: true } });

  for (const test of pendingTests) {
    const seed = activeSeeds.find((s) => s.provider === test.provider);
    if (!seed) {
      await prisma.placementTest.update({
        where: { id: test.id },
        data: { result: 'missing', resultDetectedAt: new Date(), folderRaw: 'ERROR: Seed inbox inactive or missing' },
      });
      continue;
    }

    const credentials = resolveSeedCredentialsRef(seed.credentialsRef);
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      console.warn(`Credentials missing for seed ${seed.credentialsRef}`);
      await prisma.placementTest.update({
        where: { id: test.id },
        data: { result: 'missing', resultDetectedAt: new Date(), folderRaw: `ERROR: Credentials missing for ${seed.credentialsRef}` },
      });
      await prisma.seedInbox.update({
        where: { id: seed.id },
        data: { isActive: false },
      });
      continue;
    }

    try {
      let classification: { result: PlacementResult; folderRaw: string } | null = null;

      if (test.provider === 'gmail') {
        classification = await classifyGmailPlacement(test.subjectFingerprint, credentials.clientId, credentials.clientSecret, credentials.refreshToken);
      } else if (test.provider === 'outlook') {
        classification = await classifyOutlookPlacement(test.subjectFingerprint, credentials.clientId, credentials.clientSecret, credentials.refreshToken);
      } else if (test.provider === 'yahoo') {
        classification = await classifyYahooPlacement();
      } else if (test.provider === 'custom') {
        classification = await classifyCustomDomainPlacement();
      }

      if (classification) {
        await prisma.placementTest.update({
          where: { id: test.id },
          data: {
            result: classification.result,
            resultDetectedAt: new Date(),
            folderRaw: classification.folderRaw,
          },
        });
      }
    } catch (error) {
      console.error(`Auth/API Error during classification of ${seed.credentialsRef}:`, error);
      await prisma.placementTest.update({
        where: { id: test.id },
        data: { result: 'missing', resultDetectedAt: new Date(), folderRaw: `AUTH_ERROR: ${seed.credentialsRef}` },
      });
      await prisma.seedInbox.update({
        where: { id: seed.id },
        data: { isActive: false },
      });
    }
  }

  const updatedTests = await prisma.placementTest.findMany({ where: { testBatchId: batchId } });
  const stillPending = updatedTests.filter((t) => t.result === 'pending');

  if (stillPending.length > 0) {
    if (attempt < 4) {
      const nextDelay = CLASSIFY_BACKOFFS[attempt - 1];
      console.log(`Placement test batch ${batchId} still has pending seeds. Enqueuing attempt ${attempt + 1} with delay ${nextDelay / 1000}s.`);

      const queue = getPlacementQueue();
      if (queue) {
        await queue.add('classify-seed-test', { workspaceId, domainId, batchId, attempt: attempt + 1 }, { delay: nextDelay });
      } else {
        setTimeout(() => {
          void processClassificationJob({ data: { workspaceId, domainId, batchId, attempt: attempt + 1 } } as any);
        }, nextDelay);
      }
    } else {
      console.log(`Classification retries exhausted for batch ${batchId}. Marking remaining seeds as missing.`);
      for (const test of stillPending) {
        await prisma.placementTest.update({
          where: { id: test.id },
          data: { result: 'missing', resultDetectedAt: new Date(), folderRaw: 'TIMEOUT' },
        });
      }
      await finalizePlacementTestBatch({ workspaceId, domainId, batchId });
    }
  } else {
    await finalizePlacementTestBatch({ workspaceId, domainId, batchId });
  }
}

export async function finalizePlacementTestBatch({ workspaceId, domainId, batchId }: { workspaceId: string; domainId: string; batchId: string }) {
  const isFinalizedKey = `finalized:${batchId}`;
  if ((global as any)[isFinalizedKey]) {
    return;
  }
  (global as any)[isFinalizedKey] = true;

  console.log(`Finalizing placement test batch ${batchId}`);

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
