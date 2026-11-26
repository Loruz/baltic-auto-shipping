# Goldfish Review Report

**Target:** `/Users/vytautas/Projects/car-auction-platform-plan/IMPLEMENTATION-PLAN.md`, version 2 (`lines 95-577`, from "## 3. Tech stack" to the end)

**Stage:** 9 (Implementation Readiness Test), round 2: a re-audit after the round-1 fixes.
**Standard:** `/Users/vytautas/.claude/plugins/cache/egm/egm/0.1.1/resources/document_standards/implementation-readiness-standard.md`
**Code checked against:** `db/schema.ts`, `db/migrations/0000_init.sql` and `migrations/meta/`, `db/constraint-tests.sql`, `db/drizzle.config.ts`, `db/dbml.ts`. This is a greenfield project, so the absence of application code is not a finding.
**Round 1:** `review/implementation_readiness_report.md`. Its line numbers refer to `review/IMPLEMENTATION-PLAN.v1.md`. All line numbers in this report refer to v2.

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `egm-implementation-readiness` | completed |
| `egm-codebase-details` | completed |
| `egm-style` | completed |

All three reviewers returned a report on their first run, so no retries were needed. Two notes on coverage:
- The style reviewer did not read the four research files listed as background. None of its findings depends on them.
- The implementation-readiness reviewer only skimmed two of those files.

**Severity breakdown (after deduplication):** 2 Blocker, 22 Major, 28 Nit (52 findings).

**Verdict: not ready for implementation yet, but much closer than v1.** v2 fixes the round-1 problems with the bid status names, the export-status override, the deadlock when placing a bid, the currency question, the milestone order and arithmetic, the provisional defaults, the settings keys, the environment variables and the migration tooling. Two Blockers remain:
1. There is still no list of exact files.
2. The sync mapping rule ("unknown values map to `unknown`") would fail against two of the enums.

Most Major findings are new edge cases that v2's added detail exposes:
- The postponement rules contradict the bid transition table.
- Takeover doesn't check the top bid's status.
- Lock order is defined only for placing a bid.
- Idempotent replays are treated as conflicts.
- The buying-power accounting is incomplete.
- The quote insert can fail.
- The Postgres search spec (needed since decision A2) is missing.

**The provisional A1 design:** the reviewers found it consistent with `bids_one_active_per_lot_uq` and constraint test T2, except for three things:
- the missing top-bid status check (implementation-readiness-2-2);
- the takeover branch, which doesn't reserve the new bidder's amount (style-2-6);
- the sealed-bid alternative, which needs a replacement index (codebase-details-2-16).

**Checked and correct** (so they are not reported):
- **Tables:** 36 tables in 7 groups. Every table name in §9 matches the schema and the migration.
- **Enums:**
  - all 9 `bid_status` values, and the split into active and final;
  - `bid_payment_status`, `deposit_status`, `deposit_tx_kind`, `tx_origin`, `notification_status` and `sale_outcome`;
  - the buying-power entry kinds;
  - the roles.
- **Columns:** every column the plan names, including:
  - `export_status_override`, `refund_requested_at`, `closed_at` and `upgrades_deposit_id`;
  - `sale_at_when_placed`, `cutoff_at`, `terms_version`, `quote_id`, `outbid_by_bid_id`, `payment_due_at`, `paid_marked_at` and `is_buy_now`;
  - `next_attempt_at`, `requests_used`, `impersonated_by` and `banned`.
- **Constraints and indexes:**
  - the upsert key `(source, external_lot_id)`;
  - `lot_sales` unique on `(lot_id, sale_at)`;
  - `stripe_events_unprocessed_idx`;
  - `deposit_tx_stripe_kind_uq` (partial), `deposit_tx_dedupe_chk` and the unique `deposit_transactions.idempotency_key`;
  - `rate_cards_one_active_uq`, `bp_accounts_nonneg_chk`, the positive-amount checks and `user_role_chk`.
- **Bid transaction:** the takeover order (outbid, then insert, then link) matches test T2. Locking the lot first, then accounts in `user_id` order, removes the crossing-takeover deadlock.
- **Tooling:** `drizzle.config.ts`, `dbml.ts`, `_journal.json` and the snapshot exist. `npx tsx dbml.ts` matches.
- **Constraint tests:** 13 cases, and the file exits non-zero on failure.
- **Arithmetic:**
  - The Phase 1 total is 2+3+3+2+2+2+2+1+(1–2) = 18–19 weeks.
  - The revoke example: $150 × 10,000 / 1,500 = $1,000.
- **Migration against schema:** they agree on every enum (including value order), table, column, check, index and foreign key that the plan relies on.

**How findings were merged:** when two or more reviewers raised the same issue, the finding takes the id of the reviewer with the most complete version, and the others are listed under "Also raised by". Ids are numbered per reviewer: `implementation-readiness-2-n`, `codebase-details-2-n`, `style-2-n`.

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 🔴 Blockers

### implementation-readiness-2-1: There is still no list of exact files to create, change or delete - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`). **This is round-1 implementation-readiness-1-1, partly fixed.**
* **Affected Scope:** Lines 116-137 and 485-495.
* **Discrepancy Description**:
  * Line 137 now says where the `db/*` drafts go, which is good. Apart from that, the "Key files" column still names only directories and globs, such as `apps/web`, `packages/{db,config,i18n}`, `infra/*`, `/api/webhooks/*` and `apps/worker/sync/*`.
  * Some entries are just words: "plan pages", "admin deposits/plans", "bid UI", "runbooks".
  * Some entries are URL routes, not file paths: `/admin/console`, `/[locale]/account/*`.
  * None of these is named: the Dockerfiles (web, worker, migrate), the `.github/workflows/*.yml` files, the Caddyfile path, test files, or the Next.js route and server-action files.
  * The standard asks for exact repo-relative paths per milestone that can serve as a write allowlist. It allows globs only for generated output.
* **Rationale & Recommendation**: For each milestone, add a table of repo-relative paths marked Create, Modify or Delete, with one line on what each file holds. For example: `apps/web/app/[locale]/lot/[source]/[id]/page.tsx`, `packages/bidding/src/placeBid.ts`.

