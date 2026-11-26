# apibara trial plan (Phase 0)

Prepared 2026-11-21 from apibara's public OpenAPI spec (v1.1.2) and documentation. Local copies are in `apibara-docs/` (`v1.json`, `llms-full.txt`, field coverage files). **Day 1 ran on 2026-11-21: see `apibara-trial-results.md`.** Steps 10–12 still need the day-2 and day-7 follow-ups.

## What we already know from the docs

| Topic | Finding | Effect on our plan |
|---|---|---|
| Access | Base URL `https://apibara.tech/api/v1/vehicle-auction`, API key in the `X-API-Key` header. Rate limits and quota are reported in response headers (`X-Subscription-Used`…). Failed calls (4xx/5xx) don't count. | The adapter reads the quota headers and writes them to `sync_runs.requests_used`. |
| Change feed | `GET /changes?after=<int>&limit≤2000`. Events: `lot.created/updated/sold/not_sold/removed`, `auction.rescheduled/ended`, `bid.changed`, `buy_now.changed`, `reserve.changed`. **It includes removals.** Save the cursor only after our own commit. **Kept for 14 days.** An expired cursor returns `410`, which means we must do a full re-sync. Marked "Beta". | Maps directly onto `listChanges`. A `410` starts `sync.snapshot`. |
| Freshness | Prices and status are up to **15 minutes** old. Live bids are 10–15 seconds old, through a separate stream. | Polling more often than every 15 minutes adds nothing. **Plan changed: `sync.changes` runs every 15 minutes.** |
| Sale time | `auction.auction_at` is the **start of the auction session** (UTC), not the moment this lot comes up. | Our cutoff (session start − 1 h) is earlier than the lot's real sale time, which errs on the safe side. Plan updated. |
| Sold results | `auction.outcome_status` (Sold, Sold on Approval, Not Sold, Removed), `pricing.sale_price_usd`. Final price coverage: 99.3% for Copart, 98.7% for IAAI. **History goes back about 12 months.** | The sold archive can start with about a year of history. |
| VIN | Can be **masked**. | Already handled: an invalid VIN never matches another vehicle. |
| Photos | Links point straight to **Copart/IAAI image servers** (`cs.copart.com`, `vis.iaai.com/resizer?…width=845`). *"Image URLs can expire."* A paid `/image-proxy` exists. | This confirms the risk behind B15. |
| Towing prices | `GET /shipping/auction-to-port?lot_number=…&ports=…` returns towing prices from the yard to a port. | **Possible fallback for towing rates the broker is missing (D4).** Check how accurate it is in the trial. |
| Documents | `GET /sale-documents?view=variants` lists title/sale document names per state. Each lot has `sale_document{name, type, export, …}`. | A starting point for our document legend (export status). The broker still decides whether a car can be registered in the EU. |
| Plans | Test $0/100 requests · Basic $25/30k · Power $50/60k · Pro $70/100k + 1 feed · Pro+ $90/300k · Pro max $110/600k · Mega $125/1M + webhooks · Mega max $195/2M | Webhooks only signal that **a feed file is ready**; they are not per-lot events. So Mega's webhooks add little for us (see costs). |

## What the terms say (`/en/terms`), and why it matters

- **Photos:** API access gives **no right** *"to republish, download, resize, store or sublicense the images"*, and there is *"no verified blanket Copart/IAA photo sublicense."*
- **Public display and SEO:** must be **agreed explicitly** (which fields, which audience, which countries, whether photos are included).
- **Permanent sale-history archive and bulk storage:** each needs a **separately agreed scope**. Only "technical caching" is allowed without agreement.
- **Source:** *"not affiliated with Copart/IAAI"*. The data comes from "third-party platforms, public sources", and apibara markets itself as a *"scraper alternative"*. So the data is almost certainly scraped, not licensed.
- **No SLA.** Refunds are decided case by case.

