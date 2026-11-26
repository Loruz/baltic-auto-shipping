# Goldfish Review Report

**Target:** `/Users/vytautas/Projects/car-auction-platform-plan/IMPLEMENTATION-PLAN.md` (`lines 1-331, full file`)

**Stage:** 5 (Initial Zoom Out Review) · **Mode:** REVIEW · **Date:** 2026-11-20

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `zoom-out` | completed |
| `inventive-catalyst` | completed |

Coverage notes:
- `zoom-out` read the plan, `db/schema.ts` and all ten background files. Its verdict was "approve with changes".
- `inventive-catalyst` read the plan, `db/schema.ts`, and notes 02, 07 and 09 in full. It only searched `usa-car-auction-research/` for relevant terms. It did not open the research README, note 01 or note 04.

**Severity breakdown:** 0 Blocker · 10 Major · 11 Nit (21 findings after removing duplicates; the reviewers raised 23 in total).

Both reviewers say the plan's core is sound. They agree on the narrow scope (catalogue plus assisted bidding, nothing after a win), the modular monolith, the Stripe inbox and notification outbox, the ledger with a lockable account row, the partial unique index, and versioned rate cards. The findings below are about removing moving parts, closing gaps in the bid rules, and protecting the money data.

**Tension between the two lenses.** Zoom-out pushes for fewer moving parts. Inventive-catalyst adds a few safety mechanisms: a bid reconciler, WAL archiving and a ledger reconciliation job. They can be combined. If the plan adopts a Postgres-backed queue (finding 2), the new jobs in findings 7 and 10 become ordinary jobs added in the same transaction, with no new infrastructure.

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Typesense and the stored landed-EUR price rest on a weak metric and force regular full reindexes - Severity: Major
* **Reviewer Lens:** `zoom-out`, `inventive-catalyst` (merged)
* **Affected Scope:** Lines 48 (B7), 76-77 (§3 Search, Jobs), 122 (§4.1 step 5), 207 (§6 sizing); schema `lots.landed_estimate_eur_cents`
* **Discrepancy Description**: Typesense, the indexing pipeline and much of the 8 vCPU / 16-32 GB server sizing are justified mainly by "filter and sort by landed EUR price". That price is calculated from the vendor's current bid. For upcoming lots this bid is often stale and close to $0, so sorting by it says little about what a car will cost. The plan doesn't say which bid the estimate uses. The price is stored in EUR and depends on the daily FX rate and the active rate card. Every FX update or rate-card publish therefore means recomputing and reindexing every active and recently sold lot (100k-300k+). No worker job is listed for this. The cited research (`platform-analysis.md` §5, `carsfromusa-analysis.md` §9) advises starting with Postgres search and adding a search engine only when measurements show the need.
* **Rationale & Recommendation**: Choose one of these:
  * **(a) Simplest:** launch with Postgres search only: indexed filters, `pg_trgm` for VIN, lot number and make, and keyset pagination. Calculate landed EUR when the lot page and result cards are requested. Add Typesense when measured latency or facet needs justify it. This removes a container, the index-rebuild job and most of the pressure on server size.
  * **(b) If sorting by landed price must stay:** index a currency-neutral USD estimate. Convert the customer's EUR filter and sort bounds to USD at query time, so FX changes need no reindex and only a rate-card publish does. In either case, show the bid basis on screen ("at current bid") and budget the recompute job.

### 2. Three async mechanisms where one Postgres-backed queue would do - Severity: Major
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** §1 diagram (lines 24-34), line 47 (B6), line 77 (§3 Jobs), line 146 (§4.3 outbox), line 217 (§6 redis); §4.2 `stripe_events` inbox
* **Discrepancy Description**: Postgres already holds an outbox (`notifications`) and an inbox (`stripe_events`). Redis + BullMQ is added on top for scheduling and delivery. That makes three mechanisms and one more stateful container. Queued jobs also live outside the database backup, while the outbox rows that feed them live inside it.
* **Rationale & Recommendation**: Use a Postgres-backed queue such as pg-boss or graphile-worker. Jobs are then added in the same transaction as the bid or deposit change, so the outbox becomes the queue and no separate poller is needed. Cron schedules and separate critical and bulk queues are still supported. This removes Redis and the "queues only; no business state" rule the team would otherwise have to enforce. Go back to BullMQ only if sync volume proves too much for a Postgres queue.

