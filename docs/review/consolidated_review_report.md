# Consolidated Review — IMPLEMENTATION-PLAN.md

Review date: 2026-11-21. Mode: interactive, all stages. The plan was **not edited** during the review; the author chose to discuss all findings after the review finished.

| Stage | Report | Blocker | Major | Nit |
|---|---|---:|---:|---:|
| 5 Initial zoom out | `zoom_out_report.md` | 0 | 10 | 11 |
| 6 Comprehension | `comprehension_report.md` | 0 | 7 | 7 |
| 7 Critic (lines 1–65) | `critic_report.md` | 1 | 20 | 15 |
| 8 Intermediate zoom out | `intermediate_zoom_out_report.md` | 0 | 11 | 8 |
| 9 Implementation readiness (lines 66–331) | `implementation_readiness_report.md` | 5 | 23 | 22 |
| **Total raised** | | **6** | **71** | **63** |

Many findings repeat across stages. Grouped by root cause, they come down to the action items below. The **Source** column cites the original finding IDs; the reports hold the full text.

The **Proposed action** column gives my recommendation as the author of the plan:
- **Fix:** a mistake or gap to correct.
- **Decide:** needs a choice from you or the broker before editing.
- **Contest:** I recommend not changing the plan, and say why.

## A. Decisions needed first (they change the shape of the plan)

| # | Item | Source | Proposed action |
|---|---|---|---|
| A1 | **Bid allocation model.** Instant takeover (+$100) lets customers game it: they can take over a lot and cancel, probe the hidden amount, or cancel and rebid lower. It also allows deadlocks and a race between the first two bids. The alternative is to keep every max bid sealed and pick the highest at the cutoff. | Stage 5 major 5–6, Stage 7 majors, IZ-2, IZ-14, readiness-1-3 | **Decide (broker). ⏳ Waiting for the broker's answer (2026-11-21).** Sealed bids picked at the cutoff remove most of the bid findings in one change. If instant takeover stays, the plan needs: a per-lot advisory lock, a fixed lock order, a rule that takeover bids can't be cancelled, a neutral rejection message, and a clear meaning for "tie". |
| A2 | **Search engine and the landed EUR price.** The stored landed price is calculated from a pre-bid near $0, and every FX or rate change forces a reindex. B7 mixes up two separate needs, a local copy of the lots and a search engine. | Stage 5 major 1, Stage 7, IZ-1, IZ-13, IZ-19 | **✅ Decided 2026-11-21:** no stored landed price; the landed EUR price is calculated on lot pages and in the calculator only, and landed-price sort/filter is out of launch scope. Postgres search at launch, no Typesense. Typesense can be added behind `packages/search` if measured performance needs it. Original note: Keep the local copy either way. Choose Typesense or Postgres-only search, and choose what the landed price is calculated from (e.g. estimated retail value, or no stored value at all). |
| A3 | **Buying-power currency (D7).** Bids are in USD, but buying power may be in EUR. | Comprehension 4, readiness codebase-1-10, IZ-5 | **✅ Decided 2026-11-21:** USD everywhere. Buying power, plan amounts, bids and the deposit charge are all in USD. EUR appears only in the landed-price calculator. This closes open item D7. |
| A4 | **Provisional defaults for open items D2–D11.** These block milestones 1 and 4–6. | readiness-1-2, Stage 7 ("decided" items still open) | **Fix.** For each open item, write down a default the build can use until the broker answers, and mark it provisional. |

## B. Correctness errors in the plan or schema (fix regardless of A)

| # | Item | Source | Proposed action |
|---|---|---|---|
| B1 | `status IN (active)` uses a status that doesn't exist. "Active" and "live" are never defined. | codebase-1-1, comprehension 5 | **Fix:** define active = pending, locked, placed, won_pending_approval. Add one bid state table to the plan. |
| B2 | The "export-status override" has no column in the schema. | codebase-1-2 | **Fix:** add `export_status_override` to `lots` and say that admin writes it, not sync. |
| B3 | Bank transfers: `checkout.session.completed` arrives before the money does. | codebase-1-7 | **Fix:** grant buying power on `checkout.session.async_payment_succeeded` / `payment_intent.succeeded`, and only when `payment_status = paid`. |
| B4 | A refund started in the admin panel gets recorded twice when Stripe's webhook also reports it. | codebase-1-8 | **Fix:** save the Stripe refund ID before calling the API, and use the same ID for deduplication on both paths. |
| B5 | `drizzle-kit migrate` can't run: there is no `meta/` journal, no `drizzle.config.ts` and no `dbml.ts`. | codebase-1-3 | **Fix:** add them to `db/`, or describe the generate step instead of shipping the SQL file. |
| B6 | Better Auth's default role `user` fails `user_role_chk`. | readiness-1-8 | **Fix:** set the admin plugin's `defaultRole: "customer"`, or allow `user` in the check. |
| B7 | When the buying-power account row is created is undefined, so `FOR UPDATE` may lock nothing. | readiness-1-3 | **Fix:** create the row on sign-up, or upsert it before taking the lock. |
| B8 | The launch gate says Stripe test mode uses "real money". | IZ-18 | **Fix the wording.** |
| B9 | Phase 1 is given as 14–18 weeks, but the milestones add up to 17–19. | style-1-1, IZ-16 | **Fix** the total and the milestone order (vendor-independent work first). |

## C. Missing content (fix)

