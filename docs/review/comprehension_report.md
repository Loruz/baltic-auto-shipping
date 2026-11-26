# Comprehension Report (Stage 6)

**Target:** `/Users/vytautas/Projects/car-auction-platform-plan/IMPLEMENTATION-PLAN.md`. Feature range: lines 1–65. Detailed range: lines 66–331.
**Reviewer:** `egm-comprehension` (completed). It read the target document only, with no background files.
**Result:** 0 Blocker · 7 Major · 7 Nit

## What this proposes

The plan describes a new web platform for one broker, built by one developer. It shows Copart and IAAI car-auction lots, which are pulled from a data vendor called apibara and kept in the platform's own Postgres database and Typesense search index. Each lot shows an estimated "landed" price in EUR, delivered to Klaipėda.

To bid, a customer passes an ID check (Ondato or Veriff) and pays a refundable deposit through Stripe. The deposit is about 10% of the customer's "buying power". The customer then sets a max bid on a lot. Each bid holds back its amount from the customer's buying power. Only one customer can hold the active bid on a lot, and taking it over needs at least $100 more.

One hour before the auction, bids are locked. The broker then places them by hand on their own Copart or IAAI account and records placed, won, lost or paid in an operator console. Everything after a win (payment, shipping, customs) happens off-platform.

The system is one TypeScript codebase: a Next.js web app, a background worker, Postgres, Redis and Typesense. It runs on one VPS with Docker Compose and nightly backups. Delivery is planned as roughly 14–18 weeks of MVP work.

## How the existing system works, per this document

There is no existing system. This is a new build. The document mentions two outside reference points but does not describe either one:

- **vinasLT**, a public GitHub organisation whose code was reviewed. It is used as a counter-example: 16 services, it never releases buying power when a customer is outbid, and it has secrets committed to its history.
- **abetter.bid**, a public site that also uses a 1-hour cutoff.

Today the broker already bids by hand on one Copart account and one IAAI account, and is paid by bank wire. The plan builds a catalogue and bid-intake layer on top of that manual process. The reviewer could not tell whether vinasLT is a competitor, a system being replaced, or a template (see finding 2).

## Findings

### 1. Who the parties are: Major
- **Scope:** lines 3, 5, 20, 33, 60, 188, and the "Owner" column of §10.
- **Problem:** the document uses "broker", "the client", "Vytautas", "you", "the broker owner" and "broker staff" without saying how they relate.
  - The client carries the data-licence risk (line 60), but it is the broker's account that is at risk.
  - Open items are owned separately by "Client" and "Broker" (§10).
  - The admin role is "you and the broker owner" (line 188).
- **Why it matters:** a new reader cannot tell whether the client and the broker are the same business, or whose company owns the platform, the Stripe account and the customer relationship. Line 252 hints that it is "the broker's company".
- **Fix:** add a short list of the parties to §1.

### 2. vinasLT is never introduced: Major
- **Scope:** lines 5, 47, 51, 86, 221, 274, 328.
- **Problem:** vinasLT is used as a benchmark seven times: service count, the outbid bug, the deploy model, leaked tokens, the referral programme and Buy Now behaviour. The document never says what it is. It might be a competitor, the client's current platform, or a reference build.
- **Why it matters:** the answer changes how to read decisions like B6 and B11.
- **Fix:** one sentence introducing it. abetter.bid (lines 5, 52) has the same gap, but it matters less.

### 3. apibara is not defined in the feature range: Major
- **Scope:** lines 25, 46, 48.
- **Problem:** apibara is the platform's only data source and is central to the architecture diagram. The reader has to work out from B3 that it is a paid third-party vendor of Copart and IAAI lot data. Nothing says what it is, links to it, or says whether "$70" in B7 is a monthly price.

### 4. How buying power works is not stated where it is introduced: Major
- **Scope:** lines 20, 43, 51.
- **Problem:** B2 says the deposit "unlocks buying-power 'chips'", and the term "chips" never appears again. The feature range never says plainly that each max bid holds back its full amount from buying power until it is outbid, lost, cancelled or won. That only becomes clear from the formula in §4.3 (line 140): `available = granted − reserved − consumed`.
- **Currency is unclear:**
  - Bids are in USD, with a $100 step.
  - Deposits may be in USD or EUR (D7, still open).
  - Line 140 compares a USD bid amount against buying power with no stated currency or conversion.
