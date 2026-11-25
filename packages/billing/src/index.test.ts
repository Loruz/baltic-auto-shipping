import { expect, it } from "vitest";
import { PAYMENT_PROVIDERS } from "./index.ts";

it("lists the payment providers selectable by PAYMENT_PROVIDER", () => {
  expect(PAYMENT_PROVIDERS).toEqual(["stripe", "fake"]);
});
