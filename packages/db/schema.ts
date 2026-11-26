/**
 * Car auction platform — PostgreSQL schema (Drizzle ORM), DRAFT v2.2 (2026-11-21)
 *
 * Scope follows the decision log in ../IMPLEMENTATION-PLAN.md:
 *  - Assisted bidding: customers set a max bid, the broker places it manually.
 *  - Plan = refundable deposit → buying power. Stripe card + bank transfer.
 *  - Nothing after a win lives on the platform (no orders/shipping/invoices).
 *  - Own copy of every lot (active + sold) synced from the data provider (apibara).
 *  - B14: buying power, bids and plan limits are USD. Deposits are charged in EUR at a
 *    fixed price per plan version (no exchange rate in any bid check). Other EUR:
 *    the landed-cost calculator (quotes, fixed fees in EUR, fx_rates).
 *
 * v2 changes (review 2026-11-21): USD-only money columns (`*_usd_cents`, currency
 * columns removed); no stored landed price on lots (A2); `lots.export_status_override`;
 * missing foreign keys added; admin idempotency key on deposit_transactions;
 * `deposits.refund_requested_at`. v2.1: B15 image columns (removed in v2.2).
 * v2.2: deposits charged in EUR (B14 revised): `plan_versions.deposit_eur_cents`,
 * `deposits.amount_eur_cents`, `deposit_transactions.amount_eur_cents`; `lots.stored_images` / `images_stored_at` removed (B15: links only).
 *
 * Conventions
 *  - Money: integer cents in bigint columns. Column name says the currency
 *    (`_usd_cents`, `_eur_cents`); generic `amount_cents` exists only where a
 *    `currency` column sits next to it. Never floats.
 *  - Timestamps: timestamptz, stored in UTC.
 *  - Auth tables follow Better Auth's Drizzle schema (core + admin + twoFactor
 *    plugins). Configure the admin plugin with `defaultRole: "customer"` and
 *    `adminRoles: ["admin"]`. At Milestone 1 regenerate them with
 *    `npx @better-auth/cli generate`: the CLI output wins for auth tables, but keep
 *    `user_role_chk` and the `customer` default.
 *  - Domain tables use bigint identity PKs; auth tables use text PKs (Better Auth).
 */
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();
const cents = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ───────────────────────────── Enums ───────────────────────────── */

export const auctionSource = pgEnum("auction_source", ["copart", "iaai"]);
export const lotStatus = pgEnum("lot_status", [
  "upcoming",
  "live",
  "sold",
  "on_approval",
  "not_sold",
  "removed",
  "unknown", // provider value not mapped yet — raw value kept in lot_raw, sync alerts
]);
/** Document legend: can the car be exported / registered in the EU. */
export const exportStatus = pgEnum("export_status", [
  "green", // export OK + EU registration possible
  "red", // export OK, registration impossible
  "black", // no export
  "double_red", // extra title processing ($200–800)
  "unknown",
]);
export const odometerBrand = pgEnum("odometer_brand", [
  "actual",
  "exempt",
  "not_actual",
  "exceeds_mechanical",
  "unknown",
]);
export const vehicleType = pgEnum("vehicle_type", ["car", "motorcycle", "truck", "atv", "other"]);
export const saleOutcome = pgEnum("sale_outcome", [
  "sold",
  "on_approval",
  "not_sold",
  "cancelled",
  "unknown",
]);
export const syncStatus = pgEnum("sync_status", ["running", "succeeded", "failed"]);

export const customerType = pgEnum("customer_type", ["individual", "company"]);
export const kycProvider = pgEnum("kyc_provider", ["ondato", "veriff"]);
export const kycStatus = pgEnum("kyc_status", [
  "created",
  "pending",
  "approved",
  "declined",
  "resubmission_requested",
  "expired",
  "abandoned",
]);