### 3. Nine pricing tables and a generic table editor are fixed before the broker's spreadsheets exist - Severity: Major
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Line 50 (B9), line 197 (§5 Rate cards), line 291 (§9 Pricing group), line 313 (§9 tooling); open item D4 (line 324)
* **Discrepancy Description**: The plan says the broker's spreadsheets will decide the table shapes, and D4 is still open. Yet it already commits to six normalised rate tables, a TanStack table editor and a draft/preview/publish workflow. The calculator is a pure function that loads the whole rate card anyway, so splitting it across tables gives no benefit at query time.
* **Rationale & Recommendation**: Store each rate card as one versioned JSONB document in `rate_cards`, validated by a zod schema owned by `packages/pricing`. Keep `fx_rates` and `quotes` as their own tables. Editing can start as one form per section, or as a spreadsheet or JSON import with preview and publish. This keeps versioning and immutability, drops about six tables, and lets the shape follow the spreadsheets without migrations.

### 4. Phase 0 business checks don't block the milestones they can invalidate - Severity: Major
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** §8 Phase 0 (lines 249-256), milestone table (lines 258-269), risks table (lines 56-62)
* **Discrepancy Description**: Phase 0 "runs alongside the build". Several of its items can still invalidate whole milestones:
  * The apibara trial (removal events, final prices, IAAI coverage, quota) decides Milestone 2, which is 3 weeks of sync work.
  * Stripe accepting the deposit model (P0 risk R04 in `investigation-checklist.md`) decides Milestone 5.

  The research treats these as gates to clear before money is committed. §10 links D1-D11 to milestones, but Phase 0 items are not linked to anything.
* **Rationale & Recommendation**: Add a "Blocks" column to Phase 0. At minimum: apibara trial → M2, Stripe approval → M5, KYC provider and data processing agreement → M5, rate spreadsheets → M4. Order the milestones so no weeks are spent on a vendor or payment model that may be rejected.

### 5. Displaced bids are thrown away, which allows griefing, probing and lowering a bid - Severity: Major
* **Reviewer Lens:** `zoom-out`, `inventive-catalyst` (merged)
* **Affected Scope:** Lines 51-52 (B11, B12), lines 141-143 (§4.3); schema `bids_one_active_per_lot_uq`
* **Discrepancy Description**: Three rules interact badly:
  * A takeover immediately marks the earlier bid `outbid` and releases it.
  * The newer bid can be cancelled until the cutoff.
  * The rejection message "another customer holds a higher bid" tells the customer whether they are above or below the hidden amount.

  As a result:
  * A customer can take over a lot and then cancel. The original bidder has already been released and notified, and the lot ends up with no internal bid.
  * The same thing happens if the winning bidder is blocked or loses buying power to a dispute (D2).
  * Customers can find the hidden amount by bidding up in $100 steps. Each step costs a takeover, a release and a notification.
  * Cancelling and bidding again gets around "bids can never be lowered".

  The plan treats "the broker enters one bid per lot" as if the platform could only store one bid per lot.
* **Rationale & Recommendation**: Choose one consistent policy and write it into the terms of service (line 254).
  * **Preferred: keep a ranked queue.** Keep every max bid. Only the top one has the live status covered by the partial unique index; the others are `standby`. When the top bid is cancelled, blocked or revoked, promote the next valid bid after re-checking its buying power. The broker still gets exactly one bid per lot at cutoff. Decide whether standby bids reserve buying power: if they don't, a promotion can fail and must notify the customer; if they do, the customer's money sits idle.
  * **Simpler alternative:** a bid that took over a lot cannot be cancelled.
  * **Either way:** use a neutral rejection message, or rate-limit attempts.