### codebase-details-2-1: "Unknown values map to `unknown`", but `lot_status` and `sale_outcome` have no `unknown` value - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 154. Schema: `schema.ts` 58-65 (`lot_status`) and 82 (`sale_outcome`); `0000_init.sql` 12 and 19.
* **Discrepancy Description**:
  * Only `export_status` and `odometer_brand` have an `unknown` value.
  * `lot_status` is (upcoming, live, sold, on_approval, not_sold, removed).
  * `sale_outcome` is (sold, on_approval, not_sold, cancelled).
  * Following the rule as written raises an enum error during sync, so the sync job would crash on the first unrecognised value from the data provider. The synthesizer confirmed this against `schema.ts`.
* **Rationale & Recommendation**: Give a fallback for each enum. For example, an unknown lot status keeps the current status and raises an alert, and an unknown sale outcome skips the row and logs it. Alternatively, add `unknown` to both enums and regenerate the migration.

### 🟡 Major

### implementation-readiness-2-2: Takeover and raise don't check the status of the current top bid ⏳ A1 - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 222 and 235-244. Related: 180 and 183. Schema: `schema.ts` 836-838.
* **Discrepancy Description**:
  * The "Lot open" check looks only at the lot's status and time.
  * After a relist or a postponement (lines 180 and 183), a lot can be `upcoming` again while its active bid is still `locked`, `placed` or `won_pending_approval`.
  * The pseudo-code takes "top" from any active status. So it would:
    * TAKEOVER a `placed` or `won_pending_approval` bid, marking it `outbid` and releasing its buying power while the broker's real bid is still live at the auction (`placed → outbid` is not an allowed edge in §4.4);
    * RAISE the customer's own `placed` bid, which is also not an edge in §4.4.
  * This is an inconsistency in the provisional A1 design, not a complaint that A1 is undecided.
* **Rationale & Recommendation**: Allow RAISE and TAKEOVER only when `top.status = 'pending'`. Otherwise reject with `BID_CLOSED` or a new code such as `LOT_IN_PROGRESS`. Add an M6 test for it.

### codebase-details-2-2: The sync-event table contradicts the bid transition table, and a postponement case is missing - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`, `egm-style`). **Part of round-1 codebase-details-1-6 and implementation-readiness-1-5 is still open here.**
* **Affected Scope:** Lines 177-183 against 266-279.
* **Discrepancy Description**:
  * **Edges that don't exist.** Line 179 lets the operator choose `not_placed` or `lost` for both `locked` and `placed` bids. §4.4 has no `locked → lost` edge and no `placed → not_placed` edge, so the guarded updates on line 281 would reject them.
  * **Reopening a placed bid.** Line 180 sends `locked` **and `placed`** bids back to `pending`, but §4.4 has only `locked → pending`. A `placed` bid already sits at the auction. Making it `pending` would let the customer cancel it, or let someone take it over.
  * **Meaningless condition.** "If the new cutoff is later" is always true when the sale moves later. It presumably means "if the new `cutoff_at` > now()".
  * **Missing case.** The sale moves earlier but the new cutoff is still in the future. Nothing updates `cutoff_at`, so `bids.cutoff`, which reads `bids.cutoff_at`, would lock the bid too late, possibly after the sale.
  * **Unanswered from round 1.** Is `sale_at_when_placed` updated when the sale moves?
* **Rationale & Recommendation**:
  * Make §4.4 the single source of truth, and make the two tables agree edge for edge.
  * Allow the return to `pending` only from `locked`.
  * Add the row "moved earlier, cutoff still ahead → update `cutoff_at`, notify the customer".
  * State whether `sale_at_when_placed` changes.

### implementation-readiness-2-3: Lock order and retries are defined only for placing a bid, so the other bid and money transactions can still deadlock - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`. **Round-1 implementation-readiness-1-3 is fixed for placing a bid only.**
* **Affected Scope:** Lines 227-230, 256, 281 and 301-306.
* **Discrepancy Description**:
  * A customer cancel is a guarded `UPDATE bids`, which locks the bid row, followed by an account update.
  * A takeover on the same lot locks the lot, then accounts A and B, then updates that same bid row.
  * The two take the locks in opposite order and can deadlock.
  * The same risk applies to:
    * the `bids.cutoff` and `bids.reconcile` jobs;
    * operator won and lost actions;
    * refund, forfeit and dispute revokes.
  * The retry on 40P01 is defined only for placing a bid.
* **Rationale & Recommendation**:
  * State one global lock order: lot, then bid rows, then buying-power accounts in `user_id` order.
  * Every transaction that changes a bid takes the lot lock first.
  * Apply the 3-retry policy to all of these transactions.

### codebase-details-2-3: A retried request gets an error instead of the original result - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`). **Round-1 codebase-details-1-4 is partly open here.**
* **Affected Scope:** Lines 230 and 247. Schema: `bids_idempotency_key_unique` (`schema.ts` 830, `0000_init.sql` 102) and `buying_power_entries_idempotency_key_unique` (`schema.ts` 620, `0000_init.sql` 128).
* **Discrepancy Description**:
  * Because the lot row is locked first, `bids_one_active_per_lot_uq` can hardly raise 23505. The realistic 23505 is a replayed request hitting an idempotency key.
  * Line 230 retries that 3 times, then returns `BID_CONFLICT_RETRY`. So a double-click on a bid that actually succeeded is reported to the customer as a failure.
  * For a raise, the bid row keeps its original key. Only the "request key + kind" entry key records the raise.
  * The plan doesn't say which client-generated key each action takes.
* **Rationale & Recommendation**:
  * Branch on the constraint name. For `*_idempotency_key_unique`, look up the existing row and return the original outcome.
  * Retry only on 40P01, 40001 and `bids_one_active_per_lot_uq`.
  * Name the key each action takes.

