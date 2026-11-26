# Goldfish Review Report

**Target:** `/Users/vytautas/Projects/car-auction-platform-plan/IMPLEMENTATION-PLAN.md` (`lines 1-331, full file, unchanged since Stage 5`)

**Stage:** 8, Intermediate Zoom Out Review. This stage reads the plan alongside the Stage 5 (zoom-out), Stage 6 (comprehension) and Stage 7 (critic) reports.

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `egm-zoom-out` | completed |

**Severity breakdown:** 0 Blocker, 11 Major, 8 Nit (19 findings).

**Verdict:** Approve with changes. The plan's core still holds: a catalogue with assisted bidding, one monolith, a ledger with a lockable account row, an inbox and an outbox. Read together, the three earlier reports show two things:

- Many separate findings come from just two design choices: the stored landed-EUR search figure, and letting a new bid take over the top spot as soon as it arrives. Changing those two choices costs less than fixing each finding on its own.
- The earlier reports would add about ten new mechanisms. One developer cannot fit them into Milestone 9, which is planned for 1-2 weeks.

Finding ids from earlier reports are written as "zoom-out N" (Stage 5), "comprehension N" (Stage 6) and "design-1-N / structural-1-N / style-1-N" (Stage 7).

## Prioritized Findings (Blockers -> Major -> Nits)

### IZ-1: Drop Typesense and the stored landed-EUR figure together, and sync at the vendor's refresh rate - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 25-27, 48 (B7), 76-77, 95, 122, 207, 218, 262-264`; schema `lots.landed_estimate_eur_cents`
* **Related:** zoom-out 1, 19; design-1-1 (B7), design-1-2, design-1-4, design-1-6; style-1-1
* **Discrepancy Description**: Four reports attack the same chain of decisions from different sides:
  - Typesense is justified mainly by sorting results on the landed EUR price.
  - That price is misleading before bidding starts, because the current bid is often near $0.
  - Every exchange-rate update or rate-card change means recomputing and reindexing 100k-300k documents.
  - Polling every 1-5 minutes uses up apibara quota, but the vendor only refreshes every 15 minutes.

  Fixing these one at a time adds more machinery: a recompute job, memory limits per container, and a search index that does not depend on USD. The research the plan relies on recommends starting with Postgres search (platform-analysis.md section 5, carsfromusa-analysis.md section 9).
* **Rationale & Recommendation**: Adopt zoom-out 1(a) as one package:
  - Search with Postgres only.
  - Calculate landed EUR when the page loads, labelled "estimate at current bid".
  - Remove the stored landed-EUR column.
  - Poll at the vendor's 15-minute refresh rate.
  - Add expected volumes (per design-1-2).
  - State what would bring Typesense back, for example a p95 search-latency threshold.

  This removes a container, the reindex and recompute jobs, zoom-out 19 and most of the server-sizing concern at line 207. It also takes about a week off Milestone 2.

### IZ-2: Choose the winning bid at the cutoff instead of letting bids take over as they arrive - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 51 (B11), 52 (B12), 132-149, 152, 230-231`
* **Related:** zoom-out 5, 6, 17; design-1-12, design-1-13, style-1-2; comprehension 10
* **Discrepancy Description**: Today a new higher bid immediately replaces the current top bid on a lot. That one rule causes five separate problems:
  - **Griefing:** a customer can take the top spot and then cancel, leaving the lot with no internal bid.
  - **Lowering:** cancelling and re-bidding gets around the "never lower a bid" rule.
  - **Probing:** the rejection message reveals the hidden top amount.
  - **Deadlocks:** two customers' accounts are locked in an order that depends on who bids.
  - **First-bid race:** the per-lot `FOR UPDATE` lock does nothing when the lot has no bid yet.

  The tie rule (earliest bid wins) also cannot apply under a +$100 minimum step. The fixes proposed so far pile up: a ranked standby queue, advisory locks, account locks in a fixed order, rate limits and neutral wording. Yet the broker only needs one bid per lot, and only after the cutoff (lines 152-153).
