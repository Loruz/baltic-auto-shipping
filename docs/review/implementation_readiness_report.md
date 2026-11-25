# Goldfish Review Report

**Target:** `/Users/vytautas/Projects/car-auction-platform-plan/IMPLEMENTATION-PLAN.md` (`lines 66-331`, from "## 3. Tech stack" to the end)

**Stage:** 9 (Implementation Readiness Test), round 1
**Standard:** `/Users/vytautas/.claude/plugins/cache/egm/egm/0.1.1/resources/document_standards/implementation-readiness-standard.md`
**Code checked against:** `db/schema.ts`, `db/migrations/0000_init.sql`, `db/constraint-tests.sql`. This is a greenfield project, so the absence of application code is not a finding.

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `egm-implementation-readiness` | completed |
| `egm-codebase-details` | completed |
| `egm-style` | completed |

**Severity breakdown (after deduplication):** 5 Blocker, 23 Major, 22 Nit (50 findings).

**Verdict: not ready for implementation.** The plan is a strong architecture and decision document. It is not yet an execution plan:

- It has no file list.
- Several MVP-blocking decisions are still open.
- The core bid transaction is under-specified in ways that would cause runtime failures. It uses a status the schema doesn't have, can deadlock, and has no handling for unique-index violations.

**Checked and correct** (so they are not reported):

- 36 tables in 7 groups, with the table names in §9.
- The upsert key `(source, external_lot_id)`.
- `lots.synced_at`, `lot_raw`, `sync_runs`, `landed_estimate_eur_cents`.
- The bid statuses `outbid`, `locked`, `placed`, `not_placed`, `won_pending_approval`, `cancelled`, and the lot status `removed`.
- The indexes and checks `bids_one_active_per_lot_uq`, `rate_cards_one_active_uq`, unique `bids.idempotency_key`, non-negative account totals and `user_role_chk`.
- Deposit transactions unique on `(stripe_object_id, kind)`, and the `stripe_dashboard` origin.
- The formula available = granted − reserved − consumed.
- The roles `admin`, `operator`, `customer`.
- 6 production containers.

The migration matches `schema.ts` on every enum, check, index and foreign key the codebase reviewer compared.

**How findings were merged:** when two or more reviewers raised the same issue, the finding keeps the id of the reviewer with the most complete version, and the others are listed under "Also raised by".

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 🔴 Blockers

### codebase-details-1-1: The bid transaction uses a bid status `active` that doesn't exist - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Lines 139, 141, 149, 192, 231, 302. Schema: `schema.ts` 114-124 and 797-800; `0000_init.sql` 4 and 572.
* **Discrepancy Description**:
  * Line 141 runs `SELECT … FROM bids WHERE lot_id=$l AND status IN (active) FOR UPDATE`, and line 139 counts "active bids" against `plan.max_active_bids`. The `bid_status` enum has no `active` value.
  * The schema's real definition of a live bid is the predicate of `bids_one_active_per_lot_uq`: `status in ('pending','locked','placed','won_pending_approval')`.
  * The text also switches between "active bid" (lines 139, 231) and "live bid" (lines 149, 192, 302) without defining either.
  * If someone copies the SQL as written, it fails. If they guess the list instead, the takeover check and the `max_active_bids` limit can drift from what the index enforces.
* **Rationale & Recommendation**:
  * Define one term once, for example "open bid = status in (pending, locked, placed, won_pending_approval), the predicate of `bids_one_active_per_lot_uq`". Use it everywhere.
  * Write the literal status list in line 141.
  * Say explicitly which statuses count toward `max_active_bids`, including whether `won` counts.
  * Say which statuses can be taken over. Presumably only `pending`.

### codebase-details-1-2: The "export-status override" has no column, and conflicts with the rule that only sync writes vendor columns - Severity: Blocker
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 198, 298. Schema: `schema.ts` 356 (`exportStatus`, a single column) and 359-363.
* **Discrepancy Description**: The Lots admin screen "edit[s] the export-status override", but `lots` has only `export_status` and no override column. Line 298 says vendor columns are "only ever written by sync". So an admin edit is either overwritten on the next sync, or it breaks the stated rule. The implementer would have to design the schema change.
* **Rationale & Recommendation**:
  * Option 1: add `export_status_override export_status NULL`, plus who set it and when, to `schema.ts`, and regenerate the migration. State that the effective status is `coalesce(override, export_status)`, and that search indexing and the lot page both read the effective value.
  * Option 2: drop the feature from line 198.

