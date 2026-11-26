# Car Auction Platform — Implementation Plan

Version 1 · 2026-11-20 · Owner: Vytautas (solo developer)

Built on: `../car-auction-platform-research/` (notes 01–09), `../usa-car-auction-research/` (platform analysis, investigation checklist, CarsFromUSA analysis), a code review of the public vinasLT GitHub org, and a public-page review of abetter.bid. Every decision below was made in the 2026-11 planning interview. Section 10 lists the items still open.

Files in this folder:

| File | What it is |
|---|---|
| `IMPLEMENTATION-PLAN.md` | This document |
| `db/schema.ts` | Drizzle ORM schema, draft v1. **The source of truth for the database** |
| `db/migrations/0000_init.sql` | SQL generated from the schema, tested on PostgreSQL 17 |
| `db/schema.dbml` | Diagram file generated from the schema. Paste it into https://dbdiagram.io |

---

## 1. What the platform is (and isn't)

**It is** a catalogue of Copart and IAAI lots with a landed price in EUR for each lot. Customers buy a refundable deposit plan that unlocks buying power, then set **max bids**. The **broker places those bids by hand** on their own Copart/IAAI account.

**It is not** a purchasing or logistics system. When a bid reaches **Won**, everything after that (wire payment, towing, shipping, customs) happens off-platform between the broker and the customer. There are no orders, shipments, containers or invoices in this version.

```
apibara ──change feed──► worker ──► Postgres (lots, sold archive) ──► Typesense (search)
                                                                          │
Customer ──► Next.js: search · lot page + landed EUR · plans · max bid ◄──┘
               │
               ├─ Stripe Checkout (card / bank transfer) ──webhook──► deposit → buying power
               ├─ Ondato/Veriff ID check ──webhook──► KYC approved
               └─ max bid (one DB transaction) ──outbox──► broker email/Telegram + operator console
                                                              │
Broker ──► operator console: places bids on Copart/IAAI by hand, then marks placed / won / lost / paid
```

---

## 2. Decision log

| # | Decision | Why / notes |
|---|---|---|
| B1 | **Assisted bidding.** Customers set a max bid on the platform, and the broker places it by hand. | The broker has one Copart and one IAAI account. No bidding API exists. *Deferred:* customers bidding themselves through BidManager, AuctionGate or Copart's broker program. |
| B2 | **A plan is a refundable deposit, about 10% of buying power, with about 3 public plans plus custom dealer plans.** The deposit unlocks buying-power "chips". It is not a subscription. | The deposit covers the broker against Copart's ~10% penalty when a customer walks away from a car. |
| B2 | **Stripe sync works both ways.** A refund made in the admin panel calls Stripe. A refund or dispute made in the Stripe dashboard arrives by webhook and lowers buying power. **Forfeits and "apply to car price" are recorded only in the admin panel**, because they don't exist in Stripe. | The platform's buying power must always match the money actually held. |
| B2b | **Nothing on the platform after a win.** The broker sets won, lost and paid status by hand. Car payment is a bank wire straight to the broker. | Keeps the scope down to catalogue + bidding. |
| B3 | **apibara supplies both Copart and IAAI. Sold lots and final prices are kept** as the archive. | Check during the trial (Phase 0). |
| B6 | **One TypeScript modular monolith:** a Next.js web app plus one worker process, one Postgres, one Redis. | One developer. vinasLT's 16 services and ~46 containers are overhead without benefit. |
| B7 | **Own copy of every lot**, synced into Postgres and searched with **Typesense**. | Allows filtering and sorting by landed EUR price, keeps API cost the same as traffic grows, keeps the site up during apibara outages, and lets saved-search alerts run locally. Needs **apibara Pro ($70) or higher** for the change feed. |
| B8 | **The broker gets every bid in the console and as an instant email/Telegram message.** **Nightly `pg_dump` backups off the server**, with restore drills. | If the VPS dies on an auction night, the broker still has every bid in the messages. |
| B9 | **The calculator is a pure function in `packages/pricing` over versioned rate cards** that both the developer and the broker can edit. | The broker has most of the rates. Their spreadsheets decide the final table shapes. |
| B11 | **Same lot: one active internal bid.** A new bid must beat the current top bid by **at least $100**. The earlier bid becomes `outbid`, its buying power is released and that customer is notified. Ties go to the earliest bid. Amounts stay hidden. | A database unique index enforces this, unlike vinasLT, which never releases or notifies the losing customer. |
| B12 | **Cutoff 1 h before the live auction** for placing, raising and cancelling. Bids can be raised but never lowered. Cancelling is allowed until the cutoff. | The broker needs time to enter bids by hand. abetter.bid also uses 1 h. |
| B13 | **ID check (Ondato or Veriff) must pass before buying a plan or bidding. Deposits by card or Stripe bank transfer (virtual IBAN).** Buying power is granted only by the webhook, never by the browser redirect. No SEPA Direct Debit, no buy-now-pay-later. | Fraud and chargebacks: a bank transfer can't be reversed. |
| B10 | **Schema tooling:** the Drizzle schema is the source of truth. The DBML diagram is generated from it. `drizzle-kit studio` browses data. | See §9. |