* **Rationale & Recommendation**:
  - Accept any number of pending bids per lot. Each bid reserves only its own customer's buying power, so a bid locks one account.
  - The existing cutoff job resolves each lot once. The highest bid wins and the earliest wins a tie. The others become `outbid`, their buying power is released, and those customers are notified.
  - Narrow the partial unique index to the statuses after the cutoff (locked, placed, won_pending_approval).

  This removes the takeover path, the cross-account locking, the probing leak, the griefing and lowering problems, and the standby-queue machinery. The cost is that an outbid customer cannot respond after the cutoff. The broker must decide whether that is acceptable. Record the decision as a new D item and in the terms (line 254). If the broker rejects this model, fall back to the simpler option in zoom-out 5: a bid that took the top spot cannot be cancelled. Do not fall back to the ranked queue.

### IZ-3: The broker only needs the cutoff digest, not a message for every bid - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 31, 49 (B8), 146, 152, 325 (D5)`
* **Related:** zoom-out 9, 16; structural-1-2; design-1-7
* **Discrepancy Description**: B8 sends the broker an instant message for each bid. The broker cannot act on a bid until it is locked, so these messages are noise. Zoom-out 9 then makes them heavier: full lot state in every message, both channels, Telegram edits, CSV attachments, and a GDPR review.
* **Rationale & Recommendation**: Make the cutoff digest for each session the only bid message the broker receives. The digest stands on its own and goes out on both channels. An optional early digest can be added. This settles the B8/D5 contradiction, because D5 then covers only routine alerts. It also makes most of zoom-out 9 unnecessary and sends less personal data over Telegram.

### IZ-4: Catalogue sync should never change bids; the cutoff job and the broker handle that - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 118-121 (section 4.1 step 4), 215`
* **Related:** zoom-out 7, 17, 20; design-1-11
* **Discrepancy Description**: Zoom-out 7 rightly takes bid changes out of the bulk sync. It replaces them with a `lot_changed` event stream, a reconciler, per-lot ordering, and confirmation from two syncs or an `on_hold` state. That is a second state machine. The broker already checks the live auction page and can mark a bid `not_placed`.
* **Rationale & Recommendation**:
  - Sync writes catalogue rows only.
  - At the cutoff, the job re-checks each lot's status and how recently it was synced. It cancels bids on lots that are sold or removed, and flags lots with stale data in the digest.
  - Work out the cutoff from `lots.sale_at` instead of storing `bids.cutoff_at`.
  - Design-1-11 becomes one check in the bid transaction: reject the bid if `synced_at` is older than N minutes.
  - Keep zoom-out 20's alert for lots whose results were never resolved.

### IZ-5: Settle buying power as USD now, so exchange rates stay out of the bid transaction - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 43 (B2), 140, 327 (D7)`; schema `plan_versions.currency`, `buying_power_accounts.currency`
* **Related:** comprehension 4; design-1-9, design-1-10; zoom-out 10
* **Discrepancy Description**: Three reports flag the currency question, but none answers it. If buying power were held in EUR while bids are in USD, every bid check would need an exchange-rate conversion while the account is locked. Available power would also change every day, and could even go negative without the customer doing anything.
* **Rationale & Recommendation**: Decide D7 now:
  - Buying power is always in USD, fixed for each plan version, whatever currency the deposit was paid in.
  - Restate design-1-10 as "never exceeds money held, except commitments already placed at auction".
  - A partial refund reduces buying power in proportion, per plan version.

### IZ-6: Pick one backup method, not two - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 62, 220, 277`
* **Related:** zoom-out 8; design-1-7
* **Discrepancy Description**: The earlier reports add all of the following inside Milestone 9:
  - WAL-G or pgBackRest, plus pg_dump as a second backup;
  - an alert on WAL archive lag;
  - point-in-time restore drills;
  - recovery targets (RPO/RTO) and a reconciliation runbook.
* **Rationale & Recommendation**:
  - Run an hourly `pg_dump` of the business tables only. Leave out `lot_raw`, `lots` and `vehicles`, which can be rebuilt from the vendor. This gives a recovery point of about one hour with no new tool.
  - Keep the nightly full dump.
  - Write a one-paragraph recovery target and restore runbook.
  - Revisit WAL-G only if the hourly dump becomes too slow.