### implementation-readiness-1-1: No list of files to create, change or delete - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 88-108, 258-269, 310-313.
* **Discrepancy Description**:
  * The standard requires exact repo-relative paths, usable as a per-phase write allowlist. The repository layout stops at package directories.
  * No source, route, server-action, worker processor, test, Dockerfile, `.github/workflows/*.yml` or `infra/*` file is named.
  * The plan doesn't say where the existing `db/schema.ts`, `db/migrations/0000_init.sql`, `db/constraint-tests.sql` and `db/schema.dbml` move to inside `packages/db/`.
* **Rationale & Recommendation**:
  * For each milestone 1-9, add a table of exact paths marked Create, Modify or Delete, with one line on what each file holds.
  * Give the destination of each existing `db/*` file.

### implementation-readiness-1-2: Open decisions that block MVP milestones are left to the implementer - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness` (the alert-channel part also raised by `egm-style`; see style-1-6)
* **Affected Scope:** Lines 317-331. Also lines 79 ("Pick on price and API"), 154 and 164 ("Open item D2 covers what happens to the bids").
* **Discrepancy Description**: The plan marks these items as blocking Milestones 1, 4, 5 and 6, so those milestones can't be coded as written:
  * D2: what happens to open bids on a refund or dispute.
  * D3: whether buying power comes back after a won car is paid.
  * D4: which rates are missing.
  * D5: the broker alert channel.
  * D6: Ondato or Veriff.
  * D7: deposit currency.
  * D9: launch languages.
  * D10: plan amounts.
  * D11: SMS verification.
* **Rationale & Recommendation**:
  * Resolve each item, or write down a provisional default the code will implement and make it a config value where possible. For example: "D3: buying power is released when the broker marks the car paid."
  * Add a rule that a milestone can't start until the items it depends on are closed or defaulted.

### implementation-readiness-1-3: The bid transaction can deadlock, has an unhandled race on a lot's first bid, and may lock nothing - Severity: Blocker
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 132-149.
* **Discrepancy Description**:
  * **Deadlock.** The transaction locks the bidder's own `buying_power_accounts` row, then the lot's bid. A takeover then releases the displaced customer's power, which writes that customer's account row. Two crossing takeovers (A outbids B on lot 1 while B outbids A on lot 2) take the account locks in opposite order and deadlock (SQLSTATE 40P01).
  * **Race on a lot's first bid.** When a lot has no live bid, `SELECT … FOR UPDATE` on `bids` locks nothing. Two concurrent first bids both pass the checks, and one then fails on `bids_one_active_per_lot_uq` (23505). Line 149 calls the index a "backstop" but gives no handling rule.
  * **Missing account row.** The plan never says when the `buying_power_accounts` row is created. If it doesn't exist, `FOR UPDATE` serialises nothing.
* **Rationale & Recommendation**:
  * Fix the lock order. Either lock the `lots` row first (`SELECT … FROM lots WHERE id=$l FOR UPDATE`), or lock both account rows in `user_id` order after reading the top bid.
  * Give a retry policy for 40P01 and 23505, for example up to 3 retries, then a defined error code and message.
  * State that the account row is created with zero balances at sign-up (or at the first deposit), and that bidding without one is rejected.

### 🟡 Major

### implementation-readiness-1-4: Bid preconditions aren't mapped to columns, and the cutoff and step values are both hard-coded and configurable - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`, `egm-style`)
* **Affected Scope:** Lines 136-138, 142, 199. Schema: `schema.ts` 343, 360, 461, 887-892.
* **Discrepancy Description**:
  * "Active plan" is undefined. Does it mean `plan_version_id IS NOT NULL`, or a succeeded deposit?
  * "No unpaid won car (broker flag)" doesn't say whether it means `customer_profiles.bidding_blocked_at` or any bid with `payment_status IN ('pending','overdue')`.
  * The pseudo-code hard-codes `sale_at − 1 h` and `top + $100`, while the Settings screen (line 199) makes cutoff minutes and the takeover step editable. The `site_settings` keys aren't defined, and nothing says whether a settings change updates `cutoff_at` on existing bids.
  * Null cases are unspecified: `lots.sale_at`, `lots.current_bid_usd_cents` and `max_bid_per_lot_cents` (where null means no cap) can all be null.
