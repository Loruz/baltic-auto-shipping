# Car Auction Platform: Implementation Plan

Version 2.5 · 2026-11-24 · Author: Vytautas (developer)

**v2 changes:** this version applies the findings from the five-stage review (`review/`). It also records decisions A2 (no stored landed price, Postgres search) and A3 (USD for buying power and bids). Decision A1, the bid allocation model, is still waiting for the broker. Text that depends on it is marked **⏳ A1**. **v2.2:** deposits are charged in EUR at a fixed price per plan (B14 revised after the Stripe fee check in `phase-0/infrastructure-costs.md`). **v2.3:** adds §6 "Local and demo environment": the platform runs locally with fixture lot data, fake KYC, Stripe test mode and a demo seed, for a client demo before deployment. Version 1 is kept in `review/IMPLEMENTATION-PLAN.v1.md`, so the review reports' line numbers still match it.

**v2.4:** records the BidManager/AuctionGate investigation in §8.1 and corrects B1: AuctionGate publishes a customer-provisioning API; BidManager advertises API access, but provisioning support remains unconfirmed. Assisted bidding remains the MVP; D1 requires a separate integration trial and scope decision.

**v2.5:** development no longer waits for the broker. Every open question has a **development default** (§10, "Development defaults"), mostly following the flow competitors already use. Until the first production deploy the database is rebuilt from scratch instead of migrated (§9, "Database during development"), so changing a default is cheap. Payments get a fake provider like KYC, so the whole platform runs locally without any third-party account (§6). The broker's questions are collected in `BROKER-QUESTIONS.md`.

| File | What it is |
|---|---|
| `IMPLEMENTATION-PLAN.md` | This document |
| `db/schema.ts` | Drizzle ORM schema, the source of truth for the database |
| `db/migrations/` | SQL and the Drizzle journal generated from the schema. Checked on PostgreSQL 17 with Drizzle's migrator |
| `db/constraint-tests.sql` | Self-checking database rule tests (13 cases). Exits non-zero on failure |
| `db/drizzle.config.ts`, `db/dbml.ts` | Settings for generating migrations, and a script that regenerates `db/schema.dbml` for https://dbdiagram.io |
| `review/` | The review reports. `consolidated_review_report.md` is the index |

---

## 1. What the platform is (and isn't)

### Parties

| Party | Who | Owns |
|---|---|---|
| **Broker** (the client) | A Lithuanian company that holds one Copart and one IAAI broker account and buys cars for its customers | The platform, the Stripe account, the customer relationship, all money, and every bid placed at the auctions |
| **Operators** | The broker's staff | Placing bids by hand at Copart/IAAI and recording the results in `/admin` |
| **Developer** | Vytautas, alone | Building and running the platform |
| **Customers** | Private buyers and car dealers in Lithuania and the EU who import salvage and used cars from the US. Dealers can get custom plans. | Their account, deposit and max bids |

### External references
- **Copart** and **IAAI** are the two big US online car auctions. They sell mainly insurance write-offs ("salvage"). Each listing is a **lot**. The winning amount is the **hammer price**. Neither offers a bidding API.
- **apibara** (apibara.tech) is a paid third-party API, not connected to Copart or IAAI, that supplies their lot data. This plan calls it **the data provider**. "**The auction**" always means Copart/IAAI.
- **vinasLT** is the public GitHub code of vinas.lt, a Lithuanian competitor. It was reviewed as a reference, and this plan copies its bid rules but not its 16-service architecture.
- **abetter.bid** is a US Copart broker site. It was reviewed for its bidding and deposit rules.

### Scope
**It is:**
- A catalogue of Copart and IAAI lots, with an estimated landed price in EUR (delivered to Klaipėda) on each lot page.
- Customers buy a refundable deposit plan, which gives them **buying power**, then set **max bids**.
- Operators place those bids by hand on the broker's auction accounts.

**It is not** a purchasing or logistics system. When a bid reaches **Won**, everything after that (wire payment to the broker, towing, shipping, customs) happens off-platform. The only post-win data the platform keeps is the payment status the broker sets.

### How buying power works
- **The deposit:** a plan is a refundable deposit of about 10% of its buying power. For example, €1,350 gives $10,000 of buying power.
- **Placing a bid:** each max bid **holds back its full amount** from buying power.
- **When it ends:** the amount comes back when the bid is cancelled, outbid, lost or not placed. A win **uses** the amount until the broker marks the car paid. Then it is restored (provisional default for D3).
- **Currency:** buying power, bids and plan limits are in **USD**. The deposit is charged in **EUR** at a fixed price per plan (B14).

```
apibara ──change feed──► worker ──► Postgres (lots, sold archive, search)
                                                │
Customer ──► Next.js: search · lot page + landed EUR · plans · max bid ◄──┘
               │
               ├─ Stripe Checkout (card / bank transfer) ──webhook──► deposit → buying power
               ├─ Ondato ID check ──webhook──► KYC approved
               └─ max bid (one DB transaction) ──outbox──► broker email + Telegram, operator console
                                                              │
Operator ──► /admin console: places bids on Copart/IAAI by hand, then records placed / won / lost / paid
```

---

## 2. Decision log

Decision IDs were renumbered in v2. The second "B2" became **B4**, and "B2b" became **B5**. B4 and B5 were unused before.

| # | Decision | Alternatives rejected, and why |
|---|---|---|
| B1 | **Assisted bidding for the MVP.** Customers set max bids, and operators place them by hand. | **Customers bidding themselves** through BidManager.io or AuctionGate.io remains deferred (D1), but lack of an API is no longer a blanket blocker: AuctionGate documents customer creation, account assignment and limit updates; BidManager's write operations remain unconfirmed (§8.1). Auction permission, aggregate exposure, revocation and same-lot conflicts still need validation. **Bid bots:** these break the auctions' terms. |
| B2 | **A plan is a refundable deposit of about 10% of buying power.** There are about 3 public plans plus custom dealer plans. It is not a subscription. | **A subscription or membership fee:** it doesn't protect the broker from Copart's ~10% penalty when a customer abandons a won car. **A deposit per bid:** too much friction. **Card holds (authorise now, capture later):** they expire after about 7 days. |
| B3 | **apibara supplies Copart and IAAI lot data**, and sold results are kept as an archive. | **Our own scraper:** costs €95k–250k in the first year, and breaks the auctions' terms. **auctionsapi / apicars / auction-data.info:** no public pricing, or no change feed at the entry tier. They stay as fallbacks behind the `LotDataProvider` interface if the Phase 0 trial fails. |
| B4 | **Stripe sync works in both directions.** A refund made in /admin calls Stripe. A refund or dispute made in Stripe arrives by webhook. Both paths write the same deduplicated rows (§4.5). Forfeits and "apply to car price" exist only in /admin. | **Only allowing refunds in /admin:** the broker will still sometimes refund in the Stripe dashboard, and those refunds must not be missed. |
| B5 | **Nothing on the platform after a win**, apart from payment status. | **Full order tracking** (shipments, containers, documents): about a third more scope, and the broker already handles this off-platform. |
| B6 | **One TypeScript modular monolith:** a Next.js app, one worker process, Postgres and Redis. | **One service per feature, as vinasLT does** (16 services, gRPC, RabbitMQ, about 46 containers): one developer can't operate that. **Django:** the developer works in TypeScript, and the web app and backend would no longer share types. |
| B7 | **Keep our own copy of every lot** in Postgres, synced from the data provider. **Search runs on Postgres** at launch (A2). | **Calling the data provider live for every search, as vinasLT does:** every request counts against a paid quota and traffic is unknown. It also stops working when the provider is down, and saved-search alerts would be impossible. **Typesense from day one:** it's another service to run, and its main reason (sorting by landed price) was dropped in A2. It can be added behind `packages/search` if measured search speed needs it. |
| B8 | **The broker gets each bid in the console and as an instant email + Telegram message** that carries **that lot's full current state** (D5 decides which recipients and which channels). **Postgres backups** are taken off-server (§6). | **Only the digest at the cutoff:** if the server dies before the cutoff, the broker has nothing. **Messages that only describe the change:** they can't rebuild the list. |
| B9 | **The landed-cost calculator is one pure function** working from versioned price lists (rate cards). The broker and the developer can both edit them. Price **lines are shown only on lot pages and on the calculator page.** No landed price is stored or used for sorting (A2). | **A separate calculator service** (vinasLT): it's just a function, so a service adds nothing. **A stored landed price for sorting:** it would be calculated from pre-bids near $0, and every exchange-rate or rate-card change would need a recompute. |
| B10 | **Schema tooling:** the Drizzle schema is the source of truth. drizzle-kit generates migrations and the dbdiagram.io file is generated from the schema. | **Keeping a diagram by hand:** it drifts out of date. **Prisma:** it handles row locks and partial indexes less well. |
| B11 ⏳ A1 | **Same lot:** one active internal bid per lot. A takeover must be higher by at least the takeover step: **$1 during development** (any bigger bid wins, as on vinasLT), `bidding.takeover_step_usd_cents`. The bid it replaces becomes `outbid`, its buying power is released, and that customer is notified. **Provisional, waiting for A1** (§4.3). | **Sealed bids, with the highest picked at the cutoff:** removes the ways to game the rules and the race conditions, but customers only learn the result at the cutoff. **This is waiting for the broker (A1).** **A $100 step:** the earlier default. It makes $1 sniping and probing the other customer's exact max slower; it is one setting change if needed. |
| B12 | **Bids close 1 h before the live auction.** Customers can raise a bid but never lower it, and can cancel until the cutoff (with the A1 exception in §4.3). | **15 min (vinasLT) or 10 min (research notes):** not enough time to enter bids by hand. **No cancelling at all (abetter.bid):** too harsh before the cutoff. |
| B13 | **The ID check (Ondato) must pass before buying a plan. Deposits by card or Stripe bank transfer.** Buying power is granted only when the payment webhook arrives. | **Email/SMS only:** too weak against fraud with deposits of $1,500 or more. **SEPA Direct Debit and buy-now-pay-later:** both can be reversed weeks later. **Veriff:** also suitable. Ondato is chosen provisionally because it is Lithuanian (D6). |
| B14 | **Buying power, bids and plan limits are in USD. Deposits are charged in EUR at a fixed price per plan version** (for example €1,350 → $10,000), revised 2026-11-21. Bid checks never use an exchange rate. The broker resets the EUR price by publishing a new plan version when the rate moves. Refunds, forfeits and disputes are in EUR, the currency that was paid. | **USD deposit charges:** Stripe adds 2% currency conversion on every EUR card, about €450/month at the example volume. **USD settlement:** about 1% and needs a USD bank account. **EUR buying power:** every bid check would need an exchange rate that changes daily. |
| B15 | **Lot photos are links only; nothing is stored** (revised 2026-11-22, for simplicity). Pages show the photo URLs the data provider returns. For lots with bids, and won cars, the photos come from the latest provider record (`sync.soon`, `sync.refresh`, or re-fetching the lot). If the auction's links expire, old pages lose photos; that risk is accepted. | **Copy photos to R2 on a lot's first bid** (the earlier B15): keeps photos for bid history, but adds a storage service, a job and copyright exposure, and apibara's terms grant no right to store photos. Revisit if expired links become a real problem. **One thumbnail per sold lot:** about 150 GB a year; reconsider when the sold-archive SEO pages are built (Phase 2). **Store every photo:** 10–20 TB a year, and the largest exposure under the data-licence risk. |

