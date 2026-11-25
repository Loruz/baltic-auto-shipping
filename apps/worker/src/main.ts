import { parseServerEnv } from "@bas/config/env";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { processorFor } from "./processors.ts";
import { QUEUES, SCHEDULES, type QueueName } from "./queues.ts";

const env = parseServerEnv();
const log = pino({ level: env.APP_ENV === "development" ? "debug" : "info" });

// BullMQ workers need maxRetriesPerRequest: null on their blocking connection.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queueNames = Object.keys(QUEUES) as QueueName[];

const queues = Object.fromEntries(
  queueNames.map((name) => [name, new Queue(name, { connection })]),
) as Record<QueueName, Queue>;

for (const schedule of SCHEDULES) {
  await queues[schedule.queue].upsertJobScheduler(
    schedule.job,
    schedule.cron ? { pattern: schedule.cron, tz: schedule.tz } : { every: schedule.everyMs },
    { name: schedule.job },
  );
}

const ctx = { log, heartbeatUrl: env.BETTERSTACK_HEARTBEAT_URL };
const workers = queueNames.map((name) => {
  const worker = new Worker(name, processorFor(name, ctx), {
    connection,
    concurrency: QUEUES[name].concurrency,
  });
  worker.on("failed", (job, err) => log.error({ queue: name, job: job?.name, err }, "job failed"));
  return worker;
});

log.info(
  { appEnv: env.APP_ENV, queues: queueNames, schedules: SCHEDULES.length },
  "worker started",
);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "worker shutting down");
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(Object.values(queues).map((q) => q.close()));
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
