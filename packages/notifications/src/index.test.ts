import { expect, it } from "vitest";
import { RETRY_DELAYS_MS, TEMPLATES } from "./index.ts";

it("retries 5 times with growing delays", () => {
  expect(RETRY_DELAYS_MS).toHaveLength(5);
  expect([...RETRY_DELAYS_MS].sort((a, b) => a - b)).toEqual([...RETRY_DELAYS_MS]);
});

it("has unique template keys", () => {
  expect(new Set(TEMPLATES).size).toBe(TEMPLATES.length);
});