**Risks accepted knowingly**

| Risk | Owner | Mitigation |
|---|---|---|
| Lot data and photos from the data provider may be scraped or unlicensed. Publishing them, and keeping the sold archive, could put the broker's auction accounts at risk. | Broker (written sign-off in Phase 0) | Data provider behind an adapter, so it can be switched. Lots can be hidden. apibara's own terms say public display, SEO, a permanent archive and storing photos each need written agreement, and that it grants no photo rights. Phase 0 asks apibara for that scope in writing (`phase-0/apibara-trial-plan.md`). |
| Card deposits can be charged back for up to about 120 days. | Broker | ID check, bank-transfer option, and a dispute webhook that revokes buying power at once |
| One VPS: a hardware failure means downtime until the server is restored. | Developer | Off-server backups, a restore drill, broker messages as the fallback bid list |
| Business risks (AML, working capital, GDPR processes) | Broker | Tracked in `../usa-car-auction-research/investigation-checklist.md`, outside this technical plan |

---

## 3. Tech stack

| Layer | Choice (major version; exact versions pinned in Milestone 1) |
|---|---|
| Runtime | Node.js 24 LTS, TypeScript 5.x, pnpm workspaces + Turborepo |
| Web | **Next.js 16** (App Router, React Server Components, server-side rendering of lot pages for SEO), next-intl with `/lt` and `/en` |
| UI | Tailwind CSS 4, shadcn/ui, TanStack Table (admin), React Hook Form + zod |
| Auth | **Better Auth 1.x** with the Drizzle adapter, plus the admin and twoFactor plugins. `defaultRole: "customer"`. Email/password and Google sign-in. TOTP 2FA is required for staff |
| Database | **PostgreSQL 17**, drizzle-orm 0.45 / drizzle-kit 0.31 |
| Search | Postgres (B-tree indexes, `pg_trgm` for make/model text, VIN/lot exact match) behind `packages/search` |
| Jobs | **Redis 7 + BullMQ 5** in `apps/worker` |
| Payments | Stripe Checkout (`mode=payment`, payment methods `card` and `customer_balance`), Refunds, webhooks |
| KYC | **Ondato** (provisional, D6) behind a `KycProvider` interface |
| Email | Resend + React Email |
| Telegram | Telegram Bot API, used only for broker alerts |
| Edge | Cloudflare (DNS, WAF, Turnstile, caching). Images are loaded straight from the auction's image servers; nothing is stored (B15) |
| Monitoring | Sentry (errors), Better Stack (external uptime checks plus a heartbeat ping from the worker), pino logs |
| Tests | Vitest + Testcontainers (Postgres 17) for database and logic tests, Playwright for end-to-end flows |
| CI/CD | GitHub Actions → images on GHCR → SSH deploy (§6) |
| Config | `@t3-oss/env-nextjs` + zod. The required variables are listed in §6 |

### Repository layout

```
repo/
├─ apps/
│  ├─ web/            Next.js: public site, customer account, /admin, /api/webhooks/*
│  └─ worker/         BullMQ processors and schedulers (§4.7)
├─ packages/
│  ├─ db/             schema.ts, drizzle.config.ts, dbml.ts, migrations/, migrate.ts, constraint tests
│  ├─ auctions/       LotDataProvider interface, apibara adapter, normaliser
│  ├─ pricing/        calculateLandedCost(), reverseCalculate(), branch coverage enforced in CI
│  ├─ bidding/        state machine (§4.4), placeBid / raiseBid / cancelBid / takeover transactions
│  ├─ billing/        Stripe client, webhook handlers, deposit ↔ buying-power logic
│  ├─ kyc/            KycProvider interface, Ondato adapter
│  ├─ search/         Postgres query builder (filters → SQL), facet counts
│  ├─ notifications/  outbox writer, templates, email and Telegram senders
│  ├─ i18n/           LT + EN messages
│  └─ config/         tsconfig, eslint, env schema
└─ infra/             compose.yml (dev), compose.prod.yml, Caddyfile, backup scripts, runbooks
```

The current `db/*` drafts move to `packages/db/` in Milestone 1 unchanged.

---

## 4. Core flows

### 4.1 Lot sync (data provider → Postgres)

```ts
interface LotDataProvider {
  listChanges(cursor: string | null): Promise<{ lots: ProviderLot[]; removed: ProviderLotRef[]; cursor: string }>;
  listSlice(slice: LotSlice, cursor: string | null): Promise<{ lots: ProviderLot[]; cursor: string | null }>;  // one page of a refresh slice
  getLot(ref: ProviderLotRef): Promise<ProviderLot | null>;
  getSaleResults(since: Date): Promise<ProviderSaleResult[]>;
}
```

The exact fields and the mapping from provider values to our enums (`lot_status`, `sale_outcome`, `export_status`, `odometer_brand`) are filled in from the Phase 0 trial. An unmapped provider status or outcome is stored as `unknown` (both enums have it). The raw value is always kept in `lot_raw`, and the `alerts.check` job reports any lot with an `unknown` status. A lot whose status is `unknown` can't be bid on.

**Schedule** (defaults, stored in `site_settings`):