export const paymentMethod = pgEnum("payment_method", ["card", "bank_transfer"]);
export const depositStatus = pgEnum("deposit_status", [
  "pending", // checkout started / bank transfer awaited
  "succeeded", // money confirmed by webhook → buying power granted
  "failed",
  "canceled",
  "closed", // nothing left: fully refunded / forfeited / applied
]);
export const depositTxKind = pgEnum("deposit_tx_kind", [
  "payment",
  "refund",
  "forfeit", // kept to cover auction penalty (admin panel only — no Stripe event)
  "apply_to_purchase", // credited toward a car price (admin panel only)
  "dispute_opened",
  "dispute_won",
  "dispute_lost",
]);
export const txOrigin = pgEnum("tx_origin", ["platform", "stripe_dashboard", "system"]);
export const buyingPowerEntryKind = pgEnum("buying_power_entry_kind", [
  // Effect on buying_power_accounts totals (see plan §4.5 "Ledger rules"):
  "grant", // +granted  (deposit succeeded, dispute won)
  "revoke", // −granted  (refund / dispute / forfeit / apply; capped at current granted)
  "reserve", // +reserved (bid placed or raised)
  "release", // −reserved (bid cancelled / outbid / lost / not placed; unused part of a win)
  "consume", // −reserved +consumed (bid won)
  "restore", // −consumed (car paid, or forfeited/applied — the car is closed either way)
  "adjust_up", // +granted  (staff correction, reason required)
  "adjust_down", // −granted (staff correction, reason required; capped at current granted)
]);

export const bidStatus = pgEnum("bid_status", [
  "pending", // accepted, can be raised/cancelled until cutoff
  "locked", // cutoff passed, waiting for broker
  "placed", // broker entered it on Copart/IAAI
  "won_pending_approval", // On Approval / minimum bid — seller deciding
  "won",
  "lost",
  "not_placed", // broker couldn't place (lot gone, error) — power released
  "cancelled", // by customer before cutoff, or system (lot sold/removed)
  "outbid", // displaced internally by another customer's higher max bid
]);
export const bidPaymentStatus = pgEnum("bid_payment_status", [
  "not_required",
  "pending",
  "paid",
  "overdue",
  "forfeited",
]);
export const actorType = pgEnum("actor_type", [
  "customer",
  "operator",
  "admin",
  "system",
  "stripe",
]);

export const notificationChannel = pgEnum("notification_channel", ["email", "telegram"]);
export const notificationStatus = pgEnum("notification_status", [
  "queued",
  "sending",
  "sent",
  "failed",
]);

export const rateCardStatus = pgEnum("rate_card_status", ["draft", "active", "archived"]);
export const portKind = pgEnum("port_kind", ["us_export", "eu_import"]);
export const shippingMethod = pgEnum("shipping_method", ["container", "roro"]);