### IZ-7: Make the ledger impossible to drift instead of building a job to detect drift - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 44, 128, 145, 235-241, 299`
* **Related:** zoom-out 10
* **Discrepancy Description**: Zoom-out 10 adds a scheduled reconciliation job with three parts. Its third part checks cached totals against ledger entries, a gap the design itself creates.
* **Rationale & Recommendation**:
  - Keep `buying_power_accounts` only as the row that gets locked. Calculate the totals by adding up ledger entries inside the transaction. Each user will have only hundreds of entries, so this stays fast.
  - Run one nightly SQL check that reserved amounts match active bids.
  - For Stripe, rely on Stripe's own alerts when webhooks fail, plus a monthly manual check against Stripe's balance report.
  - Automate Stripe reconciliation only after a real mismatch happens.

### IZ-12: Earlier reports disagree about the cutoff job: one deletes it, two add to it - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 152, 237`
* **Related:** zoom-out 17 vs zoom-out 7 and 15
* **Discrepancy Description**: Zoom-out 17 says to work out `locked` from the time and drop the job. Zoom-out 7 adds a reconciler. Zoom-out 15 turns the cutoff into a formula.
* **Rationale & Recommendation**: Under IZ-2 and IZ-4, the cutoff job does real work: it resolves winners, re-checks lots and sends the digest. Keep the job and the stored `locked` status. Close zoom-out 17, drop zoom-out 15, and fold the zoom-out 7 reconciler into this job.

### IZ-13: Earlier reports disagree about Typesense: keep it with safeguards, or remove it - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 48, 76, 207, 218`
* **Related:** zoom-out 1(a) vs 1(b), zoom-out 19, design-1-6
* **Discrepancy Description**: Design-1-6 and zoom-out 19 both assume Typesense stays. Zoom-out 1(a) removes it.
* **Rationale & Recommendation**: Decide IZ-1 first. Zoom-out 19 and the USD-neutral index from 1(b) apply only if Typesense is kept. Do not write up both paths.

### IZ-14: Earlier reports give three different fixes for bids on the same lot - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 51, 141-143`
* **Related:** zoom-out 5 vs design-1-12 vs zoom-out 6
* **Discrepancy Description**: The three fixes are a ranked queue (zoom-out 5), "reject bids below the current top" (design-1-12), and a lock design (zoom-out 6). The lock design only makes sense if a new bid takes over immediately.
* **Rationale & Recommendation**: Settle this with IZ-2 before writing the section 4.3 rules. Zoom-out 11 then needs to document only one invariant: each transaction locks one account, and per-lot resolution happens only in the cutoff job.

### IZ-16: Nobody added up the extra scope against the schedule - Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 258-271`
* **Related:** zoom-out 21, 4; design-1-5
* **Discrepancy Description**: No report re-estimated the timeline after adding work. The milestone rows already add up to 17-19 weeks. Milestone 9 (1-2 weeks) already holds the concurrency tests, backups, restore drills, alerts and security pass, and the earlier reports add more to it.
* **Rationale & Recommendation**:
  - Keep a scope ledger: list every accepted change with its effect in weeks, plus or minus.
  - Rough estimate: IZ-1, zoom-out 2, zoom-out 3 and zoom-out 12 save about 2-3 weeks. IZ-2, IZ-3 and IZ-4 cancel out most of the proposed additions.
  - Update the header estimate to match the milestone rows.
  - Change the build order. Pricing (M4) and the bidding core (M6) do not depend on any vendor, so build them first against test data. Start M2 (apibara) and M5 (Stripe and KYC) only after their Phase 0 checks pass.

### IZ-8: Turn down the dynamic cutoff and the per-sale-window capacity cap - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 52, 152, 199`
* **Related:** zoom-out 14, 15; design-1-8
* **Discrepancy Description**: A cutoff calculated per session and a cap on bids per sale window are both rules added before any data shows they are needed. Each would also need wording in the terms of service.
* **Rationale & Recommendation**:
  - Keep the cutoff fixed at 1 hour.
  - `plan.max_active_bids` already limits volume.
  - Log `placed_at - locked_at` to see how long the broker takes, and revisit with that data.
  - A backup operator is a staffing decision, not something to build.