| Job | Every | What it does |
|---|---|---|
| `sync.changes` | 15 min (apibara's own freshness) | Read **filtered** `GET /changes` streams, each with its own cursor (`sync_runs.feed`): terminal events (`terminal=true`), `auction.rescheduled`, and `lot.created` (`include_record=created`). The unfiltered feed is about 2.8 million events a day, 93% `bid.changed`, so it is never polled (trial, `phase-0/apibara-trial-results.md`). Insert or update each lot on `(source, external_lot_id)`, then write `lot_raw`. Save a cursor only after our commit. A `410 cursor_expired` (more than 14 days behind) marks every `sync.refresh` slice overdue and restarts the stream from the latest sequence. |
| `sync.soon` | 1 min | Fetch again, one by one, the lots that have an active bid and sell within 24 h |
| `sync.refresh` | 15 min | **Rolling refresh in small slices**, instead of one full download of the ~204,000 active lots. It repairs anything the filtered streams missed, including current bids and field edits. **A slice** is one platform plus one sale day (`auction_date_from/to`), or that platform's undated lots (`auction_date_pending=true`), split by state. **Target age:** 24 h for slices selling within 2 days, 7 days for everything else. **Each run** takes the most overdue slices and spends at most `sync.refresh_requests_per_run` requests. A slice cut off mid-way keeps its page cursor in `sync_runs` and resumes on the next run; if the cursor is rejected, the slice starts again. **Cost:** about 2,300 requests a day (≈70k a month), spread evenly. On apibara Pro the Sync Center feed can replace it. |
| `sync.results` | 15 min | Write sale results into `lot_sales` (outcomes: sold, on_approval, not_sold, cancelled) |

**Rules:**
- **Sale time:** the provider's `auction.auction_at` is the start of the auction session, not the moment the lot comes up. `lots.sale_at` stores the session start, so the 1 h cutoff is measured from it. That cutoff is earlier than the lot's real sale time, which errs on the safe side.
- **Data quality (trial):** a missing odometer comes back as 0 (Copart) or 1 (IAAI) and is stored as unknown. A removed lot can be **relisted**: it becomes biddable again, but bids cancelled by the removal stay cancelled. An ended lot with a future date is treated as ended. Unscheduled lots (IAAI "Not Ready for Sale", raw date 31/12/1899) have no `sale_at` and can't be bid on until scheduled. Select by `auction_date_from/to`; don't rely on apibara's `upcoming` filter.
- **Never remove lots because a feed came back empty or failed.** A lot is marked `removed` only when the provider says so explicitly.
- **Matching a lot to a vehicle:**
  - A valid 17-character VIN → find or create the `vehicles` row by VIN.
  - No VIN, or an invalid one → keep the lot's existing vehicle if the lot is already known. Otherwise create a separate vehicle for the lot. Sync never creates a second vehicle for the same lot.
  - The VIN changes on a known lot → re-point the lot to the vehicle for the new VIN, and keep the old one.
- **Sync writes only provider data.** It never writes `export_status_override`, `hidden_at`, `reviewed_at` or any bid table.
- **Images (B15):** sync stores only the provider's image URLs in `lots.images`, and every refresh overwrites them with the latest list. Pages and bid pages always show the lot's current `images`. Bid snapshots keep the URLs as they were, for the record only. Nothing is downloaded or stored.
- **Quota:** each run adds its requests to `sync_runs.requests_used`.

**Events that affect bids** (handled by the `bids.reconcile` job on the critical queue, not by the sync job itself):

| Event (from sync) | `pending` | `locked` / `placed` | `won_pending_approval` |
|---|---|---|---|
| Lot sold before the cutoff (e.g. Buy Now) or removed | → `cancelled` (system), power released, customer notified | Operator alerted. The operator then uses §4.4: `locked` → `not_placed`, `placed` → `not_placed` (auction withdrew the lot) or `lost` (sold to someone else) | Operator alerted |
| `sale_at` moved later | Update `cutoff_at`, notify the customer | `locked`: update `cutoff_at`. If the new cutoff is in the future, the bid goes back to `pending` (system) and the customer is notified. `placed`: stays `placed` (the bid is already at the auction), and the operator is alerted to check it there | n/a |
| `sale_at` moved earlier, new cutoff still ahead | Update `cutoff_at`, notify the customer | `locked`/`placed`: update `cutoff_at` only | n/a |
| `sale_at` moved earlier, new cutoff already passed | → `locked`, operator alerted | Operator alerted | n/a |
| Provider reports a sale result | Shown as a hint ("provider says sold at $X") in the console | Same hint | Same hint |
| Relisted (new `lot_sales` row, new `sale_at`) | As if the sale moved | Operator alerted | Operator alerted |

The `bids.reconcile` job is added in Milestone 6. Until then, sync has no effects on bids.

### 4.2 Accounts, KYC, buying a plan

1. **Sign-up:** Better Auth creates the `user` row (role `customer`). The same transaction creates `customer_profiles` and a `buying_power_accounts` row with all totals at zero.
2. **KYC:** the customer starts an Ondato session (`kyc_checks` row). The webhook `/api/webhooks/kyc` checks its signature and updates `status`. `approved` sets `customer_profiles.kyc_approved_at`. `declined` or `expired` clears it.
3. **Buying a plan** requires a verified email and approved KYC.
   1. Create the Stripe Customer if it doesn't exist yet and save its ID in `stripe_customer_id`. Bank transfers need this.
   2. Insert a `deposits` row (`pending`, `amount_eur_cents = plan deposit (EUR)`, `grants_buying_power_usd_cents = plan buying power`).
   3. Create the Checkout Session (**EUR**, `card` + `customer_balance` with an EU bank transfer, so the customer gets a SEPA virtual IBAN) with `metadata.deposit_id`.
4. **Upgrade:** charge the **difference in EUR deposit** (between the two current plan versions) and grant the **difference in buying power**. Set `upgrades_deposit_id`, and move `buying_power_accounts.plan_version_id` to the new plan. Downgrades and holding two plans at once are not supported. A customer leaves a plan by refund only.
5. **Plan edits** create a new `plan_versions` row. Existing customers keep their version until they upgrade.

**Stripe webhook** at `/api/webhooks/stripe`:
- It checks the signature and does `INSERT … ON CONFLICT (id) DO NOTHING` into `stripe_events`, then returns 200.
- The `stripe.process` job (critical queue) works through unprocessed events oldest first. Each handler is idempotent because it is keyed on the Stripe object ID, so events arriving out of order or twice are safe.

| Event | Effect |
|---|---|
| `checkout.session.completed` with `payment_status = paid` (card) | Deposit `succeeded`. Write a `payment` deposit transaction (`stripe_object_id` = the PaymentIntent). Grant buying power. Set `plan_version_id`. |
| `checkout.session.completed` with `payment_status = unpaid` (bank transfer) | Save `payment_method = bank_transfer`. Show "waiting for your transfer". **Grant nothing.** |
| `checkout.session.async_payment_succeeded` | Same as a paid card payment |
| `checkout.session.async_payment_failed` / `checkout.session.expired` | Deposit `failed` / `canceled` |
| `charge.refunded` | Refund rows (§4.5) |
| `charge.dispute.created` / `charge.dispute.closed` | Dispute rows (§4.5) |
| `customer.cash_balance_transaction.created` that doesn't settle a session | Alert the broker: an **unmatched bank transfer** (money arrived without a matching open deposit). Staff resolve it in Stripe. |
| Anything else | Saved, marked processed, ignored |

### 4.3 Placing, raising, taking over and cancelling a bid ⏳ A1

**Preconditions:**

| Check | Exact rule |
|---|---|
| Identity | `kyc_approved_at IS NOT NULL` and `banned = false` |
| Not blocked | `customer_profiles.bidding_blocked_at IS NULL` (the broker sets it, e.g. for an unpaid car, §4.4) |
| Has a plan | `buying_power_accounts.plan_version_id IS NOT NULL` and `granted_usd_cents > 0` |
| Lot open | `lots.status = 'upcoming'`, `hidden_at IS NULL`, `sale_at IS NOT NULL`, `now() < sale_at − bidding.cutoff_minutes`. A lot with no sale date can be favourited but not bid on. |
| Amount | A whole number of dollars. At least the current auction bid (if known), and at most the plan's per-lot cap (if set). |
| Number of bids | Active bids < `max_active_bids`. A raise doesn't count as a new bid. |
| Buying power | `granted − reserved − consumed ≥ the new amount minus the customer's current amount on this lot` |

**Transaction:**
- The lot row is locked first, so all bids on one lot run one after another.
- Account rows are locked in `user_id` order, so two crossing takeovers can't deadlock.
- If Postgres reports a deadlock (`40P01`), a duplicate on the unique index (`23505`) or a serialisation failure (`40001`), the transaction is retried up to 3 times. After that the customer gets `BID_CONFLICT_RETRY` ("please try again").

```
BEGIN
  SELECT … FROM lots WHERE id=$lot FOR UPDATE
  SELECT … FROM bids WHERE lot_id=$lot AND status IN ('pending','locked','placed','won_pending_approval')
  -- top = that row, if any
  lock buying_power_accounts for {me, top.user_id} ORDER BY user_id FOR UPDATE
  check the preconditions
  CASE
    top.status <> 'pending' → reject BID_CLOSED  (a locked/placed/won bid can't be raised or taken over)
    top is mine            → RAISE: new > current; UPDATE bids.max_bid; reserve the difference
    top is someone else's  → TAKEOVER: new ≥ top + bidding.takeover_step; else reject BID_TOO_LOW
                             UPDATE top → 'outbid'; release top's reservation; outbox "you were outbid"
                             INSERT my bid; UPDATE top.outbid_by_bid_id = my bid
    no top                 → NEW: INSERT my bid; reserve the amount
  INSERT quotes (the landed-cost result shown at confirmation) → bids.quote_id
  bids: sale_at_when_placed = lots.sale_at, cutoff_at = sale_at − cutoff, plan_version_id, terms_version
  INSERT bid_events, buying_power_entries (idempotency_key = request key + kind), outbox (broker + customer)
COMMIT
```

**Messages (amounts are never shown):**
- `BID_TOO_LOW`: "Another customer already holds a bid this high or higher. Raise your bid to take the car over." (With a step above $1: "A new bid must beat it by at least $X.") This only appears when a top bid exists.
- `BID_CLOSED`: bidding has closed for this lot.
- `INSUFFICIENT_POWER`, `BID_LIMIT`, `KYC_REQUIRED`, `PLAN_REQUIRED`, `BLOCKED`.
- **Retried request** (same idempotency key): return the result of the first request, not an error.

**Cancel:** a `pending` bid can be cancelled before `cutoff_at`. The bid becomes `cancelled`, the reservation is released, and the broker gets a message. **Exception (provisional, A1):** a bid that **took over** another customer's bid (`outbid_by_bid_id` points at it from the outbid row) **can't be cancelled**. This stops the take-over-then-cancel trick. A previously outbid bid is **not** brought back, but its owner may bid again. There can't be a tie: a takeover must be at least $1 higher (bids are whole dollars).

**If A1 becomes "sealed bids picked at the cutoff":** takeover and the unique index go away, several active bids per lot are allowed, and `bids.cutoff` picks the highest one (earliest wins a tie) and marks the rest `outbid`. The schema change is: drop `bids_one_active_per_lot_uq`.

### 4.4 Bid lifecycle

**Statuses:** `pending`, `locked`, `placed`, `won_pending_approval`, `won`, `lost`, `not_placed`, `cancelled`, `outbid`.
- **Active** = `pending`, `locked`, `placed`, `won_pending_approval`. These hold buying power and block other bids on the lot.
- **Final** = `won`, `lost`, `not_placed`, `cancelled`, `outbid`.

| From → To | Who | Buying-power entry | Message |
|---|---|---|---|
| (new) → `pending` | Customer | `reserve` | Broker + customer |
| `pending` → `pending` (raise) | Customer | `reserve` (difference) | Broker |
| `pending` → `outbid` | Customer B (takeover) ⏳ A1 | `release` (A's bid) | Customer A |
| `pending` → `cancelled` | Customer before the cutoff, or the system (lot sold/removed) | `release` | Broker + customer |
| `pending` → `locked` | System, at `cutoff_at` (`bids.cutoff` job, every minute) | none | Session digest to the broker |
| `locked` → `pending` | System (sale postponed past a new cutoff) | none | Customer |
| `locked` → `placed` | Operator | none | none |
| `locked` → `not_placed` | Operator (lot gone, bid missed) | `release` | Customer |
| `placed` → `not_placed` | Operator (the auction withdrew the lot after the bid was entered) | `release` | Customer |
| `placed` → `won` | Operator (enters the hammer price) | `consume` the reserved amount, `release` the rest | Customer |
| `placed` → `won_pending_approval` | Operator. The auction says the **seller must approve** the price (Copart "On Minimum Bid", IAAI "On Approval"). | none | Customer |
| `won_pending_approval` → `won` / `lost` | Operator, after the seller decides | as above / `release` | Customer |
| `placed` → `lost` | Operator | `release` | Customer |

Every change is a **guarded update**: `UPDATE bids … WHERE id=$1 AND status IN (<allowed from>) RETURNING id`. If it matches zero rows, the action is rejected with "this bid changed, refresh". Every change writes a `bid_events` row. Staff changes also write `audit_log`.

**Payment status** (`bids.payment_status`) is separate from the bid status.
- **When a bid becomes `won`:** set `payment_status = 'pending'` and `payment_due_at = result_at + 2 US business days (Copart) / 4 (IAAI)`, at 17:00 America/New_York. Weekends are skipped. US holidays are ignored at launch, and staff can edit the due date.
- **When the due date passes:** the `bids.overdue` job sets `overdue` and alerts the broker.
- **Broker marks it `paid`:** sets `paid_marked_at` and restores the used buying power (`restore` entry, provisional D3).
- **Broker forfeits it:** sets `payment_status = 'forfeited'`, writes a `restore` entry for the bid's consumed amount (the car is closed, so its buying power is no longer in use), records a forfeit deposit transaction with its revoke (§4.5), and may set `bidding_blocked_at` with a reason.

Buy Now is not in the MVP. `bids.is_buy_now` is always `false` (D8).

### 4.5 Refunds, disputes, forfeits

**Converting a deposit amount to buying power:**
- **Revoke amount:** for X euro cents refunded, forfeited, applied or disputed from a deposit, revoke (USD cents) = `ceil(X × deposits.grants_buying_power_usd_cents / deposits.amount_eur_cents)`. A full refund of a €1,350 deposit that granted $10,000 revokes $10,000. A €135 forfeit from it revokes $1,000. The ratio comes from the deposit itself, so later price changes don't affect it.
- **Forfeit amount:** Copart/IAAI penalties are in USD, but the broker enters the forfeit in EUR (the deposit's currency) and converts it themselves.
- **Closing a deposit:** remaining = payment − refunds − forfeits − applied − disputes not won. When it reaches 0, the deposit becomes `closed` (`closed_at`).
- **Negative available buying power:** a revoke is capped so `granted` never drops below 0, but `granted − reserved − consumed` can drop below 0 when bids are open. The `alerts.check` job reports such accounts to the broker; there is no separate flag column. Active bids are **not** cancelled automatically (provisional D2), but no new bids or raises pass the buying-power check. The broker decides.

**Ledger rules.** Every `buying_power_entries` row changes the account totals in the same transaction:

| Kind | `granted` | `reserved` | `consumed` |
|---|---|---|---|
| `grant`, `adjust_up` | + amount | | |
| `revoke`, `adjust_down` | − min(amount, granted) | | |
| `reserve` | | + amount | |
| `release` | | − amount | |
| `consume` | | − amount | + amount |
| `restore` | | | − amount |

The `bp_accounts_nonneg_chk` constraint rejects any change that would make a total negative.

| Action | Where it starts | Sequence |
|---|---|---|
| **Customer asks for a refund** | Customer account: "Request refund" button | Sets `deposits.refund_requested_at`. Message to the broker. Allowed at any time; staff approve. |
| **Refund** | /admin (admin role, step-up) | **Blocked while the customer has active bids or unpaid won cars** (D2 default). (1) Call `stripe.refunds.create` with an idempotency key and `metadata.initiated_by=platform`. (2) Insert the refund row keyed by the `re_…` ID with `ON CONFLICT DO NOTHING`, plus the revoke. If the webhook got there first, step 2 does nothing. |
| Refund | Stripe dashboard | `charge.refunded` → the same insert keyed by `re_…` (`origin = stripe_dashboard` unless the metadata says platform) + revoke |
| **Dispute opened** | Stripe | `charge.dispute.created` → `dispute_opened` row keyed by `dp_…`, **revoke immediately**, alert the broker |
| Dispute closed | Stripe | `charge.dispute.closed`: **won** → `dispute_won` row and grant the buying power again. **Lost** → `dispute_lost` row (revoke already done). |
| **Forfeit** | /admin (admin, step-up) | The broker enters an amount (default: everything left on the deposit). The row is keyed by an admin idempotency key, then revoke. |
| **Apply to car price** | /admin (admin, step-up) | Same as forfeit, kind `apply_to_purchase` |

### 4.6 Landed-cost calculator

```ts
calculateLandedCost(input: {
  source: "copart" | "iaai"; bidUsdCents: number; yardId: number | null; yardState: string | null;
  vehicleType: VehicleType; exportPortId?: number; destinationPortId: number; options: { ev?: boolean };
}, rateCard: RateCard, fx: { date: string; usdToEur: string }): {
  lines: { code: string; currency: "USD" | "EUR"; amountCents: number }[];
  possibleExtras: Line[]; totalEurCents: number; rateCardId: number; fxDate: string;
}
```

| Line | Formula |
|---|---|
| `hammer` | the bid |
| `auction_fee:*` | For each `auction_fee_bands.fee_code` of the source: the band where `price_from ≤ bid < price_to` (an empty `price_to` means no upper limit) → `flat + bid × percent / 100` |
| `towing` | `towing_rates` for the yard, otherwise for the yard's state. **Export port:** the customer's choice, otherwise the cheapest towing + ocean combination. No rate found → the line shows "price on request" and no total is given. |
| `ocean` | `ocean_rates` from the export port to the destination (Klaipėda by default), for this vehicle type and the container method |
| `customs_value_eur` | `(hammer + auction fees + towing + ocean) × usdToEur`, used only as a base (CIF). Every USD line is converted to EUR with the same rate for the total. |
| `customs_duty` | `customs_value × tax_rates[customs_duty].rate_percent / 100` |
| `import_vat` | `(customs_value + duty + fixed fees where in_vat_base = true) × tax_rates[import_vat].rate_percent / 100`. **The base must be confirmed by the customs agent** (Phase 0) |
| `broker_fee`, `broker_fee_vat` | `fixed_fees[broker_fee]`, and `broker_fee × vat_rate / 100` as a separate line |
| other fixed fees | customs agent, unloading, EV surcharge, and so on, from `fixed_fees` |

**Rules:**
- **Rounding:** each line is rounded to whole cents, half up. The total is the sum of the rounded lines.
- **Exchange rate:** the ECB USD/EUR reference rate on or before today, fetched daily by the `fx.fetch` job. On weekends the last rate is used.
- **Percentages** are stored as written (`21.000` = 21 %) and always divided by 100.
- **Reverse calculator** ("target € → max bid"): a binary search over whole dollars between $0 and the plan's per-lot cap, or $250,000 when the plan has no cap. It returns the largest bid whose total ≤ the target, or "not possible" when even $0 is over the target. Unavailable when any line is "price on request".
- **What gets stored:** the result is saved only in `quotes` (with the rate card ID and the exchange rate) when a bid is confirmed. When a line is "price on request", `quotes.total_eur_cents` is null and the bid is still allowed. Nothing is stored on `lots`.

### 4.7 Worker jobs and queues

| Queue (concurrency) | Jobs |
|---|---|
| `critical` (5) | `stripe.process`, `kyc.process`, `bids.cutoff` (every 1 min), `bids.reconcile`, `bids.overdue` (every 15 min), `outbox.send` (every 10 s) |
| `sync` (1) | `sync.changes`, `sync.soon`, `sync.refresh`, `sync.results` |
| `maintenance` (2) | `fx.fetch` (daily 16:30 CET), `alerts.check` (every 5 min), `heartbeat` (every 1 min → Better Stack) |

**Outbox** (`notifications`):
- **Sending:** `outbox.send` claims up to 50 `queued` rows where `next_attempt_at ≤ now()`, using `FOR UPDATE SKIP LOCKED`.
- **Retries:** after a failure the next attempt is 1 min, then 5 min, 30 min, 2 h and 6 h later. After 5 attempts the row is marked `failed` and an alert fires.
- **Stuck rows:** rows left in `sending` for more than 10 min go back to `queued`.

**Templates:**
- Broker: `broker.bid_new`, `broker.bid_raised`, `broker.bid_cancelled`, `broker.session_digest`, `broker.refund_requested`, `broker.alert`.
- Customer: `customer.outbid`, `customer.bid_cancelled_lot_gone`, `customer.sale_moved`, `customer.won`, `customer.lost`, `customer.not_placed`, `customer.deposit_succeeded`, `customer.refund_done`.

Broker messages are sent to the recipients set in `site_settings`. Each one includes the lot link, the customer, the max bid, the sale time in Vilnius time **and** the yard's time, and the lot's current active bid.

---

## 5. Admin panel (`/admin`, same Next.js app)

**Access:**
- `/admin` is on the public internet behind login, the roles below and **required TOTP 2FA**.
- **Roles:** `admin` (the developer and the broker owner) and `operator` (broker staff who place bids).
- **Step-up:** before a refund, forfeit, buying-power adjustment, role change or export, the user re-enters a TOTP code. It is valid for 10 minutes (a custom check on the session).
- **Impersonation** (Better Auth `impersonatedBy`) is **read-only**: middleware rejects any change while `session.impersonated_by` is set.

| Screen | Roles | What it does |
|---|---|---|
| **Operator console** | operator, admin | Bids grouped by auction session (auction + yard + sale date), sorted by sale time, in Vilnius time and yard time. If the yard has no time zone, it falls back to the state's main time zone, then to Vilnius only. Each lot shows one active bid with customer, max bid, cutoff and an auction link. Actions follow §4.4. The provider's sale result is shown as a hint. |
| Bids | operator, admin | All bids, with filters, `bid_events` history and payment status actions |
| Customers | admin | Profile, KYC status, plan, buying-power entries, deposits, bids, notes, block/unblock bidding, impersonate |
| Deposits & payments | admin | Refund requests, refund, forfeit, apply to car price, disputes, unmatched transfers |
| Plans | admin | Public and custom plans. Editing creates a new version. |
| Rate cards | admin | Copy the active card to a draft, edit, preview sample quotes, publish (archives the old card in the same transaction) |
| Lots | admin | Hide, mark reviewed (adds a "checked by broker" badge on the lot page), set `export_status_override`, sync health (last successful run per feed, quota used) |
| Settings | admin | `site_settings` keys (below) |
| Audit log | admin | Every staff action, with before and after values |

**Settings keys and defaults:**
- `bidding.cutoff_minutes` = 60
- `bidding.takeover_step_usd_cents` = 100 ($1: any bigger bid takes over)
- `bidding.restore_on_paid` = true
- `broker.alert_emails` = []
- `broker.telegram_chat_ids` = []
- `sync.changes_interval_s` = 900
- `sync.refresh_requests_per_run` = 25 (96 runs a day ≈ 2,400 requests)
- `sync.refresh_max_age_h` = 24 for slices selling within 2 days, 168 otherwise
- `provider.monthly_request_quota` = (from the plan bought)
- `terms.current_version` = "draft" until the real terms are published (§10, development defaults)
- `catalogue.requires_sign_in` = false (true limits search and lot pages to signed-in customers, item 8.1 in `BROKER-QUESTIONS.md`)
- `contact.phone`, `contact.email`, `contact.address` = placeholders until the broker supplies them

A change to the cutoff applies only to new bids. Existing bids keep their `cutoff_at`.

---

## 6. VPS deployment

**Servers:**
- **Production:** one Hetzner dedicated-vCPU VPS in an EU region, starting with 4 vCPU and 16 GB RAM. Resize when Postgres needs more than 70% of RAM or average CPU stays above 60%.
- **Staging:** one small VPS (2 vCPU / 4 GB).

**Containers** (`infra/compose.prod.yml`, one compose file per environment):

| Container | Notes |
|---|---|
| caddy | TLS, reverse proxy, security headers. Publishes only ports 80 and 443 |
| web | Next.js standalone build. One instance at launch |
| worker | The queues from §4.7 |
| postgres:17 | Volume on local NVMe. `shared_buffers` = 25% of RAM, `effective_cache_size` = 60% |
| redis:7 | AOF on. Holds queues only, no business data |

**Deploy:**
1. CI builds the `web`, `worker` and `migrate` images and tags them with the git SHA.
2. On the server: `docker compose pull`, then `docker compose run --rm migrate`. This applies the Drizzle migrations through `packages/db/migrate.ts`, which uses drizzle-orm's migrator; drizzle-kit is not in production. **If migrate fails, the deploy stops**, and the old containers keep running.
3. `docker compose up -d`.
4. Once production is live, migrations only go forward (before that, see §9 "Database during development"). To roll back, deploy the previous image, and restore from backup only if the migration destroyed data.

**Backups:**
- **Daily:** `pg_dump -Fc` to a Hetzner Storage Box, encrypted with `age`. Keep 30 daily and 12 monthly copies.
- **Hourly:** a dump of only the money and bid tables (`deposits`, `deposit_transactions`, `buying_power_*`, `bids`, `bid_events`, `stripe_events`). This keeps the worst-case loss for those tables to about 1 hour.
- **Restore drill:** once before launch, then monthly, into a scratch database. Afterwards the ledger totals are checked against Stripe.
- **Later:** pgBackRest for restoring to any point in time.

**Server security:**
- SSH with keys only. Firewall open only for 22 (IP-restricted), 80 and 443. Unattended upgrades.
- Postgres and Redis are never published. **Tools reachable only through an SSH tunnel:** psql, drizzle-kit studio, redis-cli.

**Secrets:** a `.env` file owned by root, mode 600, never in git. Required variables:
- `APP_ENV` (`production` | `staging` | `demo` | `development`), `LOT_PROVIDER`, `KYC_PROVIDER`, `PAYMENT_PROVIDER`, `EMAIL_TRANSPORT`, `TELEGRAM_TRANSPORT` (production values: `apibara`, `ondato`, `stripe`, `resend`, `bot`; see "Local and demo environment")
- `DATABASE_URL`, `REDIS_URL`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `APIBARA_API_KEY`, `APIBARA_BASE_URL`
- `ONDATO_CLIENT_ID`, `ONDATO_CLIENT_SECRET`, `ONDATO_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM`, `TELEGRAM_BOT_TOKEN`
- `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `SENTRY_DSN`, `BETTERSTACK_HEARTBEAT_URL`
- `BACKUP_STORAGEBOX_*`, `BACKUP_AGE_RECIPIENT`

### Local and demo environment

The whole platform runs on one laptop from the same images as production. It serves two purposes: day-to-day development, and a **client demo** before anything is deployed.

**`infra/compose.yml` (dev):** `web` and `worker` (with hot reload in dev, or the production images with `--profile demo`), `postgres:17`, `redis:7`, and `mailpit` (catches all email, with a web inbox at `localhost:8025`). `docker compose up` followed by `pnpm db:migrate && pnpm db:seed:demo` gives a working site at `http://localhost:3000`.

**External services, locally:**

| Service | Local setup |
|---|---|
| Lot data | `LOT_PROVIDER=fixtures`: an adapter behind `LotDataProvider` that replays the recorded responses in `phase-0/trial-results/` (search, detail, change feed, sold results). `LOT_PROVIDER=apibara` uses the real API and spends quota. |
| Lot photos | Links to the auctions' image servers (B15). They load as long as the laptop is online. |
| Payments | **Default locally: `PAYMENT_PROVIDER=fake`**, a stand-in behind `PaymentProvider` (like fake KYC). Its checkout page has "Pay by card", "Bank transfer: mark received", "Fail" and, in /admin, "Refund" and "Open dispute". Each button produces the same normalised events the Stripe handlers consume (§4.2, §4.5), so deposits, buying power and refunds behave exactly as with Stripe. It needs no account and works offline. **`PAYMENT_PROVIDER=stripe`** uses test mode keys (the developer's own test account until the broker's exists): `stripe listen --forward-to localhost:3000/api/webhooks/stripe` delivers webhooks without a public URL. Test card `4242 4242 4242 4242`; bank transfers can be simulated from the Stripe dashboard. The M2 tests run against Stripe test mode. |
| KYC | `KYC_PROVIDER=fake`: a stand-in behind `KycProvider` with "Approve" and "Decline" buttons. It writes the same `kyc_checks` rows and webhook path as Ondato. The Ondato sandbox needs a public webhook URL (a cloudflared tunnel), so it is used only for M2 tests. |
| Email | Resend is replaced by SMTP to Mailpit (`EMAIL_TRANSPORT=smtp`). |
| Telegram | **Default locally: `TELEGRAM_TRANSPORT=log`**: messages are written to the worker log and shown in the /admin outbox view. `TELEGRAM_TRANSPORT=bot` uses the real Bot API with a test bot and a test chat. |
| Customer self-bidding (AuctionGate / BidManager) | Not integrated (D1). The broker keeps issuing shared accounts by hand outside the platform, as today. |
| Google sign-in | `http://localhost:3000` added as an allowed redirect URI on a dev OAuth client. |
| Turnstile | Cloudflare's published test keys, which always pass. |
| Sentry, Better Stack, backups | Off (variables left empty). |

**Demo seed** (`pnpm db:seed:demo`, idempotent, wipes only demo-tagged rows):
- Accounts: an admin, an operator (both with TOTP from a fixed test secret), customer A (verified, Pro plan, deposit paid) and customer B (verified, Standard plan, used for a takeover). Plus one new customer with no KYC, for the sign-up flow.
- Lots from the fixtures, with `sale_at` re-based to the seed time: some sell in 2–3 hours (live countdown), some tomorrow, one with no sale date, and a sold archive for the "similar cars sold for" range.
- Bids in every state the demo shows: pending, outbid, locked, placed, won with payment due, paid, and lost. Buying-power entries match, so the ledger totals add up.
- The published rate card from `phase-0/rate-templates/` and a fixed exchange rate, so landed prices match the drafts.

**Demo tools** (only when `APP_ENV=demo`, in a "Demo" panel in `/admin`): the bid rules use Postgres `now()`, so instead of faking the clock, these move a lot's timestamps:
- "Sale in N minutes" sets `sale_at` so the cutoff is close or has passed, then runs `bids.cutoff` immediately. This shows pending → locked live.
- "Run job now" for `bids.cutoff`, `bids.overdue`, `outbox.send` and `sync.results`.
- "Reset demo data" re-runs the seed.

With these, the full cycle (bid → takeover → locked → placed → won → paid → refund) takes about 10 minutes to show.

**Fully offline setup:** `LOT_PROVIDER=fixtures`, `KYC_PROVIDER=fake`, `PAYMENT_PROVIDER=fake`, `EMAIL_TRANSPORT=smtp`, `TELEGRAM_TRANSPORT=log` and the Turnstile test keys. This is the default in `.env.example`. Only Google sign-in and the lot photos need the internet. Email/password sign-in works without it.

**Safety:** the fixtures provider, fake KYC, fake payments, the Telegram log transport and the demo tools refuse to start when `APP_ENV=production`, and CI checks that the production image has `APP_ENV=production`. Demo data is tagged (`users.email` on the `@demo.invalid` domain, lots from the fixtures source) so a reset never touches real rows.

**Where it gets built:** compose with Mailpit in M1. Fake KYC in M2. The fixtures provider in M3 (it is also the test double for the M3 sync tests). The demo seed and the demo panel in M7, once the operator console exists, about 2 days. The first client demo can then run locally after M7, and again on staging, which the client can open from their own device.

---

## 7. Quality gates

### 7.1 Tests, by milestone

| Milestone | Tests (Vitest + Testcontainers unless noted) |
|---|---|
| M1 | Port the 13 cases in `db/constraint-tests.sql`, each checking the constraint name. Runs in CI. |
| M2 | Stripe: replayed event → one row. Events out of order (completed arrives after async_payment_succeeded) → one grant. `unpaid` checkout → no grant. Refund from /admin + webhook → one row. Dispute created then won → revoke then grant. |
| M3 | Sync: empty feed → no lots removed. Relist → new `lot_sales` row. Null VIN → separate vehicle. |
| M5 | Pricing: at least **5 real broker invoices covering both auctions** reproduced to within €1 per line. Fee-band boundaries (exactly at `price_from` and `price_to`). Reverse calculator round-trips. |
| M6 | Bids: a bid exactly at `sale_at − 60 min` → `BID_CLOSED`. Takeover at the same amount → `BID_TOO_LOW`, at +$1 → ok (and with the step set to $100: +$99 rejected, +$100 ok). A takeover bid can't be cancelled. **Concurrency:** 20 parallel bids from one user never go over buying power. 2 users bidding on one lot leave exactly 1 active bid. Crossing takeovers on two lots → both finish (with retries), no deadlock left behind. |
| M7 | Operator actions: two operators mark the same bid → one wins, the other gets "changed, refresh". |
| M9 | Playwright: sign up → KYC (sandbox) → deposit (test mode) → bid → takeover → cutoff → placed → won → paid → refund. |

### 7.2 Business alerts (the `alerts.check` job → `broker.alert` to the developer and the broker)

| Alert | Threshold |
|---|---|
| Sync is stale | No successful `sync.changes` run for 30 min |
| Bid missed | A bid still `locked` 5 min after its `sale_at` |
| Stripe backlog | `stripe_events` unprocessed for more than 5 min |
| Outbox failing | Any row `failed`, or more than 20 rows `queued` for over 5 min |
| Negative buying power | Any account where available < 0 |
| Data provider quota | `requests_used` this month > 80% of `provider.monthly_request_quota` |
| Unmatched bank transfer | Any (§4.2) |
| Worker down | Better Stack heartbeat missing for 3 min |

---

## 8. Roadmap

### Phase 0: Business inputs (start now, alongside M1–M2)

| Task | Blocks |
|---|---|
| apibara trial (`phase-0/apibara-trial-plan.md`) and **written scope from apibara** for public display, SEO, the archive and photos. Trial checks: IAAI fields match Copart's, final prices and sale outcomes, history depth, change feed includes removals, who hosts the image links and how long they stay valid after a sale (B15), quota for a full sync. Choose the plan tier. | M3 |
| The broker's rate spreadsheets, and which rates are still missing (D4) | M5 |
| Stripe account under the broker's company. Describe the deposit model to Stripe. Turn on bank transfers (EUR, SEPA) | M2 |
| Ondato contract and data processing agreement (D6) | M2 |
| Terms of service and privacy policy, with the bid rules (B11/B12) and the deposit, forfeit and refund wording exactly as built | M6 |
| Broker signs off on the data-licence risk. Broker answers `BROKER-QUESTIONS.md` | Launch. Until then the build uses the development defaults in §10 |

### Phase 1: MVP (≈ 18–19 weeks for one developer, the sum of the rows below)

The order puts work that doesn't depend on the data provider first, while the apibara trial runs.

| # | Milestone | ≈ weeks | Key files | Done when |
|---|---|---|---|---|
| M1 | Monorepo, compose, CI/CD to staging, Better Auth (roles, 2FA), i18n shell, `packages/db` with migrate + constraint tests in CI | 2 | `apps/web`, `apps/worker`, `packages/{db,config,i18n}`, `infra/*` | Staging is deployed from main. Sign-up creates user + profile + buying-power account. CI is green with M1 tests. |
| M2 | KYC + plans + Stripe deposits (plus the fake payment provider, about 1 day) + buying-power entries + webhooks + refunds/disputes | 3 | `packages/{billing,kyc}`, `/api/webhooks/*`, plan pages, admin deposits/plans | M2 tests pass. A test-mode deposit by card and by bank transfer grants the right buying power. |
| M3 | apibara adapter + sync jobs + `lots`/`lot_sales` | 3 | `packages/auctions`, `apps/worker/sync/*` | A full sync of the trial data runs. M3 tests pass. Freshness is shown in admin. |
| M4 | Search + lot pages (filters, document legend = the export-status colours, "updated X min ago" label). A custom migration enables `pg_trgm` and adds trigram indexes on `vehicles.make` and `vehicles.model` | 2 | `packages/search`, `packages/db/migrations/*_search.sql`, `/[locale]/search`, `/[locale]/lot/[source]/[id]` | p95 search < 500 ms on the full catalogue on staging. |
| M5 | Pricing + rate-card admin + calculator page + landed price on lot pages | 2 | `packages/pricing`, admin rate cards | M5 tests pass, using the broker's invoices. |
| M6 | Bidding transactions, rules, cutoff/reconcile/overdue jobs, outbox → email + Telegram | 2 | `packages/{bidding,notifications}`, bid UI | M6 tests pass, including concurrency. |
| M7 | Operator console + results + payment status + audit log | 2 | `/admin/console`, `/admin/bids` | M7 tests pass. The broker has done a dry run on staging. |
| M8 | Customer account: bids, plan, buying power, favourites, saved searches (**stored only**), refund request | 1 | `/[locale]/account/*` | Playwright flow for the account. |
| M9 | Hardening: alerts, backups, restore drill, security pass, M9 end-to-end test | 1–2 | `infra/backup/*`, runbooks | All §7.2 alerts fire in staging. Restore drill done. |

**Launch gate:**
1. The full M9 flow in **Stripe test mode**.
2. Then one **live-mode** deposit of the smallest plan, made by the broker and refunded.
3. For each deposit, the platform's payment and refund rows equal the **gross** charge and refund amounts in Stripe. Stripe fees are not compared.

### Phase 2
- Saved-search alerts (email and Telegram).
- Sold-price pages for SEO, and "similar cars sold for…".
- Vehicle history reports (once contracts allow).
- A referral programme.
- Buy Now requests (D8).
- Storing photos (R2), if expired links turn out to be a real problem (B15).
- Typesense, if M4's speed target is missed.

### Phase 3
- Customers bidding themselves (D1), subject to the integration trial and scope decision in §8.1.
- Restoring Postgres to any point in time.
- Free-text search turned into filters.
- A Telegram mini-app or mobile app.
- More destination ports.

### 8.1 Customer access automation investigation (D1)

**Public-source findings, investigated 2026-11-23 and recorded 2026-11-24. No authenticated API or broker-dashboard trial has been performed.** Automating customer access is separate from placing auction bids through an API. These findings establish an integration path to evaluate; they do not change the MVP bidding flow or delivery estimate.

| Option | Evidence | Still to confirm |
|---|---|---|
| **BidManager — investigate first because the broker already uses it** | Advertises customer codes, account assignments, bid limits and API keys. API access appears under the Company plan; the public API description covers retrieving customers, bids and invoices. [Features and plans](https://bidmanager.io/) | No public write-API documentation found for customer creation, code generation, assignments, limit updates or deactivation. Obtain documentation, plan entitlement and pricing. |
| **AuctionGate — strongest documented alternative** | Documents `POST /client-api/v1/sub-bidders/create` and `POST /client-api/v1/sub-bidders/update`, account assignment through `copart_account_uuid` / `iaai_account_uuid`, and `is_active: "off"`. Limits include `bet_limit`, `active_bids_limit` and `active_bids_sum_limit`. Uses a dashboard-generated Bearer token and documents a `purchase.created` webhook. [Client API documentation](https://auctiongate.io/client-api-documentation) | Subscription entitlement, pricing, runtime enforcement, cross-auction exposure and immediate session revocation need a trial. The purchase webhook alone does not establish live bid/exposure synchronization. |
| **Official Copart/IAA additional bidders or broker facilities** | Both provide routes for additional bidder access. [Copart membership terms](https://www.copart.com/help/content/us/en/member-terms-and-conditions), [IAA registration help](https://iaaicsr.my.site.com/IAAHelpPageMobile/s/article/How-do-I-register-to-bid?language=en_US) | No public customer-provisioning API found. Confirm eligibility, onboarding constraints and fit for customer access with the auction representatives. |
| **Auction Key** | Advertises managed customer access and limits. [Product site](https://auctionkey.app/) | No public provisioning API found; not yet evidence of an automated replacement. |

**BidManager next step:** request API documentation for creating customers, generating access codes, assigning accounts, updating limits and deactivating access, plus pricing and permitted integration scope. Its [published terms](https://bidmanager.io/terms-of-service) broadly restrict automated access despite advertising an API. Clarify supported API use with the vendor. Browser automation is a fallback to assess only with vendor permission; login expiry, MFA and interface changes add maintenance. Confirm the broker has customer-management permissions: a customer access code alone does not establish those permissions. Copart/IAA permission for the broker's account-sharing arrangement remains a separate D1 question.

**Proposed flow if D1 is adopted:** KYC approved + deposit confirmed → backend creates customer access → assigns auction accounts and limits → securely delivers access instructions. Eligibility changes trigger limit updates or suspension. Keep API credentials server-side, persist the provider's customer ID, and use queued jobs with duplicate protection, retries, reconciliation and an audit trail. Do not report access as ready until the provider confirms the required settings.

**Trial and adoption gates:**

1. Create an inactive test customer, assign accounts, read back settings, update limits and deactivate access. Verify what happens to an already-open session. Confirm suspension does not imply cancellation of existing bids.
2. Verify total exposure across Copart and IAA, simultaneous sessions, active bids and unpaid wins. A $10,000 per-bid cap must not allow five $10,000 commitments against $10,000 buying power. Establish how fees, Buy Now, wins and payments affect the limits.
3. Verify retry behavior, duplicate customer prevention, event deduplication and recovery after missed notifications. Check refund/dispute handling when the provider is unavailable; a local block alone must not be treated as confirmed remote suspension.
4. Decide where bidding authority and exposure accounting live. Direct bidding can bypass our one-active-bid-per-lot rule, cutoff and buying-power holds (§4.3). Resolve same-lot conflicts and double spending before allowing both assisted and direct bidding for a customer.
5. Broker confirms auction permission and commercial terms; developer records trial results. Re-scope bidding, reconciliation, schema and delivery estimates before moving D1 into implementation. Until then, retain B1 and the current MVP.

---

## 9. Database schema

`db/schema.ts` has 36 tables in 7 groups. The diagram is `db/schema.dbml`.

| Group | Tables |
|---|---|
| Auth (Better Auth) | `user`, `session`, `account`, `verification`, `two_factor` |
| Customers | `customer_profiles`, `kyc_checks` |
| Catalogue | `vehicles` (by VIN), `lots` (one auction listing), `lot_raw`, `lot_sales` (sold archive), `yards`, `sync_runs` |
| Plans & money | `plans`, `plan_versions`, `deposits`, `deposit_transactions`, `stripe_events`, `buying_power_accounts`, `buying_power_entries` |
| Pricing | `rate_cards`, `ports`, `auction_fee_bands`, `towing_rates`, `ocean_rates`, `fixed_fees`, `tax_rates`, `fx_rates`, `quotes` |
| Bidding | `bids`, `bid_events` |
| Features / admin | `favorites`, `saved_searches`, `notifications` (outbox), `site_settings`, `audit_log` |

**What the database enforces:**
- one active bid per lot (partial unique index, ⏳ A1);
- one active rate card;
- unique idempotency keys on bids, buying-power entries and admin deposit actions;
- one row per Stripe object and kind (a partial index; rows without a Stripe ID must have an admin idempotency key);
- non-negative buying-power totals;
- positive amounts;
- valid roles;
- foreign keys on every reference column.

**What application code enforces, inside the locked transactions of §4.3:** the cutoff, the takeover step, buying power and the plan limits.

**Conventions:**
- **Money:** whole cents, with the currency in the column name (`_usd_cents`, `_eur_cents`).
- **Two kinds of data:** provider data on `lots` is written only by sync. Staff-owned columns (`export_status_override`, `hidden_at`, `reviewed_at`) are written only by /admin.
- **"Snapshot"** means only a **bid's `lot_snapshot`**: a frozen copy of the lot as the customer saw it when bidding. Re-reading lots from the provider is called a **refresh** (`sync.refresh`).
- **Versions:** plans, published rate cards and terms are never edited in place. Each bid records the versions it used.

**Database during development (until the first production deploy):**
- No data needs to be kept: local, demo and staging databases hold only seed and test data. So a schema change never needs a hand-written data migration.
- Change `schema.ts` freely, then run `pnpm db:reset`. It drops the database, applies the migrations and runs `db:seed:demo`. Staging is reset the same way on deploy (`RESET_ON_DEPLOY=true`, refused when `APP_ENV=production`).
- `migrations/` may be deleted and regenerated as one file at any time. CI applies it to an empty database and runs the constraint tests.
- **Before the first production deploy:** squash everything into one `0000_baseline` migration. From then on the forward-only rule in §6 applies.

**Tooling:**
- `drizzle-kit generate` → review and commit `migrations/`, including `meta/`.
- The `migrate` container applies the migrations on deploy.
- `npx tsx dbml.ts` regenerates the diagram.
- `drizzle-kit studio` is used through an SSH tunnel only.

---

## 10. Open items

Each item has a **provisional default** that the build uses until it is answered.

| ID | Question | Owner | Provisional default | Blocks |
|---|---|---|---|---|
| **A1** | Instant takeover (+$1, any bigger bid), or sealed bids with the highest picked at the cutoff? | Broker | Instant takeover, and takeover bids can't be cancelled (§4.3) | M6 |
| D1 | Customers bidding themselves: confirm BidManager write API or trial AuctionGate's documented provisioning API (§8.1). Verify limits, revocation, exposure accounting and same-lot rules; obtain written Copart/IAA permission for the arrangement. | Broker + Developer | Assisted bidding remains the MVP. Evaluate BidManager first, AuctionGate if unsupported; adoption requires trial results and revised scope. | Phase 3 |
| D2 | What happens to active bids when a deposit is refunded or disputed? | Broker | Refunds from /admin are blocked while bids are active or a won car is unpaid. A Stripe-side refund or dispute revokes buying power at once; if available buying power goes negative, `alerts.check` alerts the broker (§4.5). Bids are not cancelled automatically. | M2/M6 |
| D3 | Does buying power come back after a won car is paid? | Broker | Yes, when the broker marks it paid (`bidding.restore_on_paid`) | M6 |
| D4 | Which rates does the broker not have yet, and what format are the spreadsheets in? | Broker | Missing rates show "price on request" | M5 |
| D5 | Broker alert recipients and channels | Broker | Email **and** Telegram, recipients set in Settings | M6 |
| D6 | Ondato or Veriff? | Developer | Ondato | M2 |
| ~~D7~~ | ~~Deposit currency~~ | | **Closed: deposit charged in EUR, buying power in USD (B14, revised 2026-11-21)** | |
| D8 | Buy Now: a request to the broker, or an instant win? | Broker | Not in the MVP | Phase 2 |
| D9 | Languages at launch | Broker | LT + EN | M1 |
| D10 | Plan tiers | Broker | Deposits in EUR (B14): Basic €1,350 → $10,000, 2 active bids. Standard €2,700 → $30,000, 5 bids. Pro €4,500 → $50,000, 10 bids. No per-lot cap. Editable in /admin. | M2 |
| D11 | Phone (SMS) verification on top of KYC? | Broker | No. The phone number is collected but not verified. | M2 |

### Development defaults

The build doesn't wait for the broker's answers (`BROKER-QUESTIONS.md`). Each question has a default, mostly the flow competitors already use: the customer leaves a max bid, staff bid for them, the highest max bid gets the car, the car is paid within days and shipped to Klaipėda. When an answer arrives, change the default, mark the question answered, and update the texts and screens.

**How to change it:**
- **Setting:** a `site_settings` key, changed in /admin.
- **Admin data:** rows edited in /admin or imported (plans, rate cards).
- **Code:** a change in one package. Add `db:reset` if the schema changes (§9).
- **Text:** copy on the site and in the terms only.

| Question | Development default | Change by |
|---|---|---|
| **A1** same car | Instant takeover, $1 step (any bigger bid wins), a takeover bid can't be cancelled (§4.3). Like VINAS, the highest max bid gets placed | Code in `packages/bidding` + drop the unique index + `db:reset` (§4.3, last paragraph) |
| 1.2 cancel / lower a bid | Raise any time, never lower, cancel until the cutoff except a takeover bid (B12) | Code |
| 1.3 how staff bid | Only as high as needed, up to the max (pre-bid or live). The site says "you may win for less" | Text |
| 1.4 cutoff | 60 minutes | Setting `bidding.cutoff_minutes` |
| 1.5 seller approval | Buying power stays held until staff mark it won or lost | Code |
| 1.6 lot sold or removed before the cutoff | Bid cancelled automatically, customer told (§4.1) | Code |
| D8 Buy Now | Not offered. The Buy Now price isn't shown | Code (Phase 2) |
| D10 plans | Basic / Standard / Pro as in the table above. The screen designs use different example numbers and will be aligned to these | Admin data, demo seed |
| 2.2 dealers | No dealer plan. A plan can be added in /admin later | Admin data |
| D3 buying power after payment | Comes back when staff mark the car paid | Setting `bidding.restore_on_paid` |
| D2 refunds with open bids | Blocked while bids are active or a won car is unpaid | Code (one check in `packages/billing`) |
| 2.5 refund timing | Back to the original payment method, no fee kept | Text |
| 2.6 unpaid car | Staff enter the forfeit amount (up to the whole deposit) and may block bidding (§4.5) | Admin action |
| 2.7 payment deadline | 2 US business days (Copart) / 4 (IAAI), 17:00 New York time | Code constants in `packages/bidding` |
| 2.8 deposit towards the car | Never | Not built |
| 2.9 plan upgrade | Pay the EUR difference, get the buying-power difference at once (§4.2) | Code |
| 2.10 Stripe | Fake payments locally. Developer's Stripe test account on staging until the broker's exists | Env (`PAYMENT_PROVIDER`, keys) |
| D1 self-bidding | Not built. The broker issues shared accounts by hand, outside the platform, as today | Phase 3 (§8.1) |
| D4 rates | The example rows in `phase-0/rate-templates/`. A missing rate shows "price on request" | Admin data (CSV import) |
| 4.3 customs | As in `tax_rates.csv`: 10% duty, 0% shown as a possibility for US-made VINs "with proof of origin". Import VAT 21% | Admin data |
| 4.4 export port | Cheapest port for the yard. The customer can pick another on the lot page | Code |
| 4.5–4.6 delivery | Klaipėda port only, "30–50 days" | Text, admin data |
| D5 broker alerts | Email (Mailpit locally) + Telegram (logged locally) | Setting |
| 5.2 staff | Any number of `operator` and `admin` logins, each with TOTP | Admin data |
| D9 languages | LT + EN | Code (translation files) |
| D11 phone | Collected, not verified by SMS | Code |
| 6.3 countries | Anyone in the EU may register. Delivery to Klaipėda only | Code |
| 7.1 contact details | Placeholders in brackets, e.g. "[Broker phone]" | Text (`site_settings` contact keys) |
| 7.2–7.3 badges | IAA Market Alliance badge shown; it must be confirmed before public launch. No Copart badge | Text |
| 8.1 catalogue access | Public, as on all competitor sites | Setting `catalogue.requires_sign_in` = false |
| 8.2 broker checks | Optional "checked by broker" and hide actions in /admin | Admin action |
| 9.1 terms | A draft terms page, `terms.current_version` = "draft". Each bid records the version accepted | Text, setting |
| 9.2 company | "Baltic Auto Shipping" in the footer, no registration details yet | Text |
