import { expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE } from "./index.ts";

it("has a page size", () => {
  expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
});