### 6. The bid transaction can deadlock, and the first bid on a lot isn't protected by a lock - Severity: Major
* **Reviewer Lens:** `inventive-catalyst`, `zoom-out` (merged)
* **Affected Scope:** Lines 132-149 (§4.3), line 51 (B11), line 231 (§7.1 concurrency tests)
* **Discrepancy Description**: The lock on the bidder's own account row only serialises that user's requests. A takeover also changes the outbid customer's account in the same transaction, so locks are taken in an order that depends on who is bidding. Account A, then lot L, then account B, running at the same time as account B, then lot L, causes a deadlock. Postgres aborts one transaction, which is safe, but customers see errors at the busiest moment.

  Also, `SELECT … FROM bids WHERE lot_id=$l … FOR UPDATE` locks nothing when the lot has no active bid yet. Two first bids both pass the check, and the second fails with a raw unique-violation error instead of a clean "outbid" result. The partial unique index is doing the main work here, not acting as a backstop.
* **Rationale & Recommendation**: Take a per-lot lock first with `pg_advisory_xact_lock(lot_id)`. Don't use `FOR UPDATE` on the `lots` row, because sync upserts it every few minutes. Then lock every account the transaction touches in a fixed order (by `user_id`). Alternatively, mark the displaced bid `outbid` in the transaction and release that customer's buying power in a separate critical job. Add concurrency tests for both cases: A takes over B's bid while B raises a bid elsewhere, and two customers place the first bid on a lot at the same moment. Document the advisory lock, because the ORM doesn't show it.

### 7. Catalogue sync cancels bids and moves money on the bulk path, based on a single vendor status - Severity: Major
* **Reviewer Lens:** `inventive-catalyst`
* **Affected Scope:** Lines 118-121 (§4.1 step 4), line 215 (§6 worker row), line 116
* **Discrepancy Description**: The bulk sync job, which can lag from 15 seconds to 80 minutes according to the research, directly cancels pending bids, releases buying power and sends notifications. This puts ledger writes and account-row locks on the bulk path, which contradicts §6's promise that critical work is "never stuck behind bulk sync". A single wrong vendor status ("removed", "sold", or a sale date that jumps) cancels real customer bids at once. The plan protects lots against an empty feed (line 116) but gives bids no such protection.
* **Rationale & Recommendation**: Sync writes only catalogue rows, plus a `lot_changed` event (old and new status and sale date) in the same transaction. A bid reconciler on the critical queue applies the bid rules under the per-lot lock from finding 6. Process events in order per lot. Before cancelling on "removed" or "sold", require confirmation: either a second consecutive sync with the same status, or a short `on_hold` state that alerts the customer and broker without releasing power. With finding 2's Postgres queue, the event is simply a job.

### 8. Up to 24 hours of ledger and bid data can be lost, and the stated recovery sources don't cover it - Severity: Major
* **Reviewer Lens:** `inventive-catalyst`
* **Affected Scope:** Line 62 (risks table), line 220 (§6 backups), line 277 (Phase 3), line 269 (Milestone 9)
* **Discrepancy Description**: The accepted risk says Stripe and broker messages are partial recovery sources. The data most at risk can't be rebuilt from either: buying-power reservations and releases, takeovers, cancellations, broker results, and forfeits and "apply to car price" entries, which exist only in the admin panel. Continuous WAL archiving on one server is a config change plus a push to the Storage Box or R2 already planned.
* **Rationale & Recommendation**: Move WAL-G or pgBackRest archiving (`archive_timeout` around 60 s) into Milestone 9 instead of Phase 3, and keep `pg_dump` as an independent second copy. Add an alert for "WAL archive lag > N min" to §7.2, so a silently failing archive command doesn't fill the disk. Drill a point-in-time restore before launch.