/* ─────────────────── Auth (Better Auth: core + admin + 2FA) ─────────────────── */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // admin plugin
    role: text("role").notNull().default("customer"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: ts("ban_expires"),
    // twoFactor plugin
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
  },
  (t) => [check("user_role_chk", sql`${t.role} in ('customer','operator','admin')`)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

/* ───────────────────────────── Customers ───────────────────────────── */

export const customerProfiles = pgTable("customer_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  type: customerType("type").notNull().default("individual"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  companyCode: text("company_code"),
  vatNumber: text("vat_number"),
  vatVerifiedAt: ts("vat_verified_at"), // VIES
  country: char("country", { length: 2 }),
  city: text("city"),
  address: text("address"),
  phone: text("phone"),
  phoneVerifiedAt: ts("phone_verified_at"),
  locale: text("locale").notNull().default("lt"),
  stripeCustomerId: text("stripe_customer_id").unique(), // needed for bank-transfer virtual IBAN
  /** Set by webhook when the latest KYC check is approved; cleared on decline/expiry. */
  kycApprovedAt: ts("kyc_approved_at"),
  /** Broker can block bidding (e.g. unpaid car) independently of auth bans. */
  biddingBlockedAt: ts("bidding_blocked_at"),
  biddingBlockedReason: text("bidding_blocked_reason"),
  brokerNotes: text("broker_notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One row per verification session at Ondato/Veriff. Documents stay at the provider. */
export const kycChecks = pgTable(
  "kyc_checks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: kycProvider("provider").notNull(),
    providerSessionId: text("provider_session_id").notNull(),
    status: kycStatus("status").notNull().default("created"),
    decisionReason: text("decision_reason"),
    decidedAt: ts("decided_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("kyc_provider_session_uq").on(t.provider, t.providerSessionId),
    index("kyc_user_idx").on(t.userId),
  ],
);

/* ───────────────────────────── Catalogue ───────────────────────────── */

export const yards = pgTable(
  "yards",
  {
    id: id(),
    source: auctionSource("source").notNull(),
    externalCode: text("external_code").notNull(), // vendor/auction yard id
    name: text("name").notNull(),
    city: text("city"),
    state: char("state", { length: 2 }),
    zip: text("zip"),
    country: char("country", { length: 2 }).notNull().default("US"),
    timezone: text("timezone"), // IANA, e.g. America/Chicago
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lon: numeric("lon", { precision: 9, scale: 6 }),
  },
  (t) => [uniqueIndex("yards_source_code_uq").on(t.source, t.externalCode)],
);

/** A physical car (by VIN). One vehicle can appear in many lots / relists / both auctions. */
export const vehicles = pgTable(
  "vehicles",
  {
    id: id(),
    vin: text("vin"), // nullable: some lots have no/partial VIN
    year: integer("year"),
    make: text("make"),
    model: text("model"),
    trim: text("trim"),
    bodyStyle: text("body_style"),
    vehicleType: vehicleType("vehicle_type").notNull().default("car"),
    engine: text("engine"),
    cylinders: integer("cylinders"), // null for EVs — don't show inapplicable fields
    fuel: text("fuel"),
    drive: text("drive"),
    transmission: text("transmission"),
    color: text("color"),
    /** NHTSA vPIC decode result + dataset version; never overwrites auction data blindly. */
    vinDecode: jsonb("vin_decode"),
    vinDecodedAt: ts("vin_decoded_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("vehicles_vin_uq")
      .on(t.vin)
      .where(sql`${t.vin} is not null`),
    index("vehicles_make_model_idx").on(t.make, t.model, t.year),
  ],
);

/**
 * Current state of one auction listing. Relist with the same lot number = same row,
 * new `lot_sales` row. Vendor data only — platform data (bids) never lives here.
 */
export const lots = pgTable(
  "lots",
  {
    id: id(),
    source: auctionSource("source").notNull(),
    externalLotId: text("external_lot_id").notNull(),
    vehicleId: bigint("vehicle_id", { mode: "number" })
      .notNull()
      .references(() => vehicles.id),
    yardId: bigint("yard_id", { mode: "number" }).references(() => yards.id),
    status: lotStatus("status").notNull().default("upcoming"),
    saleAt: ts("sale_at"), // UTC; show in yard tz + Europe/Vilnius
    // condition
    odometer: integer("odometer"),
    odometerUnit: text("odometer_unit").notNull().default("mi"),
    odometerBrand: odometerBrand("odometer_brand").notNull().default("unknown"),
    primaryDamage: text("primary_damage"),
    secondaryDamage: text("secondary_damage"),
    hasKeys: boolean("has_keys"),
    runCondition: text("run_condition"), // run_and_drive / starts / stationary (raw vendor value kept in lot_raw)
    // title / documents
    titleType: text("title_type"),
    titleState: char("title_state", { length: 2 }),
    saleDocument: text("sale_document"),
    exportStatus: exportStatus("export_status").notNull().default("unknown"),
    sellerType: text("seller_type"), // insurance / dealer / rental …
    sellerName: text("seller_name"),
    // auction prices (USD, vendor-reported, possibly stale)
    currentBidUsdCents: cents("current_bid_usd_cents"),
    buyNowUsdCents: cents("buy_now_usd_cents"),
    estRetailUsdCents: cents("est_retail_usd_cents"),
    onApproval: boolean("on_approval"), // seller must approve / minimum bid
    images: jsonb("images")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    hasVideo360: boolean("has_video_360").notNull().default(false),
    // No stored landed price (decision A2): it is computed on the lot page / calculator.
    // admin-owned columns (sync never writes these)
    /** Staff correction of the document legend; when set it wins over export_status. */
    exportStatusOverride: exportStatus("export_status_override"),
    // freshness / admin
    sourceUpdatedAt: ts("source_updated_at"), // vendor's own timestamp
    syncedAt: ts("synced_at").notNull().defaultNow(), // when we last wrote it
    hiddenAt: ts("hidden_at"), // admin hide
    reviewedAt: ts("reviewed_at"), // "reviewed lot" badge
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("lots_source_external_uq").on(t.source, t.externalLotId),
    index("lots_vehicle_idx").on(t.vehicleId),
    index("lots_status_sale_idx").on(t.status, t.saleAt),
    index("lots_synced_idx").on(t.syncedAt),
  ],
);

/** Original vendor payload, kept apart so `lots` stays narrow. Retention per licence. */
export const lotRaw = pgTable("lot_raw", {
  lotId: bigint("lot_id", { mode: "number" })
    .primaryKey()
    .references(() => lots.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'apibara'
  payload: jsonb("payload").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
});

/** One row per sale event of a lot — this is the sold-price archive. */
export const lotSales = pgTable(
  "lot_sales",
  {
    id: id(),
    lotId: bigint("lot_id", { mode: "number" })
      .notNull()
      .references(() => lots.id),
    saleAt: ts("sale_at").notNull(),
    outcome: saleOutcome("outcome").notNull(),
    finalBidUsdCents: cents("final_bid_usd_cents"),
    odometerAtSale: integer("odometer_at_sale"),
    recordedAt: ts("recorded_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lot_sales_lot_sale_uq").on(t.lotId, t.saleAt),
    index("lot_sales_sale_at_idx").on(t.saleAt),
  ],
);

/** Feed cursors + run history → freshness alerts ("no successful sync for 30 min"). */
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: id(),
    provider: text("provider").notNull(), // 'apibara'
    feed: text("feed").notNull(), // 'changes' | 'snapshot' | 'sold' | 'history_backfill'
    status: syncStatus("status").notNull().default("running"),
    cursorFrom: text("cursor_from"),
    cursorTo: text("cursor_to"),
    lotsUpserted: integer("lots_upserted").notNull().default(0),
    lotsRemoved: integer("lots_removed").notNull().default(0),
    requestsUsed: integer("requests_used").notNull().default(0), // apibara quota tracking
    error: text("error"),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("sync_runs_feed_started_idx").on(t.provider, t.feed, t.startedAt)],
);

/* ───────────────────────────── Plans & deposits ───────────────────────────── */

export const plans = pgTable("plans", {
  id: id(),
  code: text("code").notNull().unique(), // basic / pro / enterprise / custom-<x>
  name: text("name").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  /** Custom dealer plan visible only to this user. */
  assignedUserId: text("assigned_user_id").references(() => user.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/** Immutable terms; editing a plan = new version. Deposits/bids keep the version they used. */
export const planVersions = pgTable(
  "plan_versions",
  {
    id: id(),
    planId: bigint("plan_id", { mode: "number" })
      .notNull()
      .references(() => plans.id),
    version: integer("version").notNull(),
    depositEurCents: cents("deposit_eur_cents").notNull(),
    buyingPowerUsdCents: cents("buying_power_usd_cents").notNull(),
    maxActiveBids: integer("max_active_bids").notNull(),
    maxBidPerLotUsdCents: cents("max_bid_per_lot_usd_cents"), // null = no per-lot cap
    stripePriceId: text("stripe_price_id"),
    effectiveFrom: ts("effective_from").notNull().defaultNow(),
    effectiveTo: ts("effective_to"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("plan_versions_plan_version_uq").on(t.planId, t.version),
    check(
      "plan_versions_amounts_chk",
      sql`${t.depositEurCents} > 0 and ${t.buyingPowerUsdCents} > 0 and ${t.maxActiveBids} > 0`,
    ),
  ],
);

/** A deposit payment (initial purchase or upgrade difference). */
export const deposits = pgTable(
  "deposits",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    planVersionId: bigint("plan_version_id", { mode: "number" })
      .notNull()
      .references(() => planVersions.id),
    /** Upgrade: points at the deposit being topped up. */
    upgradesDepositId: bigint("upgrades_deposit_id", { mode: "number" }).references(
      (): AnyPgColumn => deposits.id,
    ),
    /** Charged amount (EUR, B14). For an upgrade: new plan deposit − old plan deposit. */
    amountEurCents: cents("amount_eur_cents").notNull(),
    /** Buying power this deposit grants (USD). For an upgrade: the difference in power. */
    grantsBuyingPowerUsdCents: cents("grants_buying_power_usd_cents").notNull(),
    status: depositStatus("status").notNull().default("pending"),
    paymentMethod: paymentMethod("payment_method"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    succeededAt: ts("succeeded_at"),
    /** Customer pressed "request refund" in the cabinet; staff act on it in /admin. */
    refundRequestedAt: ts("refund_requested_at"),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("deposits_user_idx").on(t.userId),
    check(
      "deposits_amount_chk",
      sql`${t.amountEurCents} > 0 and ${t.grantsBuyingPowerUsdCents} > 0`,
    ),
  ],
);

/**
 * Every money movement on a deposit, from either side of the Stripe sync.
 * Remaining deposit = payment − refund − forfeit − apply_to_purchase − dispute_lost
 *                     (dispute_opened temporarily removes it; dispute_won puts it back).
 * Dedupe: Stripe-originated rows by (stripe_object_id, kind); admin-only rows
 * (forfeit, apply_to_purchase) by idempotency_key.
 */
export const depositTransactions = pgTable(
  "deposit_transactions",
  {
    id: id(),
    depositId: bigint("deposit_id", { mode: "number" })
      .notNull()
      .references(() => deposits.id),
    kind: depositTxKind("kind").notNull(),
    origin: txOrigin("origin").notNull(),
    amountEurCents: cents("amount_eur_cents").notNull(), // always positive; kind gives direction
    stripeObjectId: text("stripe_object_id"), // re_… / dp_… / pi_…
    bidId: bigint("bid_id", { mode: "number" }).references((): AnyPgColumn => bids.id),
    idempotencyKey: text("idempotency_key").unique(), // admin actions (double-click safe)
    reason: text("reason"),
    createdBy: text("created_by").references(() => user.id), // null for webhooks
    createdAt: createdAt(),
  },
  (t) => [
    index("deposit_tx_deposit_idx").on(t.depositId),
    uniqueIndex("deposit_tx_stripe_kind_uq")
      .on(t.stripeObjectId, t.kind)
      .where(sql`${t.stripeObjectId} is not null`),
    check("deposit_tx_amount_chk", sql`${t.amountEurCents} > 0`),
    check(
      "deposit_tx_dedupe_chk",
      sql`${t.stripeObjectId} is not null or ${t.idempotencyKey} is not null`,
    ),
  ],
);

/** Stripe webhook inbox: dedupe by event id, process async in the worker. */
export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: text("id").primaryKey(), // evt_…
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
    error: text("error"),
  },
  (t) => [
    index("stripe_events_unprocessed_idx")
      .on(t.receivedAt)
      .where(sql`${t.processedAt} is null`),
  ],
);

/**
 * The lockable buying-power account (USD). Created with zero totals in the same
 * transaction as the user row (sign-up hook). Bid placement locks it FOR UPDATE.
 * Totals are a cache of buying_power_entries, updated in the same transaction.
 * available = granted − reserved − consumed (may go negative after a revoke — flagged
 * to the broker, never blocked).
 */
export const buyingPowerAccounts = pgTable(
  "buying_power_accounts",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id),
    grantedUsdCents: cents("granted_usd_cents").notNull().default(0),
    reservedUsdCents: cents("reserved_usd_cents").notNull().default(0),
    consumedUsdCents: cents("consumed_usd_cents").notNull().default(0),
    /** Plan terms currently in force (limits: active bids, per-lot cap). */
    planVersionId: bigint("plan_version_id", { mode: "number" }).references(() => planVersions.id),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "bp_accounts_nonneg_chk",
      sql`${t.grantedUsdCents} >= 0 and ${t.reservedUsdCents} >= 0 and ${t.consumedUsdCents} >= 0`,
    ),
  ],
);

export const buyingPowerEntries = pgTable(
  "buying_power_entries",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => buyingPowerAccounts.userId),
    kind: buyingPowerEntryKind("kind").notNull(),
    amountUsdCents: cents("amount_usd_cents").notNull(), // positive; kind gives direction
    depositId: bigint("deposit_id", { mode: "number" }).references(() => deposits.id),
    bidId: bigint("bid_id", { mode: "number" }).references((): AnyPgColumn => bids.id),
    actorType: actorType("actor_type").notNull(),
    actorId: text("actor_id"),
    reason: text("reason"),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: createdAt(),
  },
  (t) => [
    index("bp_entries_user_idx").on(t.userId, t.createdAt),
    check("bp_entries_amount_chk", sql`${t.amountUsdCents} > 0`),
  ],
);

