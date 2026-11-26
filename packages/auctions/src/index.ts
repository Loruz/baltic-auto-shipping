/**
 * Lot data provider boundary (plan §4.1). The apibara adapter (M3) and the fixtures adapter
 * (replays docs/phase-0/trial-results/) both implement `LotDataProvider`, selected by LOT_PROVIDER.
 * Field-level shapes are filled in from the Phase 0 trial in M3.
 */
import type { auctionSource } from "@bas/db/schema";

export type AuctionSource = (typeof auctionSource.enumValues)[number];

export interface ProviderLotRef {
  source: AuctionSource;
  externalLotId: string;
}

export interface ProviderLot extends ProviderLotRef {
  vin: string | null;
  /** Start of the auction session (UTC), not the moment the lot comes up. Null when unscheduled. */
  saleAt: Date | null;
  imageUrls: string[];
  /** The untouched provider record, stored in `lot_raw`. */
  raw: unknown;
}

export interface ProviderSaleResult extends ProviderLotRef {
  outcome: string;
  finalPriceUsdCents: number | null;
  soldAt: Date | null;
}

/** One platform plus one sale day, or that platform's undated lots (§4.1 `sync.refresh`). */
export type LotSlice =
  { source: AuctionSource; saleDay: string } | { source: AuctionSource; undated: true };

export interface LotDataProvider {
  listChanges(
    cursor: string | null,
  ): Promise<{ lots: ProviderLot[]; removed: ProviderLotRef[]; cursor: string }>;
  listSlice(
    slice: LotSlice,
    cursor: string | null,
  ): Promise<{ lots: ProviderLot[]; cursor: string | null }>;
  getLot(ref: ProviderLotRef): Promise<ProviderLot | null>;
  getSaleResults(since: Date): Promise<ProviderSaleResult[]>;
}

export const LOT_PROVIDERS = ["apibara", "fixtures"] as const;
export type LotProviderName = (typeof LOT_PROVIDERS)[number];
