/**
 * Outbox (plan §4.7, B8). Business code writes `notifications` rows; the `outbox.send` job sends them.
 */
import type { notificationChannel } from "@bas/db/schema";

export type NotificationChannel = (typeof notificationChannel.enumValues)[number];

export const TEMPLATES = [
  "broker.bid_new",
  "broker.bid_raised",
  "broker.bid_cancelled",
  "broker.session_digest",
  "broker.refund_requested",
  "broker.alert",
  "customer.outbid",
  "customer.bid_cancelled_lot_gone",
  "customer.sale_moved",
  "customer.won",
  "customer.lost",
  "customer.not_placed",
  "customer.deposit_succeeded",
  "customer.refund_done",
] as const;
export type TemplateKey = (typeof TEMPLATES)[number];

/** Delay before attempt n+1 after a failure: 1 min, 5 min, 30 min, 2 h, 6 h; then `failed`. */
export const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000] as const;
