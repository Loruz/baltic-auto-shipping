# apibara trial: results (day 1)

Run 2026-11-21 (about 23:50 UTC on Friday 20 November) on the free **Test** plan. **49 of 100 requests used.** The script is in `apibara-trial/` and the raw responses are in `trial-results/` (`log.json` lists every call). Steps 10–12 (cursor stability, results after a sale, photo-link expiry) need the follow-up runs on day 2 and day 7: `node apibara-trial/trial.mjs followup`.

## Most important findings

1. **IAAI sale dates are fine (corrected).** A first reading said only 306 IAAI lots had dates. That came from the `upcoming=only` filter, which does **not** mean "has a sale date". Filtering by `auction_date_from/to` instead finds **55,317 IAAI lots selling 23–27 November**, most with pre-bidding open (`prebidAllowed: true`).
   - Lots without a date are genuinely unscheduled: IAAI itself marks them "Not Ready for Sale" with pre-bidding closed, and apibara reports a placeholder date of 31/12/1899 in the raw fields. They become biddable when IAAI schedules them.
   - **Effect:** none on the plan. Rule kept: no sale date, no bid. **Don't use `upcoming` in the adapter**; select by `auction_date_from/to` and `auction_date_pending`.
2. **The full change feed is far too big to poll.** Sequence numbers are continuous, with about **39 million events in 14 days (≈2.8 million a day)**. In a sample of 500 recent events, **93% were `bid.changed`**, 6% `buy_now.changed`, and under 1% sold, ended, rescheduled or removed. On the Test plan `limit` is capped at **500** (the docs say 2,000).
   - **Effect:** polling every event every 15 minutes would cost 5,000+ requests a day. **Plan changed:** we poll only filtered streams (terminal events, reschedules, new lots), each with its own cursor.
3. **A 6-hourly full snapshot is unaffordable over REST.** There are about **204,000 active lots**. At 20 per page that is about 10,200 requests per snapshot, or 40,000 a day.
   - **Plan changed:** no big download. `sync.refresh` re-reads lots in small slices (one platform and sale day each), about 25 requests every 15 minutes. Slices selling within 2 days are refreshed daily, the rest weekly. On Pro, the Sync Center feed can replace it.
4. **"Removed" isn't final.** One of the two removed lots fetched is **open again** (relisted). The other was removed while IAAI marked it "Sold Buy Now" for $825.
   - **Effect:** removal cancels active bids, as planned. But a lot that comes back must not reopen those bids; it simply becomes biddable again.

## Other findings

| Topic | Result | Effect |
|---|---|---|
| Access | API key works. Quota headers: `x-subscription-used` (count **before** this call), `-remaining`, `-limit`, `x-per-page-limit: 20`, `x-concurrency-limit: 48` | The adapter reads these into `sync_runs.requests_used` |
| Failed calls | A `422` (limit over 500) wasn't counted. **An invalid `per_page=999` is silently cut to 20, returns 200 and is counted.** | The adapter must validate its own parameters |
| Field names | `/changes` events use `event` (not `event_type`) and `vehicle.lot_number` | Adapter mapping |
| Copart vs IAAI | The **normalized** fields (`auction`, `pricing`, `condition`, `odometer`, `sale_document`, `media`, `location`) exist for both. `details` holds raw source-specific data (IAAI has ~200 raw fields, Copart ~10). | Map only normalized fields; keep the raw record in `lot_raw` |
| Export status | `sale_document` has `export` and `registration` booleans plus a `sale_document_group` (e.g. `warning`). "Certificate of Destruction": export yes, registration no. "Lien papers": both no. | A ready source for our export status (B-legend); broker override stays |
| Odometer | Missing readings come back as **0** (3 of 6 Copart lots), and IAAI uses **1** as a placeholder | Store 0/1 as "unknown", never show "0 mi" |
| Current bid | Present for 4 of 6 Copart lots, missing for IAAI | The catalogue shows "current bid" only when known |
| Sold data | Sale price present on 98 of 100 ended lots | Sold archive is viable |
| History depth | 2-day windows of Copart ended lots: 39,897 (1 month ago), 24,484 (3), uncountable (6), 2,269 (9), **0 (12)**. `/history` per VIN returned up to 8 past sales. | Archive starts with about 6 months of good data, thinning to 9 months. Not 12. |
| Bad dates | Some "Ended" lots carry auction dates in **2029 and 2030** | Sync treats an ended lot with a future date as ended; alert if it appears in bidding |
| IAAI sold record | Its `auction_at` equals the time apibara noticed the sale, not the real sale time | Use `last_sold_day` for the archive date |
| Identifiers | VIN, lot number and Copart URL (`/urltodetails`) all resolve to the same lot | Customers can paste a Copart link |
| Towing | `/shipping/auction-to-port` gave **one recommended port and price**: NJ → NY $200, Hayward CA → LA $400, Columbus OH → Norfolk $550 | Plausible numbers; compare with the broker's quotes before using them for D4 |
| Market prices | `/market/sold-prices` (Toyota Camry, 3 months): 30,959 sales, median $2,600 | Usable for a "typical price" hint later |
| Photos | All 24 photo links (12 Copart, 12 IAAI) load as JPEG today. IAAI links are 400×300 thumbnails | Expiry checked on day 2 and day 7 |
| Live lots | 0 at the time of the run (Friday night, US time) | Re-check during a weekday auction |

## Tier choice, updated

- **Polling** 3 filtered streams every 15 minutes is about 8,600 calls a month, more when a stream needs a second page.
- **Rolling refresh** (`sync.refresh`, 25 calls every 15 minutes): about 70,000 calls a month.
- **`sync.soon` and lot checks:** a few thousand calls.
- **Power ($50, 60k):** doesn't fit with the rolling refresh.
- **Recommendation: Pro ($70, 100k + Sync Center feed).** Total ≈ 82,000 a month fits its 100k quota, and the feed could replace the rolling refresh at no request cost. The cost file already assumes Pro.

Mega remains unnecessary.

## Questions for apibara (add to the written-scope request)

1. What exactly does the `upcoming` filter select?
2. Does `/changes` accept **several event types** in one call, and what is the `limit` cap on paid plans?
3. Does the **Pro Sync Center feed** include IAAI dates and removals, and in what format?