/* ───────────────────────────── Pricing (calculator) ───────────────────────────── */
/* Table shapes are provisional — finalise against the broker's rate spreadsheets. */

/**
 * A versioned set of rates. A new draft is a copy of the active card; drafts are
 * editable; publish (one transaction) archives the old active card and activates
 * the draft. Published/archived cards are never edited.
 */
export const rateCards = pgTable(
  "rate_cards",
  {
    id: id(),
    name: text("name").notNull(),
    status: rateCardStatus("status").notNull().default("draft"),
    notes: text("notes"),
    publishedAt: ts("published_at"),
    publishedBy: text("published_by").references(() => user.id),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("rate_cards_one_active_uq")
      .on(t.status)
      .where(sql`${t.status} = 'active'`),
  ],
);

export const ports = pgTable("ports", {
  id: id(),
  code: text("code").notNull().unique(), // e.g. US-NJ, US-SAV, LT-KLJ
  name: text("name").notNull(),
  country: char("country", { length: 2 }).notNull(),
  kind: portKind("kind").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

/** Copart / IAAI fee schedules as price bands (buyer fee, virtual bid fee, gate, env…). */
export const auctionFeeBands = pgTable(
  "auction_fee_bands",
  {
    id: id(),
    rateCardId: bigint("rate_card_id", { mode: "number" })
      .notNull()
      .references(() => rateCards.id, { onDelete: "cascade" }),
    source: auctionSource("source").notNull(),
    feeCode: text("fee_code").notNull(),
    priceFromCents: cents("price_from_cents").notNull(),
    priceToCents: cents("price_to_cents"), // null = and above
    flatUsdCents: cents("flat_usd_cents"),
    percent: numeric("percent", { precision: 6, scale: 3 }), // 5.000 means 5 % — divide by 100
  },
  (t) => [
    index("fee_bands_lookup_idx").on(t.rateCardId, t.source, t.feeCode, t.priceFromCents),
    check("fee_bands_value_chk", sql`${t.flatUsdCents} is not null or ${t.percent} is not null`),
  ],
);

/** Yard (or state fallback) → US export port. */
export const towingRates = pgTable(
  "towing_rates",
  {
    id: id(),
    rateCardId: bigint("rate_card_id", { mode: "number" })
      .notNull()
      .references(() => rateCards.id, { onDelete: "cascade" }),
    yardId: bigint("yard_id", { mode: "number" }).references(() => yards.id),
    state: char("state", { length: 2 }),
    portId: bigint("port_id", { mode: "number" })
      .notNull()
      .references(() => ports.id),
    vehicleType: vehicleType("vehicle_type").notNull().default("car"),
    priceUsdCents: cents("price_usd_cents").notNull(),
  },
  (t) => [
    index("towing_lookup_idx").on(t.rateCardId, t.yardId, t.state),
    check("towing_target_chk", sql`${t.yardId} is not null or ${t.state} is not null`),
  ],
);

/** US port → EU port (Klaipėda first). */
export const oceanRates = pgTable(
  "ocean_rates",
  {
    id: id(),
    rateCardId: bigint("rate_card_id", { mode: "number" })
      .notNull()
      .references(() => rateCards.id, { onDelete: "cascade" }),
    fromPortId: bigint("from_port_id", { mode: "number" })
      .notNull()
      .references(() => ports.id),
    toPortId: bigint("to_port_id", { mode: "number" })
      .notNull()
      .references(() => ports.id),
    vehicleType: vehicleType("vehicle_type").notNull().default("car"),
    method: shippingMethod("method").notNull().default("container"),
    priceUsdCents: cents("price_usd_cents").notNull(),
    transitDaysMin: integer("transit_days_min"),
    transitDaysMax: integer("transit_days_max"),
  },
  (t) => [
    uniqueIndex("ocean_rates_uq").on(
      t.rateCardId,
      t.fromPortId,
      t.toPortId,
      t.vehicleType,
      t.method,
    ),
  ],
);

/** Flat/percent fees: broker fee, customs agent, unloading, EV surcharge, doc courier… */
export const fixedFees = pgTable(
  "fixed_fees",
  {
    id: id(),
    rateCardId: bigint("rate_card_id", { mode: "number" })
      .notNull()
      .references(() => rateCards.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    amountCents: cents("amount_cents"),
    percent: numeric("percent", { precision: 6, scale: 3 }), // 21.000 means 21 % — divide by 100
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }), // e.g. 21.00 for broker fee + VAT
    vehicleType: vehicleType("vehicle_type"), // null = all
    isOptional: boolean("is_optional").notNull().default(false), // shown as "possible extra"
    /** Included in the import-VAT base (confirm each fee with the customs agent). */
    inVatBase: boolean("in_vat_base").notNull().default(false),
  },
  (t) => [uniqueIndex("fixed_fees_uq").on(t.rateCardId, t.code, t.vehicleType)],
);

/** Duty / import VAT. Bases documented in `basis`; confirm with the customs agent. */
export const taxRates = pgTable(
  "tax_rates",
  {
    id: id(),
    rateCardId: bigint("rate_card_id", { mode: "number" })
      .notNull()
      .references(() => rateCards.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // customs_duty | import_vat
    ratePercent: numeric("rate_percent", { precision: 6, scale: 3 }).notNull(), // 21.000 = 21 %
    basis: text("basis").notNull(), // e.g. 'CIF' | 'CIF + duty'
    notes: text("notes"),
  },
  (t) => [uniqueIndex("tax_rates_uq").on(t.rateCardId, t.code)],
);

export const fxRates = pgTable(
  "fx_rates",
  {
    rateDate: date("rate_date").notNull(),
    base: char("base", { length: 3 }).notNull(),
    quote: char("quote", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 14, scale: 6 }).notNull(),
    source: text("source").notNull(), // 'ECB' | 'LB'
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.rateDate, t.base, t.quote] })],
);

