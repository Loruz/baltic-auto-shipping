/**
 * Payments boundary (plan §4.2, §4.5). Stripe and the fake provider both emit the same
 * normalised events, so deposit ↔ buying-power logic is written once (§6 "Payments").
 */
import type { paymentMethod } from "@bas/db/schema";

export type PaymentMethod = (typeof paymentMethod.enumValues)[number];

export type PaymentEvent =
  | { type: "deposit.paid"; depositId: number; paymentObjectId: string; method: PaymentMethod }
  | { type: "deposit.awaiting_transfer"; depositId: number }
  | { type: "deposit.failed"; depositId: number }
  | { type: "deposit.canceled"; depositId: number }
  | {
      type: "refund.succeeded";
      refundObjectId: string;
      paymentObjectId: string;
      amountEurCents: number;
    }
  | {
      type: "dispute.opened";
      disputeObjectId: string;
      paymentObjectId: string;
      amountEurCents: number;
    }
  | { type: "dispute.closed"; disputeObjectId: string; won: boolean };

export interface CheckoutRequest {
  depositId: number;
  amountEurCents: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<{ url: string }>;
  refund(
    paymentObjectId: string,
    amountEurCents: number,
    idempotencyKey: string,
  ): Promise<{ refundObjectId: string }>;
}

export const PAYMENT_PROVIDERS = ["stripe", "fake"] as const;
