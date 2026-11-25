/**
 * Catalogue search on Postgres (plan §3, B7, A2): filters → SQL and facet counts. Built in M4.
 */
import type { auctionSource } from "@bas/db/schema";

export interface LotSearchFilters {
  query?: string;
  source?: (typeof auctionSource.enumValues)[number];
  make?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  page?: number;
}

export const DEFAULT_PAGE_SIZE = 24;