**Risks accepted knowingly**

| Risk | Who carries it |
|---|---|
| Publishing scraped or unlicensed Copart/IAAI data and photos, plus an SEO archive, could put the broker's account at risk. | The client. Get this acknowledged in writing. |
| Card deposits can be charged back for up to ~120 days after payment. | The broker. ID check and disputes cutting buying power reduce it. |
| Nightly dumps mean up to 24 h of data can be lost. | Stripe and the broker's alert messages are partial recovery sources. |

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript everywhere (Node 24 LTS) | |
| Monorepo | pnpm workspaces + Turborepo | |
| Web | **Next.js** (App Router, RSC, server actions) | Lot pages rendered on the server for SEO. `/[locale]` routes through next-intl. The customer cabinet and admin live in the same app. |
| UI | Tailwind CSS + shadcn/ui, TanStack Table (admin), React Hook Form + zod | |
| Auth | **Better Auth** (self-hosted, Drizzle adapter) | Email/password, Google, TOTP 2FA (required for staff), admin plugin for roles, impersonation and bans. Passkeys later. |
| DB | **PostgreSQL 17** + **Drizzle ORM** + drizzle-kit migrations | Row locks and partial unique indexes enforce the bid rules. |
| Search | **Typesense** (self-hosted container) | Index active lots plus recently sold ones (e.g. 12 months). Older sold lots are served from Postgres. |
| Jobs | **Redis + BullMQ** in `apps/worker` | Sync, cutoff locking, the outbox sender, FX rates, alerts, index rebuilds. |
| Payments | **Stripe Checkout** (`mode=payment`, `card` + `customer_balance` bank transfer), Refunds, webhooks | One-off payments only, no Billing. |
| KYC | **Ondato or Veriff** behind a `KycProvider` interface | Pick on price and API (Phase 0). |
| Email | Resend + React Email | |
| Telegram | Telegram Bot API (broker alerts) | Customer alerts later. |
| Files | None needed for MVP | ID documents stay with the KYC provider. Add Cloudflare R2 when needed. |
| Edge | Cloudflare (DNS, WAF, Turnstile, cache), images hotlinked from the vendor/auction CDN | Don't store lot photos. |
| Observability | Sentry, pino logs, Uptime Kuma or Better Stack, **business alerts** (§7.4) | |
| Tests | Vitest (pricing, bid rules, **concurrency tests on real Postgres**), Playwright (critical flows) | |
| CI/CD | GitHub Actions → build images → GHCR → SSH `docker compose pull && up -d` | The same simple model as vinasLT, with one compose file. |

### Repository layout