### implementation-readiness-2-4: The buying-power ledger is incomplete: revokes can go negative, `adjust` can't subtract, and a forfeit leaves the consumed amount stuck - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`, `egm-style`). **Round-1 codebase-details-1-5 and codebase-details-1-8 are partly open here.**
* **Affected Scope:** Lines 225, 266-279 (especially 276), 286-287, 294-296, 304 and 364. Schema: `bp_accounts_nonneg_chk` (`0000_init.sql` 113), `bp_entries_amount_chk`, `consumed_usd_cents` (`schema.ts` 593).
* **Discrepancy Description**:
  * **No entry-kind mapping.** The plan never says which account total each entry kind changes (granted, reserved or consumed).
  * **Consume wording.** "`consume` the reserved amount, `release` the rest" (line 276) contradicts itself: if the whole reservation is consumed, nothing is left to release. The intended meaning is presumably consume = `final_price_usd_cents` and release = max bid − final price. No rule rejects a hammer price above the max bid.
  * **Revoke can go negative.** The `ceil` revoke formula, applied across several actions, can revoke more than the deposit granted. Example: a $150 forfeit revokes $1,000, then a full $1,500 dispute revokes another $10,000. `granted_usd_cents` goes below 0, and `bp_accounts_nonneg_chk` aborts the `stripe.process` handler.
  * **`adjust` can only add.** Amounts must be positive, so a manual adjustment (step-up action, line 364) can't lower buying power.
  * **Forfeit leaves power stuck.** A forfeit of a won car never releases or restores that bid's consumed amount, because restore happens only on `paid`. The account stays negative, and the "Negative buying power" alert (line 461) fires forever.
* **Rationale & Recommendation**:
  * Add an entry-kind → column-change table.
  * Spell out the consume and release amounts, and reject a hammer price above the max bid (or define what happens).
  * Cap each revoke at what the deposit still has to revoke.
  * Give `adjust` a sign rule, or split it into increase and decrease.
  * State which entry a forfeit writes for the consumed amount.

### codebase-details-2-4: The bid transaction fails whenever the calculator gives no total - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Line 245 against lines 324 and 336. Schema: `quotes.total_eur_cents` and `rate_card_id` are NOT NULL (`schema.ts` 784-791, `0000_init.sql` 360 and 365). `bids.quote_id` is nullable (`schema.ts` 815).
* **Discrepancy Description**:
  * When a towing or ocean rate is missing, the calculator returns "price on request" with no total. This is D4's default.
  * The bid transaction always inserts a quote, so every bid on such a lot aborts. The same happens when no rate card is active.
  * It isn't said whether the server recomputes the quote inside the transaction or takes it from the confirmation screen. If the server recomputes, nothing says what happens when the result differs from what the customer saw.
* **Rationale & Recommendation**:
  * State that `quote_id` stays NULL when there is no total, or that the bid is rejected with a named code.
  * State that the server recomputes the quote with the active rate card and FX rate, and give the rule for when the result differs from what the customer saw.

### implementation-readiness-2-5: The calculator's VAT base, percent units, currency conversion and FX direction are undefined - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`, `egm-style`). **Round-1 implementation-readiness-1-7 is partly open here.**
* **Affected Scope:** Lines 315-316 and 320-334. Schema: `fixed_fees` (`schema.ts` 730-747, `0000_init.sql` 202-213), `auction_fee_bands.percent`, `tax_rates`, `fx_rates`.
* **Discrepancy Description**:
  * **VAT base.** `import_vat` uses "fixed fees marked for the VAT base", but `fixed_fees` has no such column.
  * **Percent fees.** The base for `fixed_fees.percent` is undefined.
  * **EV surcharge.** `options.ev` has no matching column, and `vehicle_type` has no EV value.
  * **Percent units.** "bid × percent" and "× tax_rates[…]" don't say whether the stored values are fractions or whole percentages. The schema comment "21.00" for `vat_rate` (`schema.ts` 742, confirmed) means whole percentages, so applying the formula literally makes those lines 100 times too large.
  * **Currency.** `lines` mix USD and EUR, but line 333 says "the total is the sum of the rounded lines" into `totalEurCents`. There is no conversion step, and no rule on whether to round before or after converting.
  * **FX direction.** The ECB publishes USD per EUR. The plan doesn't say which direction `fx_rates` stores or how `usdToEur` is derived.
  * **Unclear filters and columns:**
    * whether towing is filtered by vehicle type;
    * which row wins between a vehicle-specific and an all-types `fixed_fees` row;
    * whether `tax_rates.basis` is used.
* **Rationale & Recommendation**:
  * Add an `in_vat_base` boolean (or list the fee codes in the plan).
  * Define percent units and the base for percent fees.
  * State the order: round each USD line, convert it to EUR, round half up, then sum.
  * Write "`usdToEur` = 1 / ECB EUR→USD rate on the latest date ≤ today".
  * State the precedence rules, and that `basis` is informational only.

### codebase-details-2-5: The reverse calculator has no upper bound under the default plans - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Line 335 against line 576 (D10: "No per-lot cap"). Schema: `max_bid_per_lot_usd_cents` is nullable, and NULL means no cap (`schema.ts` 472).
* **Discrepancy Description**:
  * The search runs "between $0 and the plan's per-lot cap". None of the default plans has a cap, and an anonymous visitor to the calculator page has no plan at all.
  * It also isn't said what the search returns when the forward total is "price on request".
* **Rationale & Recommendation**:
  * Use the cap if it is set. Otherwise use min(available buying power, a fixed ceiling such as $200,000, or a site setting).
  * State that the reverse calculator returns no result when the forward total is undefined.

### codebase-details-2-6: Postgres search (decision A2) has no spec, and no migration creates its extension or indexes - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Lines 104, 130 and 490. Migration: `0000_init.sql` has no `CREATE EXTENSION pg_trgm` and no GIN or trigram index. Make and model have only the B-tree `vehicles_make_model_idx` (`schema.ts` 335, `0000_init.sql` 608). The lot number is indexed only through the composite `lots_source_external_uq`, which leads with `source`.
* **Discrepancy Description**:
  * M4 has only "filters" and a p95 target under 500 ms.
  * Not listed: the filter fields, sort orders, facets ("facet counts" on line 130), pagination, or how a make/model search on `vehicles` joins `lots`.
  * It isn't said whether search filters on `coalesce(export_status_override, export_status)`.
* **Rationale & Recommendation**:
  * Add a search contract: a filter → SQL table, the sorts, the facets, and keyset or offset pagination.
  * List the M4 migration: `pg_trgm`, a trigram index on make/model, an `external_lot_id` index, and the filter indexes.

