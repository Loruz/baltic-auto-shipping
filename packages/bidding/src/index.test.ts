import { bidStatus } from "@bas/db/schema";
import { expect, it } from "vitest";
import { isActiveBid } from "./index.ts";

it("treats only open bids as active", () => {
  const active = bidStatus.enumValues.filter(isActiveBid);
  expect(active).toEqual(["pending", "locked", "placed", "won_pending_approval"]);
});