```
repo/
├─ apps/
│  ├─ web/          Next.js: public site, customer cabinet, /admin (operator console)
│  └─ worker/       BullMQ: apibara sync, Typesense indexing, cutoff locker, outbox sender,
│                   Stripe/KYC event processor, FX fetch, saved-search alerts, freshness checks
├─ packages/
│  ├─ db/           Drizzle schema (this folder's schema.ts), migrations, seed
│  ├─ auctions/     LotDataProvider interface + apibara adapter + normaliser (Copart/IAAI → Lot)
│  ├─ pricing/      calculateLandedCost() + reverse calculator. Pure, 100% unit tested
│  ├─ bidding/      bid rules + state machine + placeBid/raise/cancel/takeover transactions
│  ├─ billing/      Stripe client, webhook handlers, deposit ↔ buying-power logic
│  ├─ kyc/          KycProvider interface + Ondato/Veriff adapter
│  ├─ search/       Typesense collection schema, document builder, query builder
│  ├─ notifications/ outbox writer, email templates, Telegram sender
│  ├─ i18n/         LT + EN messages
│  └─ config/       tsconfig, eslint, env validation (zod / t3-env)
└─ infra/           docker-compose.yml (+ .prod), Caddyfile, backup scripts, runbooks
```

---

## 4. Core flows

### 4.1 Lot sync (apibara → Postgres → Typesense)
1. **Change feed** every 1–5 minutes, more often for lots selling within 24 h. Upsert each lot on `(source, external_lot_id)`, update `lots.synced_at`, and keep the payload in `lot_raw`.
2. **Snapshot** of all active lots every few hours, to repair anything the change feed missed. **Never delete lots because a feed came back empty or failed.** Only mark a lot `removed` when the vendor explicitly says so.
3. **Sale results:** when a lot sells, insert a row in `lot_sales` (the archive).
4. **Side effects in the same job:**
   - lot sold or removed before the cutoff → cancel its `pending` bids, release their buying power, notify the customers;
   - `sale_at` changed → recompute `bids.cutoff_at` and notify the bidder;
   - a placed bid whose lot now has a sale result → show "vendor says sold at $X" next to it in the console (the broker still confirms the result).
5. Recompute `landed_estimate_eur_cents`, then push the lot to Typesense.
6. Every run is recorded in `sync_runs`, including the apibara requests used, to watch the quota.

### 4.2 Buying a plan
Requirements: email verified and KYC approved. The customer picks a plan, which creates a `deposits` row (pending) and a Stripe Checkout Session (card + bank transfer).

The `checkout.session.completed` (card) or `payment_intent.succeeded` / customer-balance webhook (bank transfer) goes into `stripe_events`. The worker then, in one transaction, sets the deposit to `succeeded`, adds a `deposit_transactions` payment row, adds a `buying_power_entries` grant, and updates the account totals.

An upgrade charges only the difference between the two plans' deposits.

### 4.3 Placing / raising / taking over a bid (one transaction)
```
BEGIN
  SELECT … FROM buying_power_accounts WHERE user_id=$u FOR UPDATE      -- serialises the user's requests
  check: KYC approved, not blocked, active plan, no unpaid won car (broker flag)
  check: lot not hidden, status upcoming/live, now < sale_at − 1 h
  check: max_bid ≥ vendor current bid; ≤ plan per-lot cap
  check: active bids < plan.max_active_bids (a raise doesn't count)
  check: available = granted − reserved − consumed ≥ (new amount − old amount)
  SELECT … FROM bids WHERE lot_id=$l AND status IN (active) FOR UPDATE
     another customer's bid exists → new ≥ top + $100, else reject ("another customer holds a higher bid")
     → mark it `outbid`, release that customer's power, outbox a notification to them
  INSERT/UPDATE bids (+ lot_snapshot, quote, terms_version, idempotency_key)
  INSERT bid_events, buying_power_entries(reserve), UPDATE account totals
  INSERT notifications (broker: email/Telegram)                         -- outbox, same transaction
COMMIT
```
The partial unique index `bids_one_active_per_lot_uq` is the backstop. Even with a bug in the code, the database cannot hold two live bids on one lot.

### 4.4 Cutoff → broker → result
- **Worker, every minute:** `pending` bids past their `cutoff_at` become `locked`, and the broker gets a digest of the auction session.
- **Broker in the console:** marks each bid `placed`, or `not_placed` (power released). Then, after the sale, marks it `won` (enter final price), `won_pending_approval`, or `lost` (power released).
- **Won:** the bid's buying power moves from reserved to consumed. The broker marks it `paid` or `overdue`. When an unpaid car is overdue, the broker can forfeit the deposit (admin panel) and block bidding.
- **Every change** writes `bid_events` and `audit_log`, and uses guarded updates (`UPDATE … WHERE status IN (…)`) so the broker and the worker never overwrite each other.

