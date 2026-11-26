/**
 * ID-check boundary (plan §4.2, B13). Ondato and the fake provider write the same
 * `kyc_checks` rows through the same webhook path.
 */
import type { kycStatus } from "@bas/db/schema";

export type KycStatus = (typeof kycStatus.enumValues)[number];

export interface KycSession {
  providerSessionId: string;
  redirectUrl: string;
}

export interface KycWebhookResult {
  providerSessionId: string;
  status: KycStatus;
}

export interface KycProvider {
  startSession(userId: string, returnUrl: string): Promise<KycSession>;
  /** Verifies the signature and normalises the payload; throws on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<KycWebhookResult>;
}

export const KYC_PROVIDERS = ["ondato", "fake"] as const;
