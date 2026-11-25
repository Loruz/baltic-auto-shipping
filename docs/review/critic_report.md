# Goldfish Review Report

**Target:** `/Users/vytautas/Projects/car-auction-platform-plan/IMPLEMENTATION-PLAN.md` (lines 1-65: title through §2 "Decision log", ending before "## 3. Tech stack")

Stage 7 (Critic Review), round 1. Standard used for the design and structural lenses: `feature-spec-standard.md`. The style lens used no standard.

## Reviewer Status

| Reviewer | Status | Raw findings (B / M / N) |
| --- | --- | --- |
| `egm-design` | completed | 1 / 11 / 8 |
| `egm-structural` | completed | 0 / 5 / 5 |
| `egm-style` | completed | 0 / 9 / 9 |

When reviewers reported the same issue, those findings are merged into one entry. The merged entry keeps the id of the reviewer with the fullest version and lists the other lenses. Where reviewers gave the same issue different severities, the report uses the highest severity that the reasoning supports.

**After deduplication:** 1 Blocker, 20 Major, 15 Nit (36 findings).

## Prioritized Findings (Blockers -> Major -> Nits)

---

## Blockers

### design-1-1: The decision log fails the Alternatives Rule - Severity: Blocker
* **Reviewer Lens:** `egm-design` (also `egm-structural` as Major)
* **Affected Scope:** Lines 40-54
* **Discrepancy Description**: Nearly every decision states one chosen path. It does not say which alternatives were considered or why they were rejected. Only B6 names a rejected option (vinasLT's microservices). Where the background research documented real alternatives, the log ignores them:
  * **B7 (Typesense):** the research (platform-analysis §5/§6, carsfromusa-analysis §9) recommends starting with Postgres search.
  * **B3 (apibara for everything):** research 09 §3 suggests apibara plus apicars.auction for history, or a single vendor such as auctionsapi.com or auction-data.info.
  * **B12 (1 h cutoff):** the only reason given is "abetter.bid also does it". Vinas uses 10 min.
  * **B8 (nightly pg_dump):** WAL archiving or point-in-time recovery is deferred without a reason.
  * **B2 (captured deposit):** card holds, a deposit sized per bid (the CarsFromUSA approach) and slot-only plans are not discussed.
  * **B11 (displace-and-notify):** rejecting bids below the current top (research 07 §3.4) is not discussed.
  * **B1 and B13:** both list deferred or excluded options without saying why.

  The single "Why / notes" column also mixes the reasons with deferred options and action items, for example "Check during the trial".
* **Rationale & Recommendation**: The standard fails any spec that proposes a single path without showing other viable designs were considered. Split the column into "Rationale", "Alternatives rejected (and why)" and "Dependency / open item", or add an "Alternatives considered" subsection. At minimum, cover B2, B3, B7, B8, B11 and B12, and give each rejected option a concrete reason: cost, complexity or risk.

---

## Major

### design-1-2: There is no problem statement, scale assumptions or success measures - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-structural`
* **Affected Scope:** Lines 18-34 (§1)
* **Discrepancy Description**: §1 says what the platform is and isn't, but not what problem it solves or for whom. It never names the Lithuanian import buyers, today's manual broker process, or the business goal. There are no volume figures: lots, archive size, customers, bids per auction night, or peak bids before the cutoff. Without them, no sizing decision can be checked, including the Typesense memory, the apibara tier, the single VPS and the manual broker workload.
* **Rationale & Recommendation**: Open §1 with a short problem statement (users, current pain, business goal). Label "It is" and "It is not" as Goals and Non-Goals. Add a table of expected numbers at launch and at month 12.

### structural-1-1: Decision IDs are duplicated, out of order and have gaps - Severity: Major
* **Reviewer Lens:** `egm-structural` (also `egm-style` and `egm-design` as Nit)
* **Affected Scope:** Lines 43-54
* **Discrepancy Description**: The ID column has four problems:
  * B2 is used twice (lines 43 and 44).
  * B2b is an improvised sub-ID.
  * B4 and B5 are missing with no explanation.
  * B10 comes after B13.

  Later sections cite these IDs (for example "B11/B12" in §7.1 and §8), so a reader can't tell which B2 is meant or whether B4 and B5 were dropped.
* **Rationale & Recommendation**: Give each decision its own stable ID and sort the rows by ID. Note B4 and B5 as retired or merged.

### structural-1-2: The log calls items "decided" that are still open in §10 - Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-style`
* **Affected Scope:** Lines 5, 42, 43, 46, 49, 53
* **Discrepancy Description**: Line 5 says "Every decision below was made in the 2026-11 planning interview". Several rows, however, depend on open items in §10:
  * **B8:** commits to email and Telegram alerts, but D5 still asks "Telegram or email (or both)?". This is a direct contradiction.
  * **B2:** "about 10%" and "about 3 plans" are still open in D10, and the deposit currency is open in D7.
  * **B13:** "Ondato or Veriff" is still open in D6.
  * **B3:** is a trial assumption, not a decision.
  * **B1:** its deferred options are D1, but the row doesn't link to D1.
* **Rationale & Recommendation**: Reword line 5 to say that some rows are provisional. Add the matching D-reference to each affected row. Resolve the B8/D5 contradiction one way or the other.

### structural-1-3: The risk table is not a heading, and its column mixes owners with mitigations - Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-style`
* **Affected Scope:** Lines 56-62
* **Discrepancy Description**: "Risks accepted knowingly" is bold text, not a heading, and it sits inside the Decision log. Its "Who carries it" column holds actions and mitigations instead of owners:
  * Line 60 holds an action: "Get this acknowledged in writing".
  * Line 61 holds a mitigation, and its "reduce it" has an unclear "it".
  * Line 62 names no owner at all.

  "Accepted knowingly" is also redundant: "accepted" already implies it.
* **Rationale & Recommendation**: Make it a real heading, such as "### 2.1 Accepted risks". Use the columns Risk | Owner | Mitigation | Residual / acceptance.

### design-1-3: The risk table leaves out major risks the research identified - Severity: Major
* **Reviewer Lens:** `egm-design` (also `egm-structural` within structural-1-3)
* **Affected Scope:** Lines 56-62
* **Discrepancy Description**: Only three risks are listed. The table leaves out:
  * Stripe rejecting or limiting the deposit model (R04), with no fallback.
  * Dependence on a single lot-data vendor (apibara), whether it has an outage or goes out of business.
  * Working capital and supplier payment deadlines (R05).
  * AML and GDPR obligations, including customer data sent over Telegram.
  * EU withdrawal rights for deposits.
  * The broker being unavailable, or entering a bid wrongly or not at all (B1/B12).
  * A single VPS (B6).

  The data-licence risk is mitigated only by a written acknowledgement, with no technical containment.
* **Rationale & Recommendation**: Add these rows, each with an owner and a mitigation. Give the licence risk a concrete technical step, such as a switch that turns off the public SEO archive and photo hotlinking, and keeping the broker's account identity off the site.

### design-1-4: apibara cost and quota are asserted, not calculated - Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-style`
* **Affected Scope:** Lines 46 (B3), 48 (B7)
* **Discrepancy Description**: "Needs apibara Pro ($70) or higher" gives no billing period (the research says $70/month) and no request arithmetic. The catalogue is about 100k-300k active lots, with snapshots every few hours, a 1-5 minute change feed and final-price lookups. That load could reach hundreds of thousands of requests a month. The research does not state Pro's quota (Mega is 1M requests at $125). The vendor refreshes data only every 15 minutes, so polling every minute spends quota for no gain in freshness. "Keeps API cost the same as traffic grows" is also unclear: the cost depends on sync volume, not on site traffic.
* **Rationale & Recommendation**: Calculate monthly requests: page size × catalogue × snapshot frequency, plus polls, plus sale-result calls. Choose a tier with headroom. Match polling to the vendor's 15-minute refresh. Make "quota fits" a Phase 0 exit criterion. Reword the line to "API cost depends on sync volume, not site traffic".

### design-1-5: B3 has no fallback if the vendor trial fails - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Line 46
* **Discrepancy Description**: B3 assumes apibara provides IAAI data and final prices. Research 09 says apibara's access to historical data is "not stated". The sold archive feeds three things: the result hint in the broker console, the SEO archive and the "similar cars sold for" feature. If the trial fails, there is no named fallback, so milestone 2 is at risk.
* **Rationale & Recommendation**: Restate B3 as an assumption with an exit criterion. Name a fallback, such as apicars.auction behind `LotDataProvider`, with its cost and its effect on the schedule.

### design-1-6: Filtering by landed EUR rests on a misleading input and has a hidden recompute cost - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 48 (B7), 50 (B9)
* **Discrepancy Description**: Before the live auction, a lot's current bid is a pre-bid, often near $0. So for most upcoming lots, `landed_estimate_eur_cents` amounts to fees plus shipping plus taxes, and sorting or filtering on it misleads customers. The value also depends on the daily FX rate and the rate card, so every FX update or rate-card publish forces a recompute and reindex of about 300k documents. That job is not planned anywhere.
* **Rationale & Recommendation**: Decide what bid amount the searchable figure is based on (current bid, average sold price of similar cars, or fees only) and label it honestly. Specify a bulk recompute job, with its expected duration, on the bulk queue.

### style-1-1: "Landed price" presents an estimate as a firm price - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 20, 27, 48
* **Discrepancy Description**: The text says "a landed price in EUR", while the schema field is `landed_estimate_eur_cents` and §4.6 lists extras that the figure leaves out.
* **Rationale & Recommendation**: Say "estimated landed cost in EUR" on first use and use that term throughout. This is related to design-1-6.

### design-1-7: A single VPS on auction night and up to 24 h of data loss are weakly mitigated for a money ledger - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 47 (B6), 49 (B8), 62
* **Discrepancy Description**: One VPS hosts every component and is a single point of failure in the hour before the cutoff. No recovery time (RTO) is stated. The claim "the broker still has every bid in the messages" only holds if the asynchronous outbox delivered before the failure. Raises, cancellations and outbid changes also have to be messaged, or the message history is misleading. Rebuilding up to 24 h of deposits and buying-power entries means manual reconciliation against Stripe. The investigation checklist (R20, §7) treats this as a launch gate.
* **Rationale & Recommendation**: State recovery-point (RPO) and recovery-time (RTO) targets. Consider WAL archiving at launch. Make broker messages carry the full current bid state for each lot. Write a restore and reconciliation runbook.

### design-1-8: One broker entering every bid by hand is an unexamined capacity limit - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 42 (B1), 52 (B12)
* **Discrepancy Description**: One person, with one Copart and one IAAI account, enters every bid within a 1 h window during the Lithuanian night. The plan gives no throughput estimate, no backup operator and no cap on bids per sale window. The cutoff depends on the vendor's `sale_at`, which can be 15+ minutes stale and changes often at IAAI. The plan also ignores time zones and daylight-saving changes.
* **Rationale & Recommendation**: Estimate bids per night against the time it takes to place one bid. Require a backup operator. Consider a capacity cap per sale window. State how the cutoff is derived and how stale it may be. Add this to the risk table.

### design-1-9: The deposit-sizing rationale is unsourced and ignores currency and working capital - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 43 (B2), 45 (B2b)
* **Discrepancy Description**: The rationale has three gaps:
  * **Unsourced penalty:** "Copart's ~10% penalty" has no source. Minimum penalties and extra fees (relist, storage, late fees) would exceed 10% on cheap cars.
  * **Currency mismatch:** the deposit currency is still open (D7), while buying power defaults to USD in the schema.
  * **Working-capital gap:** the broker must pay Copart within 2 business days and IAAI within 4, while the customer's wire may arrive later. The checklist flags this gap (R05), but the plan does not mention it.
* **Rationale & Recommendation**: Cite the real non-payment penalty terms, including minimums. Settle or flag the currency relationship. Add working capital to the risk table with an owner.

### design-1-10: The "buying power always matches money held" rule can't hold after bids are placed - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 44 (second B2), 61
* **Discrepancy Description**: A dispute or a refund made in the Stripe dashboard lowers buying power. But a bid already placed at Copart still commits the broker. The rule as stated can't be enforced. The real question is open item D2, which blocks milestone 5. The plan also doesn't define how much buying power a partial refund removes, or how custom-ratio plans convert refunds.
* **Rationale & Recommendation**: Restate the rule as "buying power never exceeds money held, except for commitments already placed at auction, which are flagged and escalated". Link this row to D2. Define how partial refunds convert to buying power.

### design-1-11: Bidding during vendor outages or on stale data is undefined - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Line 48 (B7)
* **Discrepancy Description**: B7 says the site stays up during apibara outages, but doesn't say whether bids are still accepted on stale data. If they are, the platform can accept bids on lots that are already sold or removed, and compute cutoffs from the wrong sale times. The checklist (§5) asks for bidding to stop when data is stale.
* **Rationale & Recommendation**: Define a freshness threshold. Beyond it, block placing and raising bids on the affected lots, or flag them to the broker.

### design-1-12: The hidden top bid can be found by probing the $100 outbid rule - Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Line 51 (B11)
* **Discrepancy Description**: When a bid is rejected, the customer learns that someone holds a higher bid. By retrying different amounts (a binary search), a customer can find the hidden top bid to within $100 and take the lot with exactly top + $100.
* **Rationale & Recommendation**: Limit how many rejected attempts a user can make per lot. Consider a generic "not accepted" response, or the "reject below current top" alternative. Record the choice in B11.

### style-1-2: B11 claims more than the unique index enforces - Severity: Major
* **Reviewer Lens:** `egm-style` (also `egm-design` as Nit)
* **Affected Scope:** Line 51
* **Discrepancy Description**: "A database unique index enforces this" follows a list of five rules. The partial unique index `bids_one_active_per_lot_uq` enforces only one active bid per lot. The $100 step, releasing buying power, notifying the outbid customer and tie handling all live in transaction code (§4.3).
* **Rationale & Recommendation**: Reword to "A partial unique index enforces one active bid per lot; the bid transaction (§4.3) enforces the rest." Keep the vinasLT comparison as a separate, sourced sentence.

### style-1-3: "Nothing on the platform after a win" contradicts the rest of the document - Severity: Major
* **Reviewer Lens:** `egm-style` (also `egm-design` as Nit)
* **Affected Scope:** Lines 22, 44-45
* **Discrepancy Description**: The same rows, line 33 and §4.4 show that the platform does record what happens after a win: won, paid and overdue status, forfeits, "apply to car price" and bidding blocks.
* **Rationale & Recommendation**: Reword to "After a win, the platform only records status and deposit adjustments; payment, towing, shipping and customs happen off-platform."

### style-1-4: Core terms and parties are never defined - Severity: Major
* **Reviewer Lens:** `egm-style` (also `egm-design` as Nit)
* **Affected Scope:** Lines 3, 5, 20, 25, 43, 60-61
* **Discrepancy Description**: The document uses "broker", "client", "owner", "buying power", "chips", "landed" and "apibara" without defining them. Line 60 gives a risk to "the client" and line 61 gives one to "the broker", so it matters whether they are the same party.
* **Rationale & Recommendation**: Add a short glossary or a sentence naming the parties under the title. Define "chips" or drop it.

### style-1-5: B1's "No bidding API exists" sits next to named bidding services - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 42
* **Discrepancy Description**: The absolute claim is followed by BidManager and AuctionGate, which read like bidding interfaces.
* **Rationale & Recommendation**: Reword to "Copart and IAAI offer no third-party bidding API; BidManager/AuctionGate are broker partnerships, not APIs." This is the claim research note 02 supports.

### style-1-6: B6's rationale is opinion, not a measured comparison - Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 47
* **Discrepancy Description**: "Overhead without benefit" is a value judgement.
* **Rationale & Recommendation**: State the concrete cost instead, for example "vinasLT runs 16 services in ~46 containers; the monolith needs 6 (§6)".

---

## Nits

### structural-1-4: The architecture diagram is incomplete and has one wrong arrow - Severity: Nit
* **Reviewer Lens:** `egm-structural`, `egm-design`, `egm-style`
* **Affected Scope:** Lines 24-34
* **Discrepancy Description**: The diagram leaves out:
  * Redis/BullMQ.
  * The worker's role in webhooks and the outbox.
  * The `stripe_events` table.
  * The cutoff worker.
  * The FX rate fetch.
  * Outbound Stripe refunds.

  It draws the apibara change feed as a push, while §4.1 describes polling. The broker actions on line 33 also leave out `not_placed`, `won_pending_approval` and `overdue`.
* **Rationale & Recommendation**: Add the missing parts and fix the arrow direction, or add a caption saying the diagram is simplified.

### structural-1-5: The diagram code block has no language tag - Severity: Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 24, 34
* **Discrepancy Description**: The code fence has no language set.
* **Rationale & Recommendation**: Mark it as `text`.

### structural-1-6: A bare URL and file paths that are not links - Severity: Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 5, 11-14
* **Discrepancy Description**: https://dbdiagram.io is a bare URL. The files and folders are code spans, not links. "notes 01-09" doesn't say which files those are.
* **Rationale & Recommendation**: Use Markdown links and relative links to the files.

### structural-1-7: Cross-references use two styles - Severity: Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 5, 54
* **Discrepancy Description**: Line 5 writes "Section 10" and line 54 writes "§9".
* **Rationale & Recommendation**: Pick one style and link it to the heading anchor.

### structural-1-8: The document says "Version 1" but has no change log - Severity: Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Line 3 (and line 12)
* **Discrepancy Description**: Decisions that depend on open items will change, but there is nowhere to record those changes.
* **Rationale & Recommendation**: Add a revision-history table, or say where changes will be recorded.

### design-1-13: The tie rule can never apply - Severity: Nit
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Line 51
* **Discrepancy Description**: A new bid must beat the top bid by at least $100, so two equal bids can never both be accepted.
* **Rationale & Recommendation**: Remove "Ties go to the earliest bid", or say where it applies, for example to simultaneous submissions decided by lock order.

### design-1-14: Decisions are attributed to an interview with no record - Severity: Nit
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Line 5
* **Discrepancy Description**: The planning interview is not linked. Several rationales, such as B1 and B9, rest on the broker's word.
* **Rationale & Recommendation**: Link the interview notes, or mark which rationales are the broker's statements.

### design-1-15: The plan doesn't say who pays card fees on deposits - Severity: Nit
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Line 53 (B13)
* **Discrepancy Description**: Card processing fees on deposits of $1,500-5,000 are a real cost, and the research warns about them.
* **Rationale & Recommendation**: State who absorbs card fees on deposits.

### style-1-7: B12 repeats itself - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 52
* **Discrepancy Description**: "Cancelling is allowed until the cutoff" repeats the first sentence.
* **Rationale & Recommendation**: Delete the last sentence.

### style-1-8: B13's rationale covers only the allowed payment methods - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 53
* **Discrepancy Description**: The rationale explains why bank transfer is allowed. It does not explain why SEPA Direct Debit and buy-now-pay-later are excluded, or why cards are kept despite chargebacks.
* **Rationale & Recommendation**: Add one clause for each. This feeds into design-1-1.

### style-1-9: The source of truth is stated twice - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 12, 54
* **Discrepancy Description**: B10 repeats line 12, and its "See §9" gives no reason.
* **Rationale & Recommendation**: State it in one place and give B10 an actual reason.

### style-1-10: "Restore drills" has no frequency - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 49
* **Discrepancy Description**: §6 says "monthly", but this row doesn't. Its rationale covers only the messages, not the backups.
* **Rationale & Recommendation**: Say "monthly restore drills" and give a reason for the backups, or split backups into their own row.

### style-1-11: B9's "most of the rates" is vague - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 50
* **Discrepancy Description**: Open item D4 already asks which rates are missing.
* **Rationale & Recommendation**: Cite D4 instead of saying "most".

### style-1-12: Line 5 packs too much into one sentence - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 5
* **Discrepancy Description**: One paragraph names four sources and makes two more claims.
* **Rationale & Recommendation**: Turn the sources into a bullet list and give the pointer to open items its own sentence.

### style-1-13: The datastore is named inconsistently - Severity: Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 13, 25, 47
* **Discrepancy Description**: The text uses both "Postgres" and "PostgreSQL 17".
* **Rationale & Recommendation**: Use one name in the prose and keep the version number in the tech-stack table.