### 4.5 Refunds, disputes, forfeits
| Action | Where it starts | What happens |
|---|---|---|
| Refund | Admin panel | Stripe Refund API, then a deposit transaction and a buying-power revoke, all in one flow. |
| Refund | Stripe dashboard | A `charge.refunded` webhook records the same rows with origin `stripe_dashboard`. |
| Dispute | Stripe | A `charge.dispute.created` webhook **revokes buying power immediately** and alerts the broker. |
| Forfeit, apply to car price | Admin panel only | Deposit transaction + revoke. |
| Revoke while bids are open | Either | Available buying power goes negative. The customer is flagged and the broker alerted. Open item D2 covers what happens to the bids. |

### 4.6 Landed-cost calculator
`calculateLandedCost({ lot, bidUsd, rateCard, fx, options })` returns a list of line items and a total in EUR:
- hammer price
- auction fees (price bands)
- towing (yard → port)
- ocean freight (port → Klaipėda)
- broker fee + VAT
- customs duty
- import VAT
- customs agent
- unloading

It also returns a list of **possible extras**, shown separately: late payment, storage, title processing, EV surcharge.

The same function powers the lot page, the calculator page, the reverse calculator ("target € → max bid"), the precomputed search field, and the `quotes` row saved with every bid. Every result records the rate-card ID and FX rate used, so any number shown can be explained later.

---

## 5. Admin panel (`/admin`, same Next.js app)

Built in-house, not with a generic admin tool. Its most important screens are workflows (operator console, deposits). For rate tables, use a generic TanStack Table editor.

**Roles:** `admin` (you and the broker owner) and `operator` (broker staff who place bids). Staff accounts must use TOTP 2FA. **Step-up re-authentication** is required for refunds, forfeits, buying-power adjustments, role changes and exports.

| Screen | MVP | What it does |
|---|---|---|
| **Operator console** | ✅ | Upcoming sales grouped by auction, yard and time (Vilnius + yard time zone). One live bid per lot, with the customer, max bid, cutoff and a link to the Copart/IAAI page. One-click placed / not placed, then won (final price) / on approval / lost. Shows the vendor's result as a hint. |
| Bids | ✅ | All bids with filters and the full `bid_events` history. |
| Customers | ✅ | Profile, KYC status, plan, buying-power ledger, deposits, bids, notes, block/unblock bidding, impersonate (read-only support). |
| Deposits & payments | ✅ | Refund (calls Stripe), forfeit, apply to purchase, disputes, unmatched bank transfers. |
| Plans | ✅ | Public and custom plans. Editing a plan creates a new version. |
| Rate cards | ✅ | Edit a draft (fee bands, towing, ocean, fixed fees, taxes, ports), preview sample quotes, publish. |
| Lots | ✅ | Hide, mark reviewed, edit the export-status override, check sync health (last sync, quota used). |
| Settings | ✅ | Cutoff minutes, takeover step, broker alert channel and recipients, terms version. |
| Audit log | ✅ | Every staff action, with before and after values. |
| Content / CMS, broadcasts, Telegram channel posting | Later | |

---

## 6. VPS deployment

**One production VPS** in the EU, e.g. Hetzner with dedicated vCPUs: roughly 8 vCPU and 16–32 GB RAM to start. Size it after measuring Typesense memory with real lot volumes. Add **one small staging VPS**.

`docker-compose.prod.yml` (6 containers):

| Container | Notes |
|---|---|
| caddy | TLS, reverse proxy, security headers |
| web | Next.js standalone build. 2 replicas later if needed |
| worker | BullMQ processors and schedulers. Separate queues so **critical jobs** (cutoff, outbox, Stripe) are never stuck behind bulk sync |
| postgres:17 | Volume on local NVMe. Tuned `shared_buffers` |
| redis | AOF on. Queues only; no business state |
| typesense | Volume. Can be rebuilt from Postgres at any time |

