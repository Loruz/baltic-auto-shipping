import { expect, it } from "vitest";
import { PROCESSOR_NAMES } from "./processors.ts";
import { QUEUES, SCHEDULES } from "./queues.ts";

it("every scheduled job has a processor and a known queue", () => {
  for (const s of SCHEDULES) {
    expect(PROCESSOR_NAMES).toContain(s.job);
    expect(Object.keys(QUEUES)).toContain(s.queue);
    expect(Boolean(s.everyMs) !== Boolean(s.cron)).toBe(true);
  }
});