- **Fix:** state the rule in one or two sentences in the feature range, including what currency buying power is held in and that this depends on D7.

### 5. The bid lifecycle is spread out and uses an undefined "active" state: Major
- **Scope:** lines 51, 119, 141, 149, 152–154, 302.
- **Problem:** the bid statuses appear across several sections:
  - B11 uses `outbid`.
  - §4.1 uses `pending`.
  - §4.4 uses `locked`, `placed`, `not_placed`, `won`, `won_pending_approval`, `lost`, `paid` and `overdue`.
- **Undefined terms:** §4.3 queries `status IN (active)`, and the schema rule talks about "one live bid per lot". Neither "active" nor "live" is said to mean a particular set of statuses, so the reader cannot tell what the unique index covers. For example, does a `won` bid block new bids on a relisted lot?
- **Unexplained state:** `won_pending_approval` ("on approval", line 192). It looks like a Copart/IAAI seller-approval outcome, but the document does not say whose approval it is or what happens next.
- **Fix:** a single list of the states and transitions. The repository layout already mentions a "state machine" (line 100).

### 6. The target market and customer are never stated: Major
- **Scope:** §1.
- **Problem:** "What the platform is" never says who the customers are or where they live. The reader has to infer Lithuanian/EU buyers importing US cars from scattered clues: EUR, LT + EN, Vilnius time, Klaipėda in §4.6, and Lithuanian bank transfers in Phase 0. "Custom dealer plans" (line 43) suggests a second customer type, dealers, that is not described.
- **Fix:** a one-line audience and market statement in §1.

### 7. How a customer gets the deposit back is not described: Major
- **Scope:** lines 20, 43, 157–164.
- **Problem:** §1 calls the deposit "refundable", but the plan does not say when or how a customer gets it back. §4.5 and §5 only show refunds started by staff in the admin panel or the Stripe dashboard. D2 and D3 cover part of this but not the basic customer path.
- **Open questions:**
  - Can a customer ask for a refund from the customer cabinet?
  - Can they get it while bids are open?
  - Is a refund allowed after a won car is paid?

### 8. Decision IDs are duplicated and out of order: Nit
- **Scope:** lines 42–54.
- **Problem:** there are two rows labelled B2. B2b and B10 appear out of sequence. B4 and B5 are missing with no note. Readers who cross-reference decisions by ID will be confused.

### 9. Broken section reference: Nit
- **Scope:** line 84.
- **Problem:** "business alerts (§7.4)" should point to §7.2. There is no §7.4.

### 10. "Ties" under a +$100 rule: Nit
- **Scope:** lines 51, 230.
- **Problem:** ties "go to the earliest bid". But a new bid must beat the top bid by at least $100, so equal amounts from two customers should be impossible. It is unclear what a tie means here: two bids arriving at the same moment, or an equal raise.
- **Related gap:** amounts stay hidden, so the plan should say what a rejected customer is told about the amount they need to beat. Line 142 shows only "another customer holds a higher bid".

### 11. Terms used once and never defined: Nit
- "document legend" and "freshness label" (line 263), and "freshness checks" (line 95).
- "export-status override" and "mark reviewed" (line 198).
- "no unpaid won car (broker flag)" (line 136): which field or flag this is.
- "unmatched bank transfers" (line 195): how Stripe bank transfers get matched to deposits, and what makes one unmatched.

### 12. Two names for one action: Nit
- **Scope:** lines 44, 163, 195.
- **Problem:** the same action is called "apply to car price" and "apply to purchase". Pick one.

### 13. Two meanings of "snapshot": Nit
- **Scope:** lines 116, 144, 298.
- **Problem:** "snapshot" means a full re-sync of all active lots in §4.1, and a frozen copy of lot data on a bid (`lot_snapshot`) elsewhere. Make clear they are different.

### 14. Domain terms assumed: Nit
- **Scope:** lines 20, 168.
- **Problem:** Copart, IAAI, "lot" and "hammer price" are assumed knowledge.
- **Fix:** a short note that Copart and IAAI are US salvage and insurance car-auction houses.

## Verdict

Every section could be paraphrased, so there are no blockers. The overall structure connects: data sync, then search, then pricing, deposit and buying power, bid, cutoff, and the broker's manual steps.

The main gaps:
- The parties (client vs. broker) are never introduced.
- The outside reference points (vinasLT, apibara) are never introduced.
- The buying-power and bid-status rules can only be understood from the detailed SQL sketch, not from the feature range.
