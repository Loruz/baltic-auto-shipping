/**
 * Landed-cost calculator (plan §4.6, B9): one pure function over a versioned rate card.
 * Implemented in M5 and checked against real broker invoices (§7.1).
 */

export interface LandedCostInput {
  source: "copart" | "iaai";
  bidUsdCents: number;
  yardCode: string;
  exportPortCode?: string;
}

export interface LandedCostLine {
  key: string;
  amountCents: number;
  currency: "USD" | "EUR";
}

export interface LandedCostResult {
  lines: LandedCostLine[];
  totalEurCents: number | null;
  /** Lines whose rate is missing show "price on request" (D4). */
  missing: string[];
}

export function calculateLandedCost(_input: LandedCostInput): LandedCostResult {
  throw new Error("calculateLandedCost: not implemented (M5)");
}
