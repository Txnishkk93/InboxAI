import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { runDnsScan } from '@/lib/dns';
import { bootstrapSeedInboxes, queuePlacementTest } from '@/lib/placement';

import { ENV } from '@/lib/env';

const redisUrl = ENV.redisUrl;
let schedulerStarted = false;
let fallbackTimer: NodeJS.Timeout | null = null;
let queueWarningShown = false;

function getQueue() {
  try {
    return new Queue('placement-tests', { connection: new IORedis(redisUrl) as any });
  } catch (error) {
    if (!queueWarningShown) {
      queueWarningShown = true;
      console.warn('Redis unavailable for scheduled jobs; using fallback scheduler.', error);
    }
    return null;
  }
}

async function scheduleDomainJobs(domain: { id: string; workspaceId: string }) {
  const queue = getQueue();
  const mailboxes = await prisma.mailbox.findMany({ where: { workspaceId: domain.workspaceId, domainId: domain.id, deletedAt: null }, take: 1, orderBy: { createdAt: 'desc' } });

  if (queue) {
    await queue.add('dns-scan-scheduled', { workspaceId: domain.workspaceId, domainId: domain.id }, { repeat: { pattern: '0 0 * * *' }, jobId: `dns-schedule-${domain.id}` });
    if (mailboxes[0]) {
      await queue.add('placement-test-scheduled', { workspaceId: domain.workspaceId, domainId: domain.id, mailboxId: mailboxes[0].id }, { repeat: { pattern: '0 6 */3 * *' }, jobId: `placement-schedule-${domain.id}` });
    }
    return;
  }

  const lastDnsScan = await prisma.dnsScan.findFirst({ where: { workspaceId: domain.workspaceId, domainId: domain.id }, orderBy: { startedAt: 'desc' } });
  const now = Date.now();
  if (!lastDnsScan || now - new Date(lastDnsScan.startedAt).getTime() > 24 * 60 * 60 * 1000) {
    void runDnsScan({ workspaceId: domain.workspaceId, domainId: domain.id });
  }

  if (mailboxes[0]) {
    const lastPlacement = await prisma.placementTest.findFirst({ where: { workspaceId: domain.workspaceId, domainId: domain.id }, orderBy: { sentAt: 'desc' } });
    if (!lastPlacement || now - new Date(lastPlacement.sentAt).getTime() > 72 * 60 * 60 * 1000) {
      void queuePlacementTest({ workspaceId: domain.workspaceId, domainId: domain.id, mailboxId: mailboxes[0].id });
    }
  }
}

export async function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  await bootstrapSeedInboxes();

  const domains = await prisma.domain.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  await Promise.all(domains.map((domain) => scheduleDomainJobs(domain)));

  if (!getQueue() && !fallbackTimer) {
    fallbackTimer = setInterval(() => {
      void prisma.domain.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } }).then((items) => Promise.all(items.map((domain) => scheduleDomainJobs(domain))));
    }, 60 * 60 * 1000);
  }
}