/** Immutable explanation of a price shown at bid time (inputs, lines, versions). */
export const quotes = pgTable("quotes", {
  id: id(),
  lotId: bigint("lot_id", { mode: "number" }).references(() => lots.id),
  userId: text("user_id").references(() => user.id),
  bidUsdCents: cents("bid_usd_cents").notNull(),
  rateCardId: bigint("rate_card_id", { mode: "number" })
    .notNull()
    .references(() => rateCards.id),
  fxRateDate: date("fx_rate_date").notNull(),
  fxRate: numeric("fx_rate", { precision: 14, scale: 6 }).notNull(),
  inputs: jsonb("inputs").notNull(), // port, vehicle type, options…
  lines: jsonb("lines").notNull(), // [{code, currency, amountCents}]
  /** Null when any line is "price on request" (a rate is missing). */
  totalEurCents: cents("total_eur_cents"),
  createdAt: createdAt(),
});

/* ───────────────────────────── Bids ───────────────────────────── */

export const bids = pgTable(
  "bids",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    lotId: bigint("lot_id", { mode: "number" })
      .notNull()
      .references(() => lots.id),
    maxBidUsdCents: cents("max_bid_usd_cents").notNull(),
    isBuyNow: boolean("is_buy_now").notNull().default(false),
    status: bidStatus("status").notNull().default("pending"),
    /** Sale time when bid was accepted — detects postponements. */
    saleAtWhenPlaced: ts("sale_at_when_placed"),
    cutoffAt: ts("cutoff_at"), // sale_at − cutoff setting (1 h)
    /** Lot as the customer saw it (title, images, damage, document…) — survives relists/removal. */
    lotSnapshot: jsonb("lot_snapshot").notNull(),
    quoteId: bigint("quote_id", { mode: "number" }).references(() => quotes.id),
    planVersionId: bigint("plan_version_id", { mode: "number" }).references(() => planVersions.id),
    termsVersion: text("terms_version").notNull(), // accepted bidding rules / ToS version
    // broker side
    placedBy: text("placed_by").references(() => user.id),
    placedAt: ts("placed_at"),
    finalPriceUsdCents: cents("final_price_usd_cents"),
    resultAt: ts("result_at"),
    resultSetBy: text("result_set_by").references(() => user.id),
    paymentStatus: bidPaymentStatus("payment_status").notNull().default("not_required"),
    paymentDueAt: ts("payment_due_at"), // Copart 2 / IAAI 4 business days
    paidMarkedAt: ts("paid_marked_at"),
    outbidByBidId: bigint("outbid_by_bid_id", { mode: "number" }).references(
      (): AnyPgColumn => bids.id,
    ),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    /** Rule (c): exactly one live internal bid per lot — the broker bids from one account. */
    uniqueIndex("bids_one_active_per_lot_uq")
      .on(t.lotId)
      .where(sql`${t.status} in ('pending','locked','placed','won_pending_approval')`),
    index("bids_user_status_idx").on(t.userId, t.status),
    index("bids_status_cutoff_idx").on(t.status, t.cutoffAt),
    index("bids_lot_idx").on(t.lotId),
    check("bids_amount_chk", sql`${t.maxBidUsdCents} > 0`),
  ],
);