### 9. Broker messages don't give a usable picture of current bids if the server dies - Severity: Major
* **Reviewer Lens:** `inventive-catalyst` (related: `zoom-out` on D5)
* **Affected Scope:** Line 49 (B8), line 31 (§1 diagram), line 146 (§4.3), line 152 (§4.4), line 325 (D5)
* **Discrepancy Description**: B8 promises that the broker "still has every bid in the messages". §4.3 sends a message only on place, raise and takeover. Nothing says cancellations, outbids, system cancellations or dispute revokes reach the broker. Each message describes a change, so after an outage the broker must replay the whole stream to work out the current bid per lot. One missing message leaves an old bid looking valid. D5 may also settle on a single channel, so one failed channel would defeat the fallback.
* **Rationale & Recommendation**: Make each broker message carry the full current state for that lot: the top bid, its amount, the customer, its status, and which earlier message it replaces. Send every status change. Make the cutoff digest the self-contained, authoritative list for each session, for example a CSV attachment plus a Telegram message. Send bid-critical messages on both channels, whatever D5 decides for routine ones. To limit noise, edit the earlier Telegram message for the same lot. This puts more personal data in email and Telegram, so check it against GDPR.

### 10. Nothing checks the ledger against itself or against Stripe after launch - Severity: Major
* **Reviewer Lens:** `inventive-catalyst`
* **Affected Scope:** Line 44 (B2 "must always match"), lines 235-241 (§7.2), line 271 (launch gate)
* **Discrepancy Description**: Matching buying power to money held depends on webhooks always arriving and on the cached account totals always moving with the entries. The launch gate checks this once, by hand. Stripe stops retrying after a few days, so an outage or a misconfigured endpoint would leave buying power too high with no alert. A bug that changes totals without writing an entry would also go unnoticed. The "unprocessed `stripe_events`" alert only covers events that actually arrived.
* **Rationale & Recommendation**: Add a scheduled reconciliation job that:
  * recomputes granted, reserved and consumed amounts from the entries and compares them with the cached totals;
  * fetches recent Stripe charges, refunds and disputes from the API and compares them with `deposit_transactions`;
  * checks that reserved amounts equal the sum of active bids.

  Use a grace window for events still in flight. Raise an alert on any mismatch, or replay missing Stripe objects through the normal idempotent handler.

### 11. Code-level detail in a planning document - Severity: Nit
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Lines 133-147 (§4.3 pseudo-SQL), line 167 (§4.6 signature), lines 310-313 (§9 tooling)
* **Discrepancy Description**: The SQL steps and CLI commands will go out of date. The plan should state the rules: lock order, invariants and what the database guarantees.
* **Rationale & Recommendation**: Cut §4.3 down to a short list of rules, including the lock-order rule from finding 6. Move the commands to `infra/runbooks` or the package READMEs.

### 12. Too many workspace packages for one developer - Severity: Nit
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Lines 96-106 (§3 Repository layout)
* **Discrepancy Description**: Ten packages under pnpm + Turborepo, used by only two apps, add manifests, tsconfig references and build dependencies.
* **Rationale & Recommendation**: Keep `pricing` and `db` as separate packages. Put bidding, billing, kyc, notifications, auctions and search as folders in one `packages/core`. Split them out later if a boundary actually causes problems.

### 13. A KYC provider interface with only one implementation - Severity: Nit
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Line 79 (§3 KYC), line 102 (layout); schema `kyc_provider` enum
* **Discrepancy Description**: Once D6 is decided, `KycProvider` has a single implementation.
* **Rationale & Recommendation**: Integrate the chosen provider behind a thin module boundary. Keep `LotDataProvider`, because the research gives a real reason for it (switching or mixing data vendors).

### 14. A settings screen for values that are fixed decisions - Severity: Nit
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Line 199 (§5 Settings); schema `site_settings`
* **Discrepancy Description**: Cutoff minutes and the takeover step are fixed by B11 and B12, so an editable table and screen for them is speculative.
* **Rationale & Recommendation**: Use constants or environment variables. Keep only the alert recipients editable if the broker must change them without a deploy. If the plan adopts finding 15's dynamic cutoff, the cutoff becomes a formula, not a setting.