- **Backups:** nightly `pg_dump -Fc` to off-server storage (Hetzner Storage Box or Cloudflare R2), 30 daily + 12 monthly copies, encrypted. **Restore drill:** once before launch, then monthly into a scratch database. Later: pgBackRest/WAL-G for point-in-time recovery.
- **Secrets:** `.env` on the server owned by root, mode 600, or Infisical/1Password. **Never in git.** vinasLT has Telegram bot tokens committed in its public history.
- **Server security:** SSH keys only, firewall (ports 80/443 + SSH), unattended upgrades, Postgres/Redis/Typesense never exposed publicly, admin tools only behind VPN or SSH tunnel.

---

## 7. Quality gates

### 7.1 Tests that must exist before launch
- Pricing: worked examples **matched to real broker invoices**, including fee-band boundaries.
- Bid rules: every rule in B11/B12, the cutoff edge, raise vs. new bid, takeover by +$99 and +$100, ties.
- **Concurrency:** 20 parallel bids from one user must never exceed buying power. 2 users bidding on one lot must end with exactly one active bid.
- Stripe: duplicate and out-of-order webhooks, refund from the dashboard, dispute.
- Sync: an empty or failed feed must not remove lots. Relists, postponed sale dates.

### 7.2 Business alerts (not just HTTP errors)
- No successful apibara sync for 30 min.
- Bids still `locked` when their sale has started.
- `stripe_events` unprocessed for more than 5 min.
- Outbox notifications failing.
- A customer with negative available buying power.
- apibara quota above 80%.

---

## 8. Roadmap

Week estimates assume one developer working full-time. Treat them as rough planning figures, not commitments.

### Phase 0: Business inputs (start now, runs alongside the build)
- [ ] apibara trial: IAAI fields match Copart's, final prices / sale outcome available, history depth, change feed includes removals, quota for a full sync. Decide the plan tier.
- [ ] The broker's rate spreadsheets (towing, freight, auction fees for their account type, customs/VAT assumptions). List the missing rates.
- [ ] Stripe account under the broker's company. **Describe the deposit model to Stripe** and enable bank transfers (EUR/USD) for Lithuania.
- [ ] Choose Ondato or Veriff (price, API, webhook). Sign a data processing agreement.
- [ ] Terms of service + privacy policy, with bid rules (B11/B12), deposit/forfeit/refund wording identical to what the code does.
- [ ] The client signs off on the data-licence risk.
- [ ] The broker answers the deferred items D1–D6.

### Phase 1: MVP (≈ 14–18 weeks)
| # | Milestone | ≈ weeks |
|---|---|---|
| 1 | Monorepo, docker-compose, CI/CD to staging, Better Auth, i18n shell | 2 |
| 2 | apibara adapter + sync worker + `lots`/`lot_sales` + Typesense indexing | 3 |
| 3 | Search + lot pages (SSR, filters, document legend, freshness label) | 2 |
| 4 | Pricing package + rate-card admin + calculator page + landed EUR in search | 2 |
| 5 | KYC + plans + Stripe deposits + buying-power ledger + webhooks | 2–3 |
| 6 | Bidding (transactions, rules, takeover, cutoff worker) + outbox → email/Telegram | 2 |
| 7 | Operator console + bid results + refunds/forfeits + audit log | 2 |
| 8 | Customer cabinet (bids, plan, buying power, favourites, saved searches) | 1 |
| 9 | Hardening: concurrency tests, backups and restore drill, alerts, security pass, launch | 1–2 |

**Launch gate:** a full rehearsal with real money on Stripe test and then live mode. Deposit → bid → takeover → cutoff → broker places → won → paid → refund. Ledger totals must match Stripe.

### Phase 2
Saved-search alerts (email + Telegram), sold-price SEO pages and "similar cars sold for…", vehicle history reports (Carfax/AutoCheck/VinAudit, once contracts allow), a referral programme (vinasLT has one), Buy Now requests, Telegram channel posting.

### Phase 3
Customers bidding themselves (BidManager/AuctionGate/Copart broker program, if approved), point-in-time Postgres recovery, AI natural-language search, Telegram mini-app or mobile app (extract an API), more destination ports and countries.