### codebase-details-2-7: Vehicle matching creates a new vehicle on every sync and can collide on invalid VINs - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`. **Part of round-1 codebase-details-1-6.**
* **Affected Scope:** Lines 167-170. Schema: `schema.ts` 314 and 334; `0000_init.sql` 607.
* **Discrepancy Description**:
  * **Duplicate rows.** "No VIN, or an invalid one → create a separate vehicle for the lot" doesn't say to reuse the lot's existing `vehicle_id` on later syncs. Read literally, every 5-minute `sync.changes` run creates a new `vehicles` row for every lot without a VIN.
  * **Collisions.** If an invalid VIN is stored as-is, `vehicles_vin_uq` makes two lots with the same invalid string fail.
  * **Conflicting data.** It isn't said which lot's make, model and year win when one vehicle appears on several lots.
* **Rationale & Recommendation**:
  * Store `vin = NULL` for an invalid VIN (the raw value stays in `lot_raw`).
  * Reuse `lots.vehicle_id` when the lot already exists.
  * State the rule for which lot's data wins.

### implementation-readiness-2-6: Stripe event processing has no failure policy, no matching rule for unmatched transfers, and incomplete column writes - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`). **Round-1 codebase-details-1-7 is partly open here.**
* **Affected Scope:** Lines 199-211. Schema: `deposits` (`schema.ts` 508-511), `stripe_events.error`.
* **Discrepancy Description**:
  * **Failure policy.** If a handler throws, the plan doesn't say:
    * whether `stripe_events.error` is set;
    * whether the event is retried;
    * whether "oldest first" stalls behind one bad event.
  * **Unmatched transfers.** "`customer.cash_balance_transaction.created` that doesn't settle a session" has no matching rule. Stripe sends a `funded` transaction and then, separately, an `applied_to_payment` one.
  * **Column writes.** These are still not specified:
    * `stripe_checkout_session_id`, `stripe_payment_intent_id`, `succeeded_at` and `payment_method = 'card'`;
    * the idempotency key for the grant entry;
    * that a grant happens only when the payment row is actually inserted.
  * **Late events.** A late `completed/unpaid` event must not overwrite a deposit that is already `succeeded`.
  * **Charge lookup.** How a charge is matched to its deposit isn't defined.
  * **Unverified behaviour.** Two points are not checked against Stripe's docs:
    * whether `charge.refunded` includes the list of refunds in current API versions;
    * whether refunds of `customer_balance` payments go back to the cash balance first.
* **Rationale & Recommendation**:
  * Specify retries per event, for example 5 tries with backoff, then `error` set, an alert, and the event skipped.
  * Define the unmatched-transfer rule, for example: a `funded` transaction with no `pending` bank-transfer deposit, or one not applied within N minutes.
  * List the column writes for each event.
  * Make status transitions forward-only.

### implementation-readiness-2-7: How sign-up creates the extra rows "in the same transaction" isn't specified - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 189 and 487.
* **Discrepancy Description**:
  * Better Auth creates the user, including through Google sign-in, inside its own adapter call.
  * The plan doesn't name the mechanism (for example `databaseHooks.user.create.after`), or confirm that it really shares the insert transaction.
  * If it doesn't, a failure leaves a user with no `buying_power_accounts` row. Bidding would then lock nothing, which is the round-1 implementation-readiness-1-3 problem again.
* **Rationale & Recommendation**:
  * Name the hook.
  * Add a fallback: create the rows with `INSERT … ON CONFLICT DO NOTHING` before any lock is taken, plus a repair query.

