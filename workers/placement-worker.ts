import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processPlacementJob } from '@/lib/placement';
import { runDnsScan } from '@/lib/dns';
import { startScheduler } from '@/lib/scheduler';
import { ENV } from '@/lib/env';

const redisUrl = ENV.redisUrl;

export function startPlacementWorker() {
  try {
    return new Worker('placement-tests', async (job) => {
      if (job.name === 'dns-scan-scheduled') {
        await runDnsScan({ workspaceId: job.data.workspaceId, domainId: job.data.domainId });
        return;
      }

      if (job.name === 'placement-test-scheduled') {
        await import('@/lib/placement').then(({ queuePlacementTest }) => queuePlacementTest({ workspaceId: job.data.workspaceId, domainId: job.data.domainId, mailboxId: job.data.mailboxId }));
        return;
      }

      await processPlacementJob(job as any);
    }, { connection: new IORedis(redisUrl) as any });
  } catch (error) {
    console.warn('Placement worker could not start.', error);
    return null;
  }
}

startPlacementWorker();
void startScheduler();