### 15. The fixed 1-hour cutoff applies to every lot, whatever the broker's workload - Severity: Nit
* **Reviewer Lens:** `inventive-catalyst`
* **Affected Scope:** Line 52 (B12), line 152 (§4.4)
* **Discrepancy Description**: The cutoff exists because the broker enters bids by hand, and it takes away the customer's most price-sensitive hour. It is the same whether a session has 2 bids or 60.
* **Rationale & Recommendation**: Optionally, calculate the cutoff per auction session (a base time plus an allowance per bid, with a cap), fix it on the bid when the bid is accepted, and show it on the lot page. A shorter "raise only" window is another option. This adds rules to the terms of service.

### 16. Some MVP work contradicts what is deferred or still open - Severity: Nit
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Line 48 (B7), line 95 (worker list), line 268 (Milestone 8), line 274 (Phase 2), line 325 (D5); schema `vehicles.vin_decode`
* **Discrepancy Description**: Saved-search alerts appear in the worker list and are used to justify B7, but Phase 2 defers them, while Milestone 8 still builds saved searches. D5 (email or Telegram) is open, yet both channels are built. The schema has NHTSA VIN-decode columns, but no flow or milestone uses them.
* **Rationale & Recommendation**: Either drop saved searches and the alert job from the MVP, or move the alerts into it. Build one broker channel, except for bid-critical messages (see finding 9). Remove the VIN-decode columns, or add the job that fills them.

### 17. The `locked` status could be derived from the time instead of set by a job - Severity: Nit
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Line 152 (§4.4), line 237 (§7.2 alert)
* **Discrepancy Description**: A job runs every minute only to change `pending` to `locked`, which depends on nothing but the time. §4.3 already checks `now < cutoff`.
* **Rationale & Recommendation**: Optionally, treat "pending and past `cutoff_at`" as locked when reading, and keep only the broker-digest job. This also removes the "stuck in locked" alert. Keep the stored status if the console needs it.

### 18. "Read-only" impersonation is not something Better Auth provides - Severity: Nit
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Line 194 (§5 Customers)
* **Discrepancy Description**: Better Auth impersonation gives full access by default, so a read-only mode is extra work that the plan doesn't count.
* **Rationale & Recommendation**: Defer impersonation, or accept full impersonation behind step-up re-authentication with audit logging.

### 19. Typesense and Postgres share one server with no resource limits - Severity: Nit
* **Reviewer Lens:** `inventive-catalyst`
* **Affected Scope:** Lines 207-218 (§6)
* **Discrepancy Description**: Typesense keeps its index in RAM, and the plan already flags its memory use as unknown. A reindex or a growing index could push the Postgres instance that holds the money ledger into an out-of-memory kill or swap during an auction.
* **Rationale & Recommendation**: Set memory and CPU limits per container in compose, with guaranteed headroom for Postgres. Typesense can be rebuilt from Postgres, so it is the cheap piece to move to its own server later. This finding doesn't apply if finding 1(a) removes Typesense.

### 20. No alert for bids left unresolved after the sale - Severity: Nit
* **Reviewer Lens:** `inventive-catalyst`
* **Affected Scope:** Lines 235-241 (§7.2), line 121 (§4.1 step 4), line 153 (§4.4)
* **Discrepancy Description**: §7.2 alerts only on `locked` bids after the sale starts. A `placed` or `won_pending_approval` bid can stay open for hours after the vendor reports a result, keeping buying power reserved.
* **Rationale & Recommendation**: Alert when a placed bid's lot has a `lot_sales` row but no broker result after N hours. Offer the vendor's result as a one-click suggestion in the console.

### 21. Duplicate decision IDs and a week total that doesn't add up - Severity: Nit
* **Reviewer Lens:** `zoom-out`
* **Affected Scope:** Lines 42-54 (decision log), line 258 (Phase 1 header)
* **Discrepancy Description**: The decision ID B2 is used twice, B10 comes after B13, and B4, B5 and B8 are missing from the sequence. The Phase 1 header says about 14-18 weeks, but the milestone rows add up to 17-19 (2+3+2+2+[2-3]+2+2+1+[1-2]).
* **Rationale & Recommendation**: Renumber the decisions, or say that the gaps are intentional. Correct either the header or the rows.
