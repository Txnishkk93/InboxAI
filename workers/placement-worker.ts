import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processPlacementJob } from '@/lib/placement';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

new Worker('placement-tests', async (job) => {
  await processPlacementJob(job as any);
}, { connection });
