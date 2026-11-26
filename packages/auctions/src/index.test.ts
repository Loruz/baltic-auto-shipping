import { expect, it } from "vitest";
import { LOT_PROVIDERS } from "./index.ts";

it("lists the provider adapters selectable by LOT_PROVIDER", () => {
  expect(LOT_PROVIDERS).toEqual(["apibara", "fixtures"]);
});