---

## 9. Database schema

`db/schema.ts`: 36 tables in 7 groups. The diagram is `db/schema.dbml`.

| Group | Tables |
|---|---|
| Auth (Better Auth) | `user`, `session`, `account`, `verification`, `two_factor` |
| Customers | `customer_profiles`, `kyc_checks` |
| Catalogue | `vehicles` (by VIN), `lots` (one auction listing), `lot_raw`, `lot_sales` (sold archive), `yards`, `sync_runs` |
| Plans & money | `plans`, `plan_versions`, `deposits`, `deposit_transactions`, `stripe_events`, `buying_power_accounts`, `buying_power_entries` |
| Pricing | `rate_cards`, `ports`, `auction_fee_bands`, `towing_rates`, `ocean_rates`, `fixed_fees`, `tax_rates`, `fx_rates`, `quotes` |
| Bidding | `bids`, `bid_events` |
| Features / admin | `favorites`, `saved_searches`, `notifications` (outbox), `site_settings`, `audit_log` |

**Design rules built into the schema:**
- **Money is stored as whole cents** in `bigint` columns, always with a currency. Rates and percentages use `numeric`. Never floats.
- **A vehicle and its auction listing are separate.** A VIN can be relisted or appear at both auctions without overwriting history. A relist under the same lot number gets a new `lot_sales` row.
- **Vendor data and platform data are separate.** Columns like `lots.current_bid_*` come from the vendor and are only ever written by sync. Bids hold their own `lot_snapshot`.
- **Buying power** = a lockable account row (`FOR UPDATE`) plus an append-only entry history.
- **Deposits** = a payment row plus a transaction row for every movement from either side of the Stripe sync. Unique on `(stripe_object_id, kind)`, so a replayed webhook can't double-count.
- **Constraints enforce the rules:**
  - one live bid per lot (partial unique index);
  - one active rate card;
  - a unique idempotency key on bids;
  - non-negative totals;
  - valid roles.
- **Versioning:** plans (`plan_versions`), rates (`rate_cards`) and terms (`bids.terms_version`) are never edited in place. Every bid records which versions applied.

**Tooling:**
- **Write:** edit `schema.ts`. `drizzle-kit generate` produces SQL migrations, which you review and commit. `drizzle-kit migrate` runs on deploy.
- **See:** `npx tsx dbml.ts` (drizzle-dbml-generator) regenerates `schema.dbml`. Paste it into dbdiagram.io for an ER diagram to share with the client. ChartDB or DrawDB are self-hostable alternatives.
- **Browse data:** `drizzle-kit studio`.
- **Before the first real migration:** regenerate the Better Auth tables with `npx @better-auth/cli generate` and compare them with this draft. Change the pricing tables to match the broker's spreadsheets.

---

## 10. Open items

| ID | Question | Owner | Blocks |
|---|---|---|---|
| D1 | Should customers bid themselves through BidManager, AuctionGate or Copart's broker program? Does Copart/IAAI confirm in writing that account sharing is allowed? | Client | Phase 3 |
| D2 | What happens to open bids when a deposit is refunded or disputed? | Broker | Milestone 5 |
| D3 | Does buying power come back after a won car is paid, and when? | Broker | Milestone 6 |
| D4 | Which rates are missing from "most"? What format are the spreadsheets in? | Broker | Milestone 4 |
| D5 | Broker alerts by Telegram or email (or both)? | Broker | Milestone 6 |
| D6 | Ondato or Veriff? | Vytautas | Milestone 5 |
| D7 | Deposit currency: USD (like the examples) or EUR? | Client | Milestone 5 |
| D8 | Buy Now: is it a request to the broker, or an instant win (vinasLT)? | Broker | Phase 2 |
| D9 | Languages at launch: LT + EN only? (Competitors also offer RU/PL/LV/UA.) | Client | Milestone 1 |
| D10 | Plan tiers: exact deposit and buying-power amounts, max active bids, per-lot caps | Client | Milestone 5 |
| D11 | Is phone (SMS) verification needed on top of the KYC check? | Client | Milestone 5 |