### implementation-readiness-2-8: The outbox templates don't cover the messages the transition table requires, and the session digest is undefined - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-style`, `egm-codebase-details`). **Round-1 implementation-readiness-1-10 and style-1-16 (the digest part) are partly open here.**
* **Affected Scope:** Lines 266-279, 284-287, 272 and 351-355. Schema: `schema.ts` 912.
* **Discrepancy Description**:
  * **Messages with no template:**
    * customer "bid accepted" ((new) → `pending`, line 268);
    * a customer cancelling their own bid (line 271; `customer.bid_cancelled_lot_gone` covers only the system cancel);
    * `placed → won_pending_approval` (line 277);
    * `locked → pending` (line 273; presumably `customer.sale_moved`, but this isn't stated);
    * a takeover, for the broker;
    * payment overdue, paid, forfeited and blocked;
    * deposit failed or expired;
    * dispute;
    * KYC result.
  * **Name mismatch.** The schema comment uses `broker.bid_placed`, but the plan uses `broker.bid_new`.
  * **Missing details.** Payload fields per template and customer channels are not defined.
  * **Session digest.** `broker.session_digest` has no trigger and no contents. `bids.cutoff` runs every minute and locks bids one at a time, so it is unclear whether one digest is sent per bid or one per session.
* **Rationale & Recommendation**:
  * Make the template list match §4.4 and §4.4's payment section.
  * Give the payload fields for each template.
  * Define the digest trigger, for example once per auction session when its first bid locks, deduplicated by a session key, and list its contents.
  * Align the schema comment.

### implementation-readiness-2-9: Routes, server actions, per-action roles and step-up storage are still undefined - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (the step-up storage part also raised by `egm-codebase-details`). **Round-1 implementation-readiness-1-8 is partly open here.**
* **Affected Scope:** Lines 362-377. Schema: `session` (`schema.ts` 175-191, `0000_init.sql` 390-401), and the header note that the Better Auth CLI output wins for auth tables (`schema.ts` 24-26).
* **Discrepancy Description**:
  * **Fixed in v2:** `defaultRole`, the settings keys and the read-only impersonation rule.
  * **Still missing:**
    * a route and server-action table (names, inputs, error codes) for placeBid, raiseBid, cancelBid, buyPlan, upgrade, requestRefund and every admin action;
    * how "required TOTP" is enforced for staff who haven't enrolled yet;
    * which role may do each payment-status action. The Bids screen allows operators, but forfeit is admin with step-up.
  * **Step-up has nowhere to live.** "Valid for 10 minutes (a custom check on the session)" needs a stored timestamp. `session` has no such column, and a hand-added column would be lost when the CLI output replaces the auth tables.
* **Rationale & Recommendation**:
  * Add a routes and actions table, with roles for each action.
  * Name the step-up mechanism, for example a Better Auth `session.additionalFields.stepUpAt` with its migration, or a signed cookie.
  * State how staff enrolment in 2FA is forced.

### codebase-details-2-8: Outbox stuck-row recovery has no column to measure from - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 349. Schema: `notifications` (`schema.ts` 905-923, `0000_init.sql` 289-303).
* **Discrepancy Description**: "Rows left in `sending` for more than 10 min" needs a claim time. `notifications` has no `claimed_at` or `updated_at` column.
* **Rationale & Recommendation**: Add a `claimed_at` column. Alternatively, state that claiming a row sets `next_attempt_at = now() + 10 min`, and that recovery uses that.

### codebase-details-2-9: The hourly partial backup can't be restored because its rows depend on tables it doesn't include - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-style`)
* **Affected Scope:** Line 418. Migration foreign keys:
  * `bids` → `user`, `lots`, `quotes`, `plan_versions` (`0000_init.sql` 526-529);
  * `deposits` → `user`, `plan_versions` (542-543);
  * `buying_power_accounts` → `user`, `plan_versions` (533-534).
* **Discrepancy Description**:
  * Rows created since the last daily dump point at users, lots, quotes or plan versions that are only in the daily dump.
  * Restoring them fails on those foreign keys, so the claim "worst-case loss for those tables about 1 hour" doesn't hold.
* **Rationale & Recommendation**:
  * Add `user`, `customer_profiles`, `quotes`, `lots`, `vehicles` and `plan_versions` to the hourly set, or document a restore procedure that handles the missing parents.
  * Test it in the restore drill.

### codebase-details-2-10: Refunds and forfeits are undefined when a customer has several deposits after an upgrade - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Lines 195 and 294-306. Schema: `deposits.upgrades_deposit_id` (`schema.ts` 500-502). Each deposit has its own `stripe_payment_intent_id`.
* **Discrepancy Description**:
  * After an upgrade, a customer has two or more deposits and PaymentIntents.
  * "Refund" and "Forfeit (default: everything left on the deposit)" don't say:
    * which deposit is used, or in what order;
    * that a full refund means one Stripe refund per PaymentIntent;
    * what happens to `buying_power_accounts.plan_version_id` after a partial exit.
* **Rationale & Recommendation**: Define the order (for example, newest deposit first), state that one refund is made per PaymentIntent, and give the plan-version rule after a partial exit.

### implementation-readiness-2-10: Tests are missing for several specified behaviours - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`. **Round-1 implementation-readiness-1-11 is partly open here.** Milestones now have "Done when" criteria and named cases.
* **Affected Scope:** Lines 443-451.
* **Discrepancy Description**:
  * **No test for:**
    * raise;
    * cancel (beyond the single takeover line);
    * the cutoff job;
    * each `bids.reconcile` event row;
    * the payment due-date calculation (weekend, 17:00 New York);
    * revoke rounding (`ceil`) and a partial forfeit;
    * "refund blocked while bids are active";
    * the upgrade grant;
    * KYC webhook approve and decline;
    * outbox backoff and the stuck-row reset;
    * a calculator line with "price on request".
  * M4 and M8 have no functional cases.
  * M3 has no case for a VIN change, or for "removed only on an explicit signal".
* **Rationale & Recommendation**: Add given / when / expect cases for each item.

### style-2-1: §7.2 says every alert comes from `alerts.check`, but some can't - Severity: Major
* **Reviewer Lens:** `egm-style` (the recipient part also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 453 and 463-464. Related: 210, 285, 303 and 383-384.
* **Discrepancy Description**:
  * **Worker down.** This alert can't be raised by a job that runs on the worker that is down. Better Stack raises it, through its own channel.
  * **Unmatched bank transfer.** `stripe.process` already raises this inline (line 210), so there are two sources and a risk of sending it twice. There is also no stored state that `alerts.check` could query.
  * **Developer's address.** Alerts go "to the developer and the broker", but no settings key holds the developer's address.
* **Rationale & Recommendation**:
  * Add a "Source" column to the table: `alerts.check`, inline handler, or Better Stack.
  * Name the recipient key for each alert, or say that the developer's address goes in `broker.alert_emails`.

### style-2-2: It is unclear what "Blocks" means in §10, and Phase 0 contradicts it - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 562 against lines 564-577 and line 479.
* **Discrepancy Description**:
  * Line 562 says every item has a default "that the build uses until it is answered". It is then unclear whether "Blocks M2" means M2 can't start, can't finish or can't launch.
  * Phase 0 (line 479) says that "Broker answers A1 and D2–D11" blocks M6. §10 says D9 blocks M1, D2, D6, D10 and D11 block M2, and D4 blocks M5.
  * "D2–D11" also includes D7, which is closed.
* **Rationale & Recommendation**:
  * Define "Blocks" in one sentence, for example "must be answered before this milestone's Done-when check".
  * Make line 479 refer to the §10 column.
  * Write "D2–D6, D8–D11".

### style-2-3: The launch gate's ledger check can never pass ("ledger totals equal the Stripe balance movements") - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 500. Related: line 419.
* **Discrepancy Description**:
  * Stripe balance transactions are net of fees, and the fee on a refunded charge isn't returned.
  * `deposit_transactions` holds gross amounts.
  * So the live deposit-and-refund on line 499 will never reconcile to equality.
* **Rationale & Recommendation**: Write "the sum of `deposit_transactions` by kind equals Stripe's gross charge and refund amounts for the same period (fees excluded)". Use the same wording for the restore-drill check.

### style-2-4: The D2 default and §4.5 disagree on when an account is "flagged", and "flagged" is undefined - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 296 and 302 against 568. Related: 461.
* **Discrepancy Description**:
  * **D2 (line 568):** every Stripe-side refund or dispute "flags the account and alerts the broker".
  * **§4.5 (line 296):** an account is flagged only when available buying power goes negative.
  * **Dashboard refund (line 302):** this row says nothing about an alert.
  * **No mechanism:** no column or state defines "flagged". The only mechanism is the negative-buying-power alert.
  * **"Account" is overloaded.** It can mean the Better Auth `account` table, the customer account, `buying_power_accounts`, or the broker's auction accounts.
* **Rationale & Recommendation**:
  * Pick one rule and use the same wording in both places.
  * Replace "flagged" with the concrete mechanism.
  * Write "buying-power account" where that is meant.

### 🟢 Nits

### style-2-5: The outbox retry schedule has one more delay than it can use - Severity: Nit
* **Reviewer Lens:** `egm-style` (also raised by `egm-codebase-details`)
* **Affected Scope:** Line 348.
* **Discrepancy Description**: Five delays are listed, but "after 5 attempts → failed" allows only four retries, so the 6 h delay is never used.
* **Rationale & Recommendation**: Write "after 6 attempts", or drop the 6 h step.

### style-2-6: The provisional A1 wording has three loose ends ⏳ A1 - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 241-243, 263 and 369.
* **Discrepancy Description**:
  * **Line 263.** It says active bids "block other bids on the lot", but a `pending` bid can be displaced by a takeover. It also says active bids "hold buying power", but `won` bids also use buying power (`consume`).
  * **The TAKEOVER branch** never reserves the new bidder's amount. Only NEW says "reserve the amount", although §4.4 shows a `reserve` entry for every new bid.
  * **Line 369** ("each lot shows one active bid") depends on A1 but isn't marked ⏳ A1.
* **Rationale & Recommendation**:
  * Reword line 263.
  * Add "reserve my amount" to the TAKEOVER branch.
  * Mark line 369 ⏳ A1.

### style-2-7: Error messages are still partly wrong, and several rejections have no code - Severity: Nit
* **Reviewer Lens:** `egm-style` (also raised by `egm-codebase-details`). **Round-1 style-1-13 is partly open here.**
* **Affected Scope:** Lines 223, 240-241 and 251-254.
* **Discrepancy Description**:
  * **Hard-coded step.** The `BID_TOO_LOW` text hard-codes "$100", although the step is the setting `bidding.takeover_step_usd_cents`.
  * **Key name.** Line 241 calls the setting `bidding.takeover_step`, which doesn't match the settings list.
  * **Contradiction.** "Amounts are never shown" conflicts with the step amount shown in the message.
  * **Missing codes.** There is no error code for:
    * an amount below the current auction bid;
    * an amount above the per-lot cap;
    * an amount that isn't whole dollars;
    * a raise that isn't higher;
    * an unverified email.
* **Rationale & Recommendation**:
  * Fill the step into the message from the setting.
  * Write "other customers' bid amounts are never shown".
  * Use the exact key name.
  * Add codes such as `AMOUNT_BELOW_AUCTION_BID`, `AMOUNT_OVER_CAP`, `AMOUNT_NOT_WHOLE_DOLLARS`, `RAISE_NOT_HIGHER` and `EMAIL_UNVERIFIED`.

### style-2-8: "Operator alerted" names no channel - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 179-183.
* **Discrepancy Description**:
  * Operators aren't recipients of `broker.alert`. It is unclear whether "operator alerted" means a flag in the console or a message.
  * "Operator alerted, who decides" is a dangling clause.
* **Rationale & Recommendation**: Write "flagged in the operator console and sent as `broker.alert`; the operator then sets …".

### style-2-9: Sync settings and feed names are incomplete or inconsistent - Severity: Nit
* **Reviewer Lens:** `egm-style` (also raised by `egm-codebase-details`, `egm-implementation-readiness`)
* **Affected Scope:** Line 156 against lines 158-163 and 385-386. Schema: `sync_runs.feed` comment (`schema.ts` 432).
* **Discrepancy Description**:
  * **Missing keys.** Line 156 says the schedule is "stored in `site_settings`", but `sync.soon` and `sync.results` have no keys.
  * **Feed names.** The schema comment lists the feeds as `changes | snapshot | sold | history_backfill`, while the plan's jobs are `changes`, `soon`, `snapshot` and `results`.
  * **No backfill job.** Phase 0 checks "history depth", but there is no history-backfill job.
* **Rationale & Recommendation**:
  * Add the missing keys, or say that those two schedules are fixed in code.
  * Use one list of feed names.
  * Say whether a backfill job exists.

### style-2-10: "Plan" also means the apibara subscription - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 387 and 474.
* **Discrepancy Description**: "(from the plan bought)" and "Choose the plan tier" refer to the apibara subscription, not a customer's deposit plan.
* **Rationale & Recommendation**: Write "the apibara subscription tier".

### style-2-11: Deposit action names vary, and "disputes not won" includes open disputes - Severity: Nit
* **Reviewer Lens:** `egm-style` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Lines 294-295, 306 and 372.
* **Discrepancy Description**:
  * One action goes by "applied", "apply to car price" and `apply_to_purchase`.
  * "Disputes not won" counts open disputes, so a deposit can become `closed` while a dispute is still open. A later `dispute_won` would then grant buying power on a closed deposit.
* **Rationale & Recommendation**:
  * Use one label, mapped once to `apply_to_purchase`.
  * Write "− disputes lost − disputes open", and say what a won dispute does to a closed deposit.

### style-2-12: The step-up list doesn't match the actions that require step-up - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 364 against line 306.
* **Discrepancy Description**:
  * "Apply to car price" needs step-up (line 306) but is missing from the list on line 364.
  * "Export" is in the list but is never defined.
* **Rationale & Recommendation**: Make the list match §4.5 and §5, and say what "export" exports.

### style-2-13: Three statements say "each", "only" or "every" and are too broad - Severity: Nit
* **Reviewer Lens:** `egm-style` (the foreign-key part also raised by `egm-codebase-details`). **Round-1 implementation-readiness-1-14 is partly open here:** the foreign keys were added, but the claim is still too broad.
* **Affected Scope:** Lines 109, 355 and 542. Schema: `bid_events.actor_id` (`schema.ts` 859), `buying_power_entries.actor_id` (618), `session.impersonated_by` (188), `audit_log.entity_id`.
* **Discrepancy Description**:
  * **Line 355.** Says every broker message includes a lot and a bid, but `broker.refund_requested`, `broker.alert` and `broker.session_digest` have no single lot or bid.
  * **Line 109.** Says Telegram is used "only for broker alerts", but Telegram also carries bid messages, and Phase 2 adds customer alerts.
  * **Line 542.** Says there are foreign keys "on every reference column", but the actor IDs, `impersonated_by` and the polymorphic `audit_log.entity_id` have none.
* **Rationale & Recommendation**:
  * Limit line 355 to the bid templates.
  * Change line 109 to "broker messages and alerts".
  * Change line 542 to "every reference column except the actor and polymorphic IDs".

### style-2-14: Money column names don't follow the stated convention - Severity: Nit
* **Reviewer Lens:** `egm-style` (also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 323 and 547. Schema: `auction_fee_bands.price_from_cents` and `price_to_cents` (`schema.ts` 671-672), `fixed_fees.amount_cents`.
* **Discrepancy Description**:
  * Some money columns have no currency in their name.
  * Line 323 uses `price_from` and `price_to`, which aren't the real column names.
* **Rationale & Recommendation**:
  * State the exception that `schema.ts` lines 19-20 already make, or rename the columns.
  * Use the real names on line 323.

### style-2-15: "Plans … are never edited in place" is too broad - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 550.
* **Discrepancy Description**: Only `plan_versions` rows are immutable. `plans` rows (name, `is_active`, `sort_order`) are edited.
* **Rationale & Recommendation**: Write "plan versions".

### style-2-16: The D10 Basic plan is 15%, not "about 10%" - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 576. Lines 44 and 70 give the context.
* **Discrepancy Description**: Basic is $1,500 for $10,000 of buying power, which is 15%. Standard and Pro are 10%.
* **Rationale & Recommendation**: Change Basic to $1,000 → $10,000 or $1,500 → $15,000, or write "10–15%".

### style-2-17: The calculator's types are loose - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 315-316 and 324. Line 37 gives the context.
* **Discrepancy Description**:
  * The type `Line` is used but never defined.
  * `totalEurCents: number` isn't nullable, but line 324 says "no total is given".
  * The bid figure that the lot page uses by default is never stated.
* **Rationale & Recommendation**:
  * Define `Line`.
  * Make the total `number | null`.
  * State the default bid input for the lot page.

### style-2-18: "16:30 CET" is ambiguous in summer - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 344.
* **Discrepancy Description**: Central Europe uses CEST in summer, so "CET" is ambiguous for half the year.
* **Rationale & Recommendation**: Write "16:30 Europe/Berlin".

### style-2-19: "Set `plan_version_id`" doesn't name the table - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 204.
* **Discrepancy Description**: `deposits` also has a `plan_version_id`, so it's unclear which table is meant.
* **Rationale & Recommendation**: Write "`buying_power_accounts.plan_version_id`".

### style-2-20: Several "Done when" criteria aren't measurable - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 488, 490, 494 and 495.
* **Discrepancy Description**:
  * "Grants the right buying power" doesn't say what "right" means.
  * "p95 < 500 ms" has no load profile.
  * "Playwright flow for the account." is a fragment.
  * "Security pass" is undefined.
* **Rationale & Recommendation**: Name the expected values, the load, the test that must pass and a security checklist.

### style-2-21: Infrastructure wording still has gaps - Severity: Nit
* **Reviewer Lens:** `egm-style` (also raised by `egm-implementation-readiness`). **Round-1 style-1-9, style-1-11, implementation-readiness-1-16 and codebase-details-1-3 are partly open here.**
* **Affected Scope:** Lines 134, 397, 400-412 and 435.
* **Discrepancy Description**:
  * Staging has no compose file in the layout.
  * "Postgres needs more than 70% of RAM" isn't measurable, and "CPU above 60%" has no time window.
  * The `migrate` container is missing from the containers table.
  * `BACKUP_STORAGEBOX_*` is a wildcard in the list of required variables.
* **Rationale & Recommendation**:
  * Add `compose.staging.yml`, or say that staging uses the prod file.
  * Give each threshold a metric and a time window.
  * Add `migrate` to the table as a one-off container.
  * List the exact variable names.

### style-2-22: The coverage rule has no threshold - Severity: Nit
* **Reviewer Lens:** `egm-style`. **Round-1 style-1-8 is partly open here.**
* **Affected Scope:** Line 126.
* **Discrepancy Description**: "Branch coverage enforced in CI" gives no percentage.
* **Rationale & Recommendation**: Write "100% branch coverage enforced in CI", or another figure.

### codebase-details-2-11: Who updates KYC status is unclear, and some KYC statuses aren't mapped - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-style`, `egm-implementation-readiness`)
* **Affected Scope:** Line 190 against line 342. Schema: `kyc_status` (`schema.ts` 87-95).
* **Discrepancy Description**:
  * The webhook updates the status inline, but a `kyc.process` job also exists, and there is no KYC inbox table.
  * `resubmission_requested` and `abandoned` aren't mapped.
  * If an older session expires after a newer one was approved, `kyc_approved_at` would be cleared.
* **Rationale & Recommendation**:
  * Pick one path (the Stripe inbox pattern would fit).
  * Map every status.
  * Only clear `kyc_approved_at` when the event belongs to the latest check.

### codebase-details-2-12: `banned = false` misses NULL - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Line 219. Schema: `user.banned` is nullable (`schema.ts` 166).
* **Discrepancy Description**: With `banned = false`, a user whose `banned` is NULL fails the check. `ban_expires` is also ignored.
* **Rationale & Recommendation**: Use `banned IS NOT TRUE`, and take `ban_expires` into account.

### codebase-details-2-13: `lot_snapshot` is never set in the bid transaction - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`). **Round-1 codebase-details-1-4 is partly open here.**
* **Affected Scope:** Line 246. Schema: `bids.lot_snapshot` is NOT NULL (`schema.ts` 814).
* **Discrepancy Description**: The column writes leave out `lot_snapshot`, and its fields aren't defined.
* **Rationale & Recommendation**: Add it to line 246 and list its fields.

### codebase-details-2-14: Not every constraint test can check a constraint name - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 445. Tests: `constraint-tests.sql` 34-42 (T2) and 73-74 (T13).
* **Discrepancy Description**: T2 and T13 are positive cases that expect success, so they have no constraint name to check.
* **Rationale & Recommendation**: Write "each failure case checks the constraint name".

### codebase-details-2-15: An upgrade with an equal deposit or equal buying power fails `deposits_amount_chk` - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`. **Round-1 codebase-details-1-9 is mostly fixed; this is the remainder.**
* **Affected Scope:** Line 195. Schema: `schema.ts` 520-523.
* **Discrepancy Description**: The check requires both differences to be greater than 0. A custom plan with an equal deposit or equal buying power can't be an upgrade, and the plan doesn't say so.
* **Rationale & Recommendation**: State that an upgrade must raise both amounts.

### codebase-details-2-16: The sealed-bid alternative needs more than dropping one index ⏳ A1 - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 258.
* **Discrepancy Description**: If `bids_one_active_per_lot_uq` is dropped, nothing stops one user from having two active bids on the same lot.
* **Rationale & Recommendation**: Replace it with a partial unique index on `(lot_id, user_id)` over the active statuses.

### codebase-details-2-17: The cutoff check uses the current setting, but existing bids keep their stored cutoff - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`). **Round-1 implementation-readiness-1-4 has this small remainder.**
* **Affected Scope:** Line 222 against lines 180 and 390.
* **Discrepancy Description**:
  * Line 222 computes the cutoff from the current `bidding.cutoff_minutes`, but line 390 says existing bids keep their `cutoff_at`.
  * If the setting is raised, a raise on a still-`pending` bid is rejected before that bid's own cutoff.
  * Line 180 doesn't say which value is used when a bid's cutoff is recalculated.
* **Rationale & Recommendation**:
  * A raise checks `bids.cutoff_at`.
  * A new bid uses the current setting.
  * State which value a recalculated cutoff uses.

### codebase-details-2-18: The effective export status is defined only in a schema comment - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`. **Round-1 codebase-details-1-2 is partly open here.**
* **Affected Scope:** Lines 375 and 548. Schema: `schema.ts` 379.
* **Discrepancy Description**: The plan never states `coalesce(export_status_override, export_status)`, or that search and the lot page use the effective value.
* **Rationale & Recommendation**: Add one sentence that says both.

### codebase-details-2-19: Two tools aren't listed in the tech stack - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** §3. Code: `dbml.ts` 3.
* **Discrepancy Description**: `drizzle-dbml-generator` and `tsx` are used but not listed.
* **Rationale & Recommendation**: Add them, with their versions.

### implementation-readiness-2-11: Two rules still need a source or an anchor - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness`. **Round-1 codebase-details-1-16 is mostly fixed; this is the remainder.**
* **Affected Scope:** Lines 284 and 369.
* **Discrepancy Description**:
  * **Time-zone fallback.** It needs a map from US state to IANA time zone, and none is given.
  * **Due date after approval.** For `won_pending_approval` → `won`, it isn't said which `result_at` starts the due date.
* **Rationale & Recommendation**:
  * Name the map, for example a constant in `packages/auctions`.
  * State that the due date counts from the time of the final `won` transition.

---

## Round-1 issues still open

None of these is fully unaddressed: each is partly fixed, and the round-2 finding that covers the remainder is in brackets.

| Round-1 id | Status in v2 | Covered by |
| --- | --- | --- |
| implementation-readiness-1-1 | Partly fixed. The `db/*` destination is given, but there is still no exact file list. | implementation-readiness-2-1 |
| implementation-readiness-1-3 | Fixed for placing a bid only. The other transactions have no lock order, idempotent replays are mishandled, and the sign-up mechanism is assumed. | implementation-readiness-2-3, codebase-details-2-3, implementation-readiness-2-7 |
| implementation-readiness-1-4 | Mostly fixed. A small cutoff inconsistency remains. | codebase-details-2-17 |
| implementation-readiness-1-5 | Partly fixed. Postponement contradicts §4.4, and the top-bid status guard is missing. | codebase-details-2-2, implementation-readiness-2-2 |
| implementation-readiness-1-7 | Partly fixed. | implementation-readiness-2-5, codebase-details-2-4, codebase-details-2-5 |
| implementation-readiness-1-8 | Partly fixed. | implementation-readiness-2-9 |
| implementation-readiness-1-10 | Partly fixed. | implementation-readiness-2-8, codebase-details-2-8 |
| implementation-readiness-1-11 | Partly fixed. | implementation-readiness-2-10 |
| implementation-readiness-1-14 | The foreign keys were added, but the "every reference column" claim is too broad. | style-2-13 |
| implementation-readiness-1-16 | Fixed, except for a wildcard variable name. | style-2-21 |
| codebase-details-1-2 | The column exists, but the effective-value rule isn't in the plan. | codebase-details-2-18 |
| codebase-details-1-3 | Fixed, except that the `migrate` container is missing from the table. The two reviewers disagree on whether this counts as open. | style-2-21 |
| codebase-details-1-4 | Mostly fixed. Replays and `lot_snapshot` remain. | codebase-details-2-3, codebase-details-2-13 |
| codebase-details-1-5 | Mostly fixed. Consumed power after a forfeit remains. The reviewers disagree; it is listed as open. | implementation-readiness-2-4 |
| codebase-details-1-6 | Partly fixed. | codebase-details-2-1, codebase-details-2-2, codebase-details-2-7 |
| codebase-details-1-7 | Partly fixed. | implementation-readiness-2-6 |
| codebase-details-1-8 | Partly fixed. Revokes can go over what was granted, and multiple deposits are undefined. | implementation-readiness-2-4, codebase-details-2-10 |
| codebase-details-1-9 | Mostly fixed. | codebase-details-2-15 |
| codebase-details-1-16 | Mostly fixed. | implementation-readiness-2-11 |
| style-1-8 | Partly fixed. | style-2-22 |
| style-1-9 | Partly fixed. | style-2-21 |
| style-1-11 | Partly fixed. | style-2-21 |
| style-1-13 | Partly fixed. | style-2-7 |
| style-1-16 | Partly fixed. The digest is still undefined. | implementation-readiness-2-8 |

**Fully fixed:**
- implementation-readiness-1-2, 1-6, 1-9, 1-12, 1-13 and 1-15;
- codebase-details-1-1, 1-10, 1-11, 1-12, 1-13, 1-14 and 1-15;
- style-1-1, 1-2, 1-3, 1-4, 1-5, 1-6, 1-7, 1-10, 1-12, 1-14, 1-15, 1-17 and 1-18.

## Outside the reviewed range (not counted)

The style reviewer noted two items in lines 1-94:
- Line 32 says the plan "copies [vinasLT's] bid rules", but B11 and B12 reject vinasLT's +$1 step and its 15-minute cutoff.
- B10 (line 78) says Prisma "handles row locks and partial indexes less well" without evidence.