/** Append-only audit of every bid change (status and amount). */
export const bidEvents = pgTable(
  "bid_events",
  {
    id: id(),
    bidId: bigint("bid_id", { mode: "number" })
      .notNull()
      .references(() => bids.id),
    fromStatus: bidStatus("from_status"),
    toStatus: bidStatus("to_status").notNull(),
    fromAmountUsdCents: cents("from_amount_usd_cents"),
    toAmountUsdCents: cents("to_amount_usd_cents"),
    actorType: actorType("actor_type").notNull(),
    actorId: text("actor_id"),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("bid_events_bid_idx").on(t.bidId, t.createdAt)],
);

/* ───────────────────────────── Customer features ───────────────────────────── */

export const favorites = pgTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lotId: bigint("lot_id", { mode: "number" })
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lotId] }), index("favorites_lot_idx").on(t.lotId)],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: jsonb("query").notNull(), // normalised filter object (same shape as search URL params)
    alertsEnabled: boolean("alerts_enabled").notNull().default(true),
    lastNotifiedAt: ts("last_notified_at"),
    createdAt: createdAt(),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

/* ───────────────────────────── Notifications / admin ───────────────────────────── */

/**
 * Transactional outbox: rows are inserted in the SAME transaction as the bid/deposit
 * change, then the worker delivers them (email / Telegram) with retries.
 * Broker bid alerts (B8) go through here.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    channel: notificationChannel("channel").notNull(),
    recipient: text("recipient").notNull(), // email address or Telegram chat id
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    template: text("template").notNull(), // 'broker.bid_placed', 'customer.outbid', …
    payload: jsonb("payload").notNull(),
    status: notificationStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    bidId: bigint("bid_id", { mode: "number" }).references(() => bids.id, { onDelete: "set null" }),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    createdAt: createdAt(),
    sentAt: ts("sent_at"),
  },
  (t) => [index("notifications_queue_idx").on(t.status, t.nextAttemptAt)],
);

/** Runtime settings editable in admin: cutoff minutes, takeover step, alert channels… */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").references(() => user.id),
  updatedAt: updatedAt(),
});

/**
 * Every staff (admin/operator) action: refunds, forfeits, bid results, rate edits,
 * settings. System and webhook changes are NOT written here; they are recorded in
 * bid_events / buying_power_entries / deposit_transactions with actor_type.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: text("actor_user_id").references(() => user.id),
    action: text("action").notNull(), // 'deposit.refund', 'bid.mark_won', 'rate_card.publish'…
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: text("ip_address"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_actor_idx").on(t.actorUserId, t.createdAt),
  ],
);
