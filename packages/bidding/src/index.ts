/**
 * Bidding (plan §4.3, §4.4). Statuses come from the database enum so code and schema cannot drift.
 * Transactions (placeBid / raiseBid / cancelBid / takeover) arrive in M6.
 */
import type { bidStatus } from "@bas/db/schema";

export type BidStatus = (typeof bidStatus.enumValues)[number];

/** Statuses in which a bid still holds reserved buying power. */
export const ACTIVE_BID_STATUSES = [
  "pending",
  "locked",
  "placed",
  "won_pending_approval",
] as const satisfies readonly BidStatus[];

export function isActiveBid(status: BidStatus): boolean {
  return (ACTIVE_BID_STATUSES as readonly BidStatus[]).includes(status);
}

/** Default cutoff before the auction session (B12); overridable by `bidding.cutoff_minutes`. */
export const DEFAULT_CUTOFF_MINUTES = 60;