| # | Item | Source |
|---|---|---|
| C1 | Define the parties: client vs. broker vs. developer, who owns the Stripe account, and the target customers (LT/EU buyers and dealers). | comprehension 1, 6, Stage 7 |
| C2 | Introduce apibara, vinasLT and abetter.bid in one line each. Add a short glossary (Copart, IAAI, hammer price, lot). | comprehension 2, 3, 14 |
| C3 | Decision log: renumber the IDs (duplicate B2, missing B4/B5), and add the rejected alternatives to each decision (the Stage 7 blocker). | design-1-1, comprehension 8, Stage 7 |
| C4 | Explain how buying power works in plain words in §1/§2, before the SQL sketch. | comprehension 4 |
| C5 | Describe how a customer gets the deposit back: requesting a refund, and what happens while bids are open or after a car is won. | comprehension 7 |
| C6 | Add a cancel flow, keep payment status separate from bid status, and describe sync side effects and vehicle matching. | readiness majors |
| C7 | Give exit criteria for each milestone and the files each one creates. Say where the `db/*` drafts move to. | readiness-1-1, readiness majors |
| C8 | Image links can expire, which breaks the lot snapshot on bids and the sold archive. | IZ-17 |
| C9 | Calculator formulas, outbox retry policy and alert thresholds as concrete numbers. | readiness majors |

## D. Proposals I recommend contesting

| # | Proposal | Source | Why not |
|---|---|---|---|
| D1 | Send the broker only the cutoff digest, not a message for every bid. | IZ-3 | It defeats B8's purpose. If the server dies before the cutoff, the broker has nothing. A good compromise is for each message to carry the current state of its lot, not just what changed (Stage 5 major 9). |
| D2 | Add expected volume figures. | Stage 7 | The platform starts from zero traffic, so there are no real numbers. Instead, state scaling triggers (apibara quota, Typesense memory). |
| D3 | Measure B6's rationale. | Stage 7 | The reason for one monolith is how much one developer can operate, which isn't something to measure. Keep it, and add the rejected alternative (C3). |
| D4 | A full business risk register (AML, working capital, GDPR). | Stage 7 | That belongs in the business documents. Link to `usa-car-auction-research/investigation-checklist.md`, which already covers it. |
| D5 | Replace Redis/BullMQ with a Postgres queue (pg-boss). | Stage 5 major 2 | **Optional.** It removes one container and one mechanism, and it fits the outbox well. Worth taking if A2 drops Typesense; otherwise either works. |
| D6 | WAL archiving or hourly dumps before launch. | Stage 5 major 8, IZ-6 | Risk accepted in B8. An hourly dump of the money and bid tables is cheap, though. Reconsider once the plan's size is settled. |

## Suggested order for our discussion

1. Decide A1, A2 and A3. These are the ones that need the broker or a product choice.
2. I apply B1–B9 and C1–C9 to the plan and schema, then re-run the constraint tests.
3. Re-run Stage 9 once on the updated plan.

## Applied in plan v2 (2026-11-21)

Items **A2**, **A3**, **A4** (provisional defaults for every open item), **B1–B9** and **C1–C9** are applied to `IMPLEMENTATION-PLAN.md` v2 and `db/schema.ts` v2.

Version 1 is kept as `review/IMPLEMENTATION-PLAN.v1.md`, so the line numbers in the stage reports still match.

**Still open:** **A1**. The text that depends on it is marked ⏳ A1 in the plan. The decision is waiting for the broker.

**Contested items D1–D6 (none applied as proposed):**
- D1: each broker message now carries its lot's full current state, instead of switching to a digest only.
- D2: replaced by the speed target in M4.
- D4: risk table links to the investigation checklist.
- D5: Redis/BullMQ is kept.
- D6: hourly dumps of the money and bid tables were added. WAL archiving was not.

**Schema v2 verification:**
- Generated with drizzle-kit, including the `meta/` journal.
- Applied with drizzle-orm's migrator to Postgres 17.
- All 13 self-checking constraint tests passed.
- The test harness was confirmed to fail when an expectation is wrong.

## Stage 9 round 2 and plan v2.1 (2026-11-21)

The round-2 re-check (`implementation_readiness_report_round2.md`) found 2 blockers, 22 major and 28 minor findings. 27 of the 52 round-1 findings were fully fixed. The stage's one allowed re-check is now used, so **no further review round was run**.

**Fixed in plan v2.1 and schema v2.1:**
- `unknown` value added to `lot_status` and `sale_outcome` (codebase-details-2-1).
- Percentages divided by 100 in every formula, and an `in_vat_base` flag added to fixed fees.
- An explicit USD→EUR step, and an upper bound on the reverse calculator.
- `quotes.total_eur_cents` can be null for "price on request".
- Buying-power ledger rules table; `adjust` split into `adjust_up` / `adjust_down`; revokes capped at the granted total; forfeits restore the consumed amount.
- The postponement rules in §4.1 aligned with §4.4, including a new `placed → not_placed` transition.
- A1 provisional design: raising or taking over is only allowed while the top bid is `pending`.
- Retried requests return the original result.
- Vehicle matching reuses the lot's vehicle when there is no VIN.
- The `pg_trgm` migration added to M4.
- The launch-gate check compares gross Stripe amounts.
- The "flagged" wording aligned between §4.5 and D2.

**Schema v2.1 checks:**
- Migration regenerated and applied with the Drizzle migrator.
- All 13 constraint tests pass.

**Contested:**
- implementation-readiness-2-1 (an exact create/modify/delete file list for every milestone). The key folders and files per milestone are enough before any code exists. Exact file lists belong in each milestone's own task breakdown.

**Left open as remaining work** (recorded in the round-2 report; settle at the milestone that builds each part):
- the Postgres search specification and facet queries;
- the Stripe processing failure policy;
- the full template-to-transition coverage;
- where step-up and outbox-recovery state is stored;
- restoring the hourly partial backup (foreign-key order);
- lock order for operator actions;
- the §10 "Blocks" column wording, and the remaining Nits.