* **Rationale & Recommendation**:
  * Map each check to an exact column predicate.
  * Define the `site_settings` keys with defaults, for example `bidding.cutoff_minutes = 60` and `bidding.takeover_step_usd_cents = 10000`.
  * Make the check use the same computed cutoff stored in `bids.cutoff_at`.
  * Give the rule for each null case.

### codebase-details-1-4: Raise semantics, idempotency and the bid row's column writes are undefined - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Line 144. Schema: `schema.ts` 775-792; `constraint-tests.sql` 16-17.
* **Discrepancy Description**:
  * It's unclear whether a raise updates the row or inserts a new one, whether a raise has a minimum step, and whether amounts must be whole dollars.
  * `bids.idempotency_key` is unique and NOT NULL per row, so it's unclear how a retried raise is detected.
  * No `quotes` INSERT happens before `bids.quote_id` is set.
  * The steps never set `sale_at_when_placed`, `cutoff_at` or `plan_version_id`.
  * `outbid_by_bid_id` can only be set after the new row exists, because the old row must leave the live statuses first (test T2).
* **Rationale & Recommendation**:
  * List the exact column writes for a new bid, a raise and a takeover, including the quote insert, the `cutoff_at` formula and the second update that sets `outbid_by_bid_id`.
  * Say where raise idempotency is stored, for example `buying_power_entries.idempotency_key`.

### implementation-readiness-1-5: No cancel transaction and no full bid state machine - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 52 (B12, context), 100, 132-155.
* **Discrepancy Description**:
  * B12 allows cancelling until the cutoff, but there is no cancel transaction: allowed source statuses, release entry, `bid_events` row, broker notice.
  * It's not said whether cancelling the top bid brings back the previously outbid bid, or whether an `outbid` customer may bid again.
  * §4.4 lists target statuses but has no from → to table. For example, it never resolves `won_pending_approval` → won or lost, `locked` → cancelled when a lot is removed after the cutoff, or what happens to a `locked` bid after a postponement.
  * Without that table, the guarded `UPDATE … WHERE status IN (…)` updates on line 155 can't be written.
* **Rationale & Recommendation**: Add a transition table covering all 9 `bid_status` values, with actor, guard statuses, buying-power entry kind and notification for each edge. Add the cancel transaction, and say whether `outbid` is final.

### codebase-details-1-5: Payment status is mixed up with bid status, and the payment columns are never written - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Lines 153-154, 192. Schema: `schema.ts` 125-131, 788-790.
* **Discrepancy Description**:
  * `paid` and `overdue` are `bid_payment_status` values, not `bid_status` values, and `forfeited` is never mentioned.
  * The plan never says to set `payment_status='pending'` and compute `payment_due_at` on a win. The schema comment gives Copart 2 / IAAI 4 business days, with no calendar or time zone.
  * It never says to set `paid_marked_at` or `customer_profiles.bidding_blocked_at` and `_reason`.
  * The forfeit amount (whole deposit or a stated amount) is undefined.
  * "On approval" on line 192 should be `won_pending_approval`.
* **Rationale & Recommendation**:
  * Name `bids.payment_status` explicitly and add these writes to the won, paid, overdue and forfeit steps.
  * Define the due-date calculation, or say that `overdue` is set by hand.
  * Define the forfeit amount.

### codebase-details-1-6: Sync side effects cover only pending bids, and there is no vehicle-matching or normalisation rule - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Lines 114-123, 297. Schema: `schema.ts` 71, 299-326, 338-340, 395-411.
* **Discrepancy Description**:
  * `lots.vehicle_id` is NOT NULL, but finding or creating the vehicle is never described: matching by VIN through `vehicles_vin_uq`, what happens with a null VIN, what happens when the VIN changes.
  * No mapping is given from vendor values to `lot_status`, `sale_outcome`, `export_status` or `odometer_brand`.
  * It's unclear whether `on_approval`, `not_sold` and `cancelled` outcomes also go into `lot_sales`.
  * The side effects don't cover:
    * `locked` or `placed` bids when a lot is removed or sold;
    * a `pending` bid whose new `sale_at` is already past the cutoff;
    * relists;
    * whether `sale_at_when_placed` is updated.
* **Rationale & Recommendation**:
  * Add a table that maps each sync event (sold, removed, postponed, relisted, VIN changed) to its effect on each bid status.
  * Add the vehicle-matching rule and the vendor-to-enum mapping tables. Mark the mappings "confirm after the Phase 0 trial" if needed.