### IZ-9: Make the critic's Alternatives Rule blocker a short column and downgrade it - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 40-54`
* **Related:** design-1-1 (Blocker), structural-1-1, structural-1-2
* **Discrepancy Description**: A full "alternatives considered" section for every decision is too much for a plan written by one developer.
* **Rationale & Recommendation**: Add one "Rejected (why)" column to the decisions table. Fill it in only for B2, B3, B7, B11 and B12. Most of the entries come from IZ-1, IZ-2 and IZ-6. Downgrade the critic's finding from Blocker to Major.

### IZ-10: Neither licence risk nor refunds need new mechanisms - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 60, 157-164, 194`
* **Related:** design-1-3; comprehension 7
* **Discrepancy Description**: Design-1-3 proposes a technical "kill switch" for licence risk. Self-service refunds are also not fully specified.
* **Rationale & Recommendation**:
  - **Licence risk:** in the MVP, mark sold-lot pages `noindex` and add one environment flag that hides them. The SEO archive is already Phase 2 (line 274).
  - **Refunds:** add a "Request refund" button that notifies the broker through the outbox. The refund itself stays in the admin flow (line 160). This also answers comprehension 7.

### IZ-11: Rate limits and neutral wording against bid probing are unnecessary under IZ-2 - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Line 142`
* **Related:** design-1-12; zoom-out 5
* **Discrepancy Description**: When winners are chosen only at the cutoff, nothing about other bids is revealed before then.
* **Rationale & Recommendation**: If IZ-2 is accepted, drop both fixes. If it is rejected, use neutral wording only and skip the rate limiter.

### IZ-15: Earlier reports disagree about which broker channel to use, and how many - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 49, 81, 325`
* **Related:** zoom-out 16 vs zoom-out 9 vs structural-1-2
* **Discrepancy Description**: Zoom-out 16 says build one channel. Zoom-out 9 says send bid-critical messages on both. Structural-1-2 asks for B8/D5 to be resolved.
* **Rationale & Recommendation**: IZ-3 settles this. The digest goes on both channels, nothing else is bid-critical, and D5 covers only routine alerts.

### IZ-17: Vendor image links may expire, which breaks bid evidence and the archive (missed by all stages) - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Lines 82-83, 144, 250, 298`; schema `bids.lot_snapshot`, `lots.images`
* **Discrepancy Description**: The plan stores only the vendor's image URLs. Research 01 asks how long those URLs stay valid, but Phase 0 (line 250) does not include the question. If the links expire:
  - the snapshot saved with each bid loses its photos, which matter as evidence in a dispute or forfeit;
  - sold-archive pages show broken images.
* **Rationale & Recommendation**: Add the image-lifetime question to the apibara trial. If links do expire, copy photos to R2 only for lots that receive bids. That is the "add R2 when needed" trigger line 82 already allows.

### IZ-18: The launch check calls Stripe test mode "real money" (missed by all stages) - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Line 271`
* **Discrepancy Description**: Stripe test mode moves no money, so the launch check as written could pass without a single real payment.
* **Rationale & Recommendation**: Rehearse in test mode first. Then run one small cycle in live mode: deposit, bid, refund and, if Stripe allows it, a deliberate dispute. Check that the ledger totals match Stripe's balance report.

### IZ-19: B7 mixes up why to keep a local copy and why to use a search engine - Severity: Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** `Line 48`
* **Related:** design-1-4 (partial)
* **Discrepancy Description**: The real reason to keep a local copy of the catalogue is that user traffic never calls the vendor API. That holds with or without Typesense.
* **Rationale & Recommendation**: Reword B7 so the local copy is one decision and the search engine is a separate, deferred one. The local copy keeps its own reasons: resilience during vendor outages, and the sold archive (research 09 section 5).

## Suggested Order of Resolution

1. Decide IZ-2, the bid model. This is a question for the broker.
2. Decide IZ-1, the search setup.
3. Decide IZ-5, the currency for buying power (D7).
4. Apply IZ-3, IZ-4, IZ-6 and IZ-7 in place of zoom-out 5, 6, 7, 8, 9 and 10.
5. Update the schedule (IZ-16).
6. Apply the editorial findings from comprehension 1-14 and the critic's structure and style findings. These do not depend on the decisions above.
