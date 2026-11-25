import { expect, it } from "vitest";
import { KYC_PROVIDERS } from "./index.ts";

it("lists the KYC providers selectable by KYC_PROVIDER", () => {
  expect(KYC_PROVIDERS).toEqual(["ondato", "fake"]);
});