### implementation-readiness-1-6: No apibara or Typesense contract, and sync cadences are ranges - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-style`)
* **Affected Scope:** Lines 76, 98, 103, 115-116.
* **Discrepancy Description**:
  * There is no `LotDataProvider` interface.
  * There is no Typesense collection schema: fields, facets, sort fields, and the default port and vehicle type used for the precomputed landed EUR.
  * The scheduler and retention values are placeholders: "e.g. 12 months", "every 1–5 minutes, more often for lots selling within 24 h", "every few hours".
* **Rationale & Recommendation**:
  * Write the TypeScript interface and the collection schema.
  * Fix one default for each cadence, for example every 5 min, every 1 min for lots with `sale_at` within 24 h, and a snapshot every 4 h. Make them configuration values if they need tuning after the trial.

### codebase-details-1-7: Stripe bank-transfer events are vague, so buying power could be granted before the money arrives - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`, `egm-style`)
* **Affected Scope:** Lines 78, 126-130, 195. Schema: `schema.ts` 245.
* **Discrepancy Description**:
  * "`payment_intent.succeeded` / customer-balance webhook" is not a list of events.
  * With Checkout `mode=payment` and `customer_balance`, `checkout.session.completed` arrives with `payment_status='unpaid'`. The funds are confirmed later by `checkout.session.async_payment_succeeded`, or fail with `async_payment_failed`. A handler built from line 128 could grant buying power for money that hasn't arrived.
  * Nothing is said about:
    * the webhook route or signature verification;
    * claiming, retrying and ordering events from `stripe_events` (line 232 tests out-of-order delivery, but no handling is specified);
    * creating the Stripe Customer before checkout, which `customer_balance` requires;
    * the column writes (`payment_method`, `stripe_payment_intent_id`, `succeeded_at`, `processed_at`, `error`);
    * partial payments, overpayments, or expiry of pending deposits;
    * handling "unmatched bank transfers".
* **Rationale & Recommendation**:
  * List the exact events handled and those ignored, and grant only when `payment_status === 'paid'`.
  * Specify the ingest route and an idempotent processing algorithm.
  * Give the column writes for each event and the rule for recording unmatched cash-balance funds.

### codebase-details-1-8: The refund, dispute and forfeit flows can double-count, and have no conversion rule - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Lines 157-164. Schema: `schema.ts` 87-102, 526-528.
* **Discrepancy Description**:
  * An admin-panel refund also fires `charge.refunded`, which line 161 would record again with origin `stripe_dashboard`. `deposit_tx_stripe_kind_uq` catches this only if the admin flow committed its `re_…` row first, and the webhook can arrive before that commit.
  * The order of the external Stripe call relative to the database transaction is not given, and neither is the failure handling.
  * Only `charge.dispute.created` is covered. `dispute_won` and `dispute_lost` exist in the enum with no trigger, and nothing says whether a won dispute restores buying power.
  * No formula converts deposit cents into a buying-power revoke amount for partial refunds, forfeits or apply-to-purchase. The deposit is about 10% of buying power.
  * Setting `deposits.status='closed'` is never mentioned.
* **Rationale & Recommendation**:
  * Give the admin refund sequence: call Stripe, write the rows keyed by the refund id, and treat a webhook as a no-op if the row exists.
  * Add the dispute won and lost outcomes, the revoke formula and the close rule.

### codebase-details-1-9: The buying-power account lifecycle, plan linkage and upgrade maths are missing - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Lines 126-130, 135, 196. Schema: `schema.ts` 486, 552-595.
* **Discrepancy Description**:
  * The grant step doesn't set `buying_power_accounts.plan_version_id` or name the grant amount (`plan_versions.buying_power_cents`).
  * Upgrades: nothing says to fill `deposits.upgrades_deposit_id`, whether the grant is the difference in buying power, or what happens to the old deposit.
  * Downgrades and holding more than one plan are not addressed.
  * The plan doesn't say what happens to customers on an old plan version when a plan is edited (line 196).
* **Rationale & Recommendation**: Add these steps and rules explicitly. Account creation is covered in implementation-readiness-1-3.

