/**
 * Queues and job schedules (plan §4.7). Job names are the contract between producers (web, worker)
 * and processors; add a processor in ./processors when a milestone implements a job.
 */
export const QUEUES = {
  critical: { concurrency: 5 },
  sync: { concurrency: 1 },
  maintenance: { concurrency: 2 },
} as const;
export type QueueName = keyof typeof QUEUES;

export interface Schedule {
  queue: QueueName;
  job: string;
  everyMs?: number;
  /** Cron pattern, evaluated in `tz`. */
  cron?: string;
  tz?: string;
}

const MIN = 60_000;

/** Repeatable jobs. Only `heartbeat` has a processor yet; the rest are registered as milestones land. */
export const SCHEDULES: Schedule[] = [
  { queue: "maintenance", job: "heartbeat", everyMs: 1 * MIN },
  // M3: { queue: "sync", job: "sync.changes", everyMs: 15 * MIN }, sync.soon (1 min), sync.refresh (15 min), sync.results (15 min)
  // M6: { queue: "critical", job: "bids.cutoff", everyMs: 1 * MIN }, bids.overdue (15 min), outbox.send (10 s)
  // M9: { queue: "maintenance", job: "alerts.check", everyMs: 5 * MIN }
  // M5: { queue: "maintenance", job: "fx.fetch", cron: "30 16 * * *", tz: "Europe/Vilnius" }
];
