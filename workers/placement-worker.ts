import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processPlacementJob } from '@/lib/placement';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export function startPlacementWorker() {
  try {
    return new Worker('placement-tests', async (job) => {
      await processPlacementJob(job as any);
    }, { connection: new IORedis(redisUrl) });
  } catch (error) {
    console.warn('Placement worker could not start.', error);
    return null;
  }
}

startPlacementWorker();