### codebase-details-1-10: Bids are in USD but buying power may be in EUR, and some amounts have no currency - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 140, 296, 327 (D7). Schema: `schema.ts` 457, 558, 771.
* **Discrepancy Description**:
  * Bids are always `max_bid_usd_cents`, but `plan_versions.currency` and `buying_power_accounts.currency` vary, and D7 allows EUR. The check on line 140 then compares amounts in different currencies.
  * `buying_power_entries.amount_cents` and `bid_events.*_amount_cents` carry no currency, which breaks the "always with a currency" rule on line 296.
* **Rationale & Recommendation**: Either fix buying power to USD now and say so, or define the FX rule for the comparison. Add currency to those columns, or correct line 296.

### implementation-readiness-1-7: The landed-cost calculator has no formulas, and publishing a rate card triggers no recompute - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`, `egm-style`)
* **Affected Scope:** Lines 77, 122, 166-180, 197. Schema: `schema.ts` 366-368, 600-666.
* **Discrepancy Description**:
  * The input and output types aren't given, and no line item has a formula. In particular, the base for customs duty and import VAT is missing (`tax_rates.basis` is free text), as is whether broker-fee VAT is a separate line.
  * Rules are missing for:
    * fee-band boundaries (inclusive or exclusive);
    * choosing the export port when a yard has several towing rates;
    * falling back from yard to state;
    * the FX source, direction and date (including weekends);
    * rounding.
  * The reverse calculator has no algorithm. Fee bands aren't linear, so it probably needs a search.
  * The input for `landed_estimate_eur_cents` (which bid figure, and what to do when it's null) is undefined.
  * `landed_estimate_rate_card_id` has no foreign key.
  * Line 180's claim that "every result records the … FX rate used" is false for the precomputed search field: `lots` stores no FX rate.
  * Publishing a card must archive the old active card in the same transaction (or `rate_cards_one_active_uq` rejects it), and then recompute and reindex all lots. Neither step is in §4.6 or the job list.
* **Rationale & Recommendation**:
  * Add the type signatures, one formula per line item, the rounding, FX and port rules, and the reverse algorithm.
  * Add a "rate card published" job.
  * Narrow line 180 to `quotes`, or add an FX column to `lots`.

### implementation-readiness-1-8: Routes, server actions and staff security mechanisms are undefined, and the Better Auth default role breaks the role check - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 72, 74, 184-199. Schema: `schema.ts` 154, 161, 177.
* **Discrepancy Description**:
  * Apart from `/[locale]` and `/admin`, no route paths, server-action names, signatures or error codes are given.
  * Better Auth's admin plugin defaults new users to the role `user`, but `user_role_chk` allows only `customer`, `operator` and `admin`. Sign-up will fail unless `defaultRole` and `adminRoles` are configured.
  * Better Auth has neither "step-up re-authentication" (line 188) nor "read-only impersonation" (line 194) built in, so the mechanism for each is undecided.
  * The `site_settings` keys and value shapes aren't listed.
* **Rationale & Recommendation**:
  * Add a table of routes and actions.
  * Give the Better Auth plugin config with `defaultRole: 'customer'`.
  * Specify step-up, for example a TOTP prompt valid for N minutes.
  * Enforce read-only impersonation through `session.impersonated_by`.
  * Add a registry of settings keys.

### implementation-readiness-1-9: Tool and dependency choices are left as alternatives, and no versions are pinned - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 79, 84, 106, 207, 220-221, 311.
* **Discrepancy Description**:
  * These are still alternatives rather than decisions: "Ondato or Veriff", "Uptime Kuma or Better Stack", "zod / t3-env", "e.g. Hetzner", "Hetzner Storage Box or Cloudflare R2", ".env … or Infisical/1Password", "ChartDB or DrawDB".
  * No versions are pinned for Next.js, Better Auth, Drizzle, BullMQ, Typesense or drizzle-dbml-generator.
* **Rationale & Recommendation**: Pick one option for each, and list package names with their major versions.

### implementation-readiness-1-10: The outbox sender and business alerts have no retry policy, thresholds or owning job - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`, `egm-style`)
* **Affected Scope:** Lines 104, 146, 235-241. Schema: `schema.ts` 426, 876-878.
* **Discrepancy Description**:
  * The outbox has:
    * no list of templates and payloads;
    * no rule for finding recipients;
    * no maximum on `attempts` and no backoff;
    * no recovery for rows stuck in `sending`.
  * No alert has an owning job, a destination or a threshold. "Outbox notifications failing" has no numeric limit.
  * "apibara quota above 80%" has no stored quota to compare `requests_used` against.
* **Rationale & Recommendation**:
  * Add a template catalogue and the retry and backoff numbers.
  * Add an alert table listing the job, condition, threshold and destination for each alert.
  * Add a `site_settings` key for the apibara quota.

### implementation-readiness-1-11: Milestones have no exit criteria, tests come too late, and the constraint tests aren't automated - Severity: Major
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Lines 85, 226-233, 258-271. Test file: `constraint-tests.sql` 1-37.
* **Discrepancy Description**:
  * The milestones list scope only. None has an exit criterion or named tests.
  * Concurrency tests wait until Milestone 9.
  * §7.1 lists test areas, not cases with inputs and expected results. For example, it doesn't say whether exactly `sale_at − 1 h` is rejected.
  * `db/constraint-tests.sql` (T1-T10) isn't mentioned. It runs with `ON_ERROR_STOP 0` and only prints banners, so a person must read the output to see pass or fail.
* **Rationale & Recommendation**:
  * Give each milestone an exit criterion and named given / when / expect cases.
  * Move the bid concurrency tests into Milestone 6.
  * Port T1-T10 to Vitest against a real Postgres 17 database, using a named mechanism such as testcontainers. Each test should assert the constraint name, and the tests should run in CI.

### codebase-details-1-3: The migration and diagram tooling won't work as described, and migrations on deploy are unspecified - Severity: Major
* **Reviewer Lens:** `egm-codebase-details` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Lines 86, 209-218, 310-311.
* **Discrepancy Description**:
  * `npx tsx dbml.ts` refers to a script that exists neither in the folder nor in the layout.
  * `drizzle-kit migrate` needs a `drizzle.config.ts` and `migrations/meta/_journal.json` plus a snapshot. `db/migrations/` contains only `0000_init.sql`, so drizzle-kit can't apply it as shipped.
  * "Runs on deploy" doesn't say which container or step runs migrations, how they're ordered against web and worker startup, or what happens on failure. `drizzle-kit` is usually a dev dependency and won't be in the production image.
  * The BullMQ queue names and concurrency for the "separate queues" on line 215 aren't given.
* **Rationale & Recommendation**:
  * Mark `dbml.ts` and `drizzle.config.ts` as files to create, with their key settings.
  * Regenerate `0000_init.sql` with `drizzle-kit generate`.
  * Add a one-off migrate step that must succeed before `up -d`, with a note on rollback.
  * List the queue names and their concurrency.

### codebase-details-1-11: The milestone order isn't buildable as written - Severity: Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 118-122 against lines 262-266.
* **Discrepancy Description**: Milestone 2 builds the sync worker, but sync step 4 needs bids (Milestone 6) and step 5 needs pricing (Milestone 4).
* **Rationale & Recommendation**: State that step 5 is added in Milestone 4 and step 4 in Milestone 6, and name the hook in the sync job where each one plugs in.

### style-1-1: The Phase 1 total doesn't match the milestone rows - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 258 against lines 261-269.
* **Discrepancy Description**: The heading says ≈ 14–18 weeks, but the rows add up to 2+3+2+2+(2–3)+2+2+1+(1–2) = 17–19 weeks.
* **Rationale & Recommendation**: Change the heading to ≈ 17–19 weeks, or adjust the rows.

### style-1-2: The launch gate contradicts itself ("real money on Stripe test") - Severity: Major
* **Reviewer Lens:** `egm-style` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Line 271.
* **Discrepancy Description**: Stripe test mode never moves real money, so the gate can't be checked as written.
* **Rationale & Recommendation**: Split it into a full rehearsal in test mode, then a live-mode run with a real deposit of at least the smallest plan amount, refunded afterwards.

### style-1-3: "Vendor" means two different parties - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 83, 116, 121, 138, 192, 298.
* **Discrepancy Description**: "Vendor" sometimes means apibara (the data provider) and sometimes Copart/IAAI (the auction house). "Vendor/auction CDN" (line 83), "vendor current bid" (line 138) and "vendor says sold" (line 121) can each be read either way.
* **Rationale & Recommendation**: Use two fixed terms, "data provider (apibara)" and "auction (Copart/IAAI)".

### style-1-4: It's unclear whether saved-search alerts are in the MVP or Phase 2 - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 77, 95, 268 against line 274.
* **Discrepancy Description**: The jobs row and the worker description include saved-search alerts, and Milestone 8 includes saved searches. Phase 2 also lists saved-search alerts.
* **Rationale & Recommendation**: State that the MVP stores saved searches only. Remove the alerts from lines 77 and 95, or mark them "(Phase 2)".

### style-1-5: "Admin tools only behind VPN" conflicts with the public `/admin` route - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 222 against lines 93, 184.
* **Discrepancy Description**: The operator console is `/admin` inside the public Next.js app, but line 222 says admin tools are only reachable through a VPN or SSH tunnel. A reader can't tell whether `/admin` must be blocked from the public internet.
* **Rationale & Recommendation**: Name the tunnel-only tools (drizzle-kit studio, psql, the Typesense dashboard). State separately whether `/admin` is public behind 2FA or also restricted.

### style-1-6: The broker alert channel reads as decided ("email/Telegram") but is still open as D5 - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 81, 146, 266 against line 325.
* **Discrepancy Description**: The slash in "email/Telegram" doesn't say whether it means "and" or "or". The tech stack lists Telegram for broker alerts, while D5 still asks which channel to use.
* **Rationale & Recommendation**: Write "email and Telegram", or "email or Telegram (pending D5)", consistently. See implementation-readiness-1-2.

### 🟢 Nits

### implementation-readiness-1-12: The tie rule can't happen under the +$100 step - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Line 230. Line 51 (B11) is context.
* **Discrepancy Description**: If a new bid must be at least top + $100, two bids can't tie, yet line 230 tests "ties".
* **Rationale & Recommendation**: Define what a tie is, or remove the tie rule and its test.

### style-1-7: The plan overstates what the database enforces - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 75.
* **Discrepancy Description**: "Row locks and partial unique indexes enforce the bid rules" is broader than true. The cutoff, the step and buying power are checked in application code.
* **Rationale & Recommendation**: Write "Row locks serialise a user's bids; a partial unique index enforces one open bid per lot."

### style-1-8: "100% unit tested" doesn't name a metric - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 99.
* **Discrepancy Description**: It's unclear whether this means line or branch coverage, or how it's enforced.
* **Rationale & Recommendation**: Write "100% branch coverage enforced in CI", or drop the percentage.

### style-1-9: "One compose file" conflicts with two compose files - Severity: Nit
* **Reviewer Lens:** `egm-style` (also raised by `egm-codebase-details`)
* **Affected Scope:** Line 86 against lines 107, 209.
* **Discrepancy Description**: Line 86 says one compose file, while lines 107 and 209 name `docker-compose.yml` and `docker-compose.prod.yml`. "The same simple model as vinasLT" adds nothing.
* **Rationale & Recommendation**: Write "one compose file per environment" and drop the comparison.

### style-1-10: Remarks about vinasLT that don't affect any decision - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 221, 274.
* **Discrepancy Description**: "vinasLT has Telegram bot tokens committed…" and "(vinasLT has one)" don't change anything in this plan.
* **Rationale & Recommendation**: Remove both.

### style-1-11: Infrastructure values are vague - Severity: Nit
* **Reviewer Lens:** `egm-style` (also raised by `egm-implementation-readiness`)
* **Affected Scope:** Lines 207, 214, 216.
* **Discrepancy Description**: "roughly … e.g. … 16–32 GB", "2 replicas later if needed" and "Tuned `shared_buffers`" each lack a value or a trigger.
* **Rationale & Recommendation**: Give a starting value or trigger for each, for example `shared_buffers` at 25% of RAM, or write "decide in milestone N".

### style-1-12: Sentence fragments with no verb - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 218, 233.
* **Discrepancy Description**: "Volume." and "Relists, postponed sale dates." are fragments.
* **Rationale & Recommendation**: Rewrite them as full requirements.

### style-1-13: The reject message is wrong in some cases - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 142.
* **Discrepancy Description**: A bid above the top bid, but less than $100 above it, gets "another customer holds a higher bid", which is false.
* **Rationale & Recommendation**: Use "your max bid must be at least $100 above the current top bid".

### style-1-14: "Never overwrite each other" is an absolute claim - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 155.
* **Discrepancy Description**: The sentence promises an outcome but doesn't say what happens when a guarded update matches zero rows.
* **Rationale & Recommendation**: Write "a guarded update that matches zero rows is rejected and reported to the user".

### style-1-15: "You" is used for the reader - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 188, 310.
* **Discrepancy Description**: "you and the broker owner" and "which you review" assume the reader is the author.
* **Rationale & Recommendation**: Name the role, for example "the developer".

### style-1-16: Undefined abbreviations and terms - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 72, 152, 263.
* **Discrepancy Description**: "RSC", "SSR" and "auction session" (the digest) are never defined.
* **Rationale & Recommendation**: Expand the abbreviations, and define what the digest contains and when it's sent.

### style-1-17: Open item D4 is cryptic - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 324.
* **Discrepancy Description**: "missing from 'most'" depends on the wording of B9 to make sense.
* **Rationale & Recommendation**: Write "Which rates does the broker not have yet?"

### style-1-18: Test and roadmap items lack a measurable scope - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 229, 277.
* **Discrepancy Description**: "Matched to real broker invoices" doesn't say how many invoices. "AI natural-language search" is a buzzword.
* **Rationale & Recommendation**: Set a minimum, for example at least 5 invoices covering both auctions. Describe the capability, for example "free-text queries translated into filters".

### implementation-readiness-1-13: No rule for when the regenerated Better Auth tables differ from the draft - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Line 313.
* **Discrepancy Description**: The plan says to regenerate the Better Auth tables and compare them with the draft, but not what to do when they differ.
* **Rationale & Recommendation**: State that the CLI output wins for the auth tables, but the custom role check is kept.

### implementation-readiness-1-14: Several reference columns have no foreign key - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness` (also raised by `egm-codebase-details`)
* **Affected Scope:** Line 301. Schema: `bids.outbid_by_bid_id`, `deposit_transactions.bid_id`, `buying_power_entries.bid_id`, `notifications.bid_id`, `deposits.upgrades_deposit_id`, `lots.landed_estimate_rate_card_id`.
* **Discrepancy Description**: Line 301 says constraints enforce the rules, but these reference columns have no foreign key.
* **Rationale & Recommendation**: Add the foreign keys, or state that they are left out on purpose.

### implementation-readiness-1-15: The `bids.is_buy_now` column has no MVP rule - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Line 274, line 328 (D8). Schema: `schema.ts` 772.
* **Discrepancy Description**: Buy Now is Phase 2, but the column exists now.
* **Rationale & Recommendation**: State that the MVP always writes `false`, or remove the column.

### implementation-readiness-1-16: No list of environment variables - Severity: Nit
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Line 106.
* **Discrepancy Description**: Env validation is mentioned, but the required variables aren't listed.
* **Rationale & Recommendation**: List them: Stripe keys and webhook secret, apibara, Typesense, Telegram, Resend, KYC, Better Auth secret, database and Redis URLs.

### codebase-details-1-12: The Stripe dedupe index is partial, so admin-only rows aren't protected - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 300. Schema: `schema.ts` 526-528.
* **Discrepancy Description**: The index applies only `WHERE stripe_object_id IS NOT NULL`. Forfeit and apply-to-purchase rows have no Stripe id, so a double-click can insert them twice.
* **Rationale & Recommendation**: Note that the index is partial, and add an idempotency key for admin actions.

### codebase-details-1-13: Bidding on a `live` lot conflicts with the cutoff - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 137.
* **Discrepancy Description**: Bids must be placed before `sale_at − 1 h`, so allowing status `live` only makes sense if a lot can be `live` before the cutoff.
* **Rationale & Recommendation**: Confirm that this can happen, or drop `live` from the check.

### codebase-details-1-14: Unclear whether system changes go into `audit_log` - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 155. Schema: `schema.ts` 894.
* **Discrepancy Description**: The table is documented for staff actions only, but line 155 says every change writes `audit_log`, including the worker's. For worker changes, `actor_user_id` would be null.
* **Rationale & Recommendation**: State whether system changes are written there, and how the actor is recorded.

### codebase-details-1-15: "Rate cards are never edited in place" conflicts with editing drafts - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 307 against line 197.
* **Discrepancy Description**: Line 197 has staff edit a draft rate card, which is an in-place edit.
* **Rationale & Recommendation**: Say the rule applies after publishing. Say how a new draft is created, for example by copying the active card.

### codebase-details-1-16: No fallback when a yard has no time zone - Severity: Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Line 192. Schema: `schema.ts` 291.
* **Discrepancy Description**: The console shows times in the yard's time zone, but `yards.timezone` is nullable.
* **Rationale & Recommendation**: Give a fallback, for example derive the zone from the state, or show only Vilnius time.