**Consequence:** our plan (a public catalogue, SEO pages, a sold archive, and showing photo links) goes beyond what apibara allows by default. This is the data-licence risk the broker is accepting, but it is now **in writing in apibara's own terms**. Before paying for a tier, **ask apibara in writing** for:
1. Permission to show lot data publicly on a Lithuanian website, including search-engine indexing.
2. Permission to keep a permanent archive of sold lots (data, not photos).
3. Their position on showing photo links (we don't store photos, B15).


## Trial requests (Test plan: 100 requests, about 70 used)

Read `X-Subscription-Used` on every response. Loading image URLs directly in a browser costs no API requests.

| # | Request | Answers | Requests |
|---|---|---|---:|
| 1 | `GET /usage` | Entitlements and maximum page size | 1 |
| 2 | `GET /vehicles?platform=copart&lot_sub_status=Open&include_total=true`, the same for IAAI, and both with `Live` | Active lot counts → quota maths | 4 |
| 3 | `GET /changes?after=0&limit=2000` | **Can the Test/Basic plans use `/changes` at all?** Retention, event mix | 1 |
| 4 | `/changes` filtered by `event_type` = `lot.removed`, `lot.sold`, `lot.not_sold` (`include_record=all`), plus an IAAI variant | Shape of removal and sale events | 5 |
| 5 | `GET /vehicles/{lot}` for 2 removed lots | A 404, or `lot_removed=true`? | 2 |
| 6 | `GET /vehicles/{lot}?include=history,vin_lots` for 6 Copart and 6 IAAI lots (mixed damage and title types) | **IAAI fields match Copart's**, photo fields, odometer brand, run condition, document fields | 12 |
| 7 | One lot looked up by VIN, lot number, IAAI `1110…` stock number and `urltodetails` | Identifier handling | 4 |
| 8 | `lot_sub_status=Ended` per platform. `auction_date_from/to` 1, 3, 6, 9 and 12 months back. `/history` for 5 VINs. `/market/sold-prices` | **Final prices, outcomes, how far history goes back** | 13 |
| 9 | `updated_within_minutes=15&include_total=true`, three times on different days | How many lots change every 15 minutes | 3 |
| 10 | Resume `/changes` from the saved cursor on day 2 and day 7 | Cursor stability. Do finished lots get final prices? | 4 |
| 11 | Re-fetch 5 lots after their sale. Poll 1 live lot 3 times | Freshness against the real result | 8 |
| 12 | Load the photo URLs from step 6 directly at sale, sale + 1 day and sale + 7 days. 2 `/image-proxy` calls | **When do photo links expire?** | 2 |
| 13 | `GET /shipping/auction-to-port` for 3 lots, compared with the broker's towing quotes | Can this fill missing towing rates? | 3 |
| 14 | One invalid call (`per_page=999`) | Error format; confirm it isn't counted | 1 |
| | **Total** | | **≈ 63** (37 kept in reserve) |

## Choosing the tier after the trial

- **Full download:** with about 300k active lots (step 2 gives the real number), one full download costs **≈ 15k requests** at 20 per page, or about 7.5k at 40 per page (40 per page needs Mega).
- **Keeping it current:** `/changes` every 15 minutes is about **3k requests a month**, plus `sync.soon` for lots with bids, plus re-fetching single lots for broker checks.
- **If `/changes` works on Basic or Power over REST:** **Power ($50, 60k requests)** probably covers a monthly full download plus change polling.
- **If it doesn't:** **Pro ($70)**, whose Sync Center feed doesn't count against the request quota. Its feed refreshes every 30 minutes. Pro max ($110) refreshes every 15 minutes.
- **Mega is not needed.** Its webhooks only announce that a feed file is ready.

## Plan changes made from this research
- `sync.changes` runs every **15 minutes** (it was 5), matching apibara's freshness.
- §4.1 notes that `sale_at` is the session start, and that a `410` from `/changes` starts a full re-sync.
- Phase 0 now includes asking apibara for **written scope** on public display, SEO, the archive and photos.
- `/shipping/auction-to-port` is listed as a possible fallback for the towing rates under D4.
