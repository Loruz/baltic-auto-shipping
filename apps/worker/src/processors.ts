import type { Job } from "bullmq";
import type { Logger } from "pino";
import type { QueueName } from "./queues.ts";

export interface JobContext {
  log: Logger;
  heartbeatUrl: string | undefined;
}

type Processor = (job: Job, ctx: JobContext) => Promise<void>;

const processors: Record<string, Processor> = {
  async heartbeat(_job, { log, heartbeatUrl }) {
    // Better Stack heartbeat (§7.2 "Worker down"); off locally when the URL is empty.
    if (heartbeatUrl) await fetch(heartbeatUrl, { method: "POST" });
    log.debug("heartbeat");
  },
};

export function processorFor(queue: QueueName, ctx: JobContext) {
  return async (job: Job) => {
    const processor = processors[job.name];
    if (!processor) throw new Error(`No processor for job "${job.name}" on queue "${queue}"`);
    await processor(job, ctx);
  };
}

export const PROCESSOR_NAMES = Object.keys(processors);
