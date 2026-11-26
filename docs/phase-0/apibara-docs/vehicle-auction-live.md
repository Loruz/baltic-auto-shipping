## Auction lifecycle: scheduled start is not a result

Updated 2026-11-19. REST base: `https://apibara.tech/api/v1/vehicle-auction`. Keep the API key on your backend and send it as `X-API-Key`.

`auction.auction_at` is the scheduled start of the session, **not the time this particular vehicle will be sold**. A vehicle can wait in its lane for hours. Never set Ended/Sold because the countdown reaches zero, because 30/60 minutes elapsed, because the current bid is positive, or because another vehicle in the lane finished.

Use `auction.phase` for display and `auction.state` for coarse compatibility:

| phase | state | Suggested display |
| --- | --- | --- |
| `unscheduled` | `open` | Auction date to be announced |
| `scheduled` | `open` | Scheduled |
| `awaiting_auction` | `live` | Awaiting auction (within 30 minutes before the session) |
| `in_progress` | `live` | Auction in progress / waiting for turn |
| `awaiting_result` | `unknown` | Awaiting auction result |
| `finished` | `finished` | Finished; inspect the actual outcome |
| `removed` | `finished` | Removed from auction |
| `unknown` | `unknown` | Status unavailable |

For regular auctions without a source-ended marker, `live` covers the current North American auction session, starting no more than 30 minutes before the scheduled start. The next auction day rolls over at **06:00 America/New_York**, allowing late West Coast lanes overnight. Prior-session unresolved lots then become `state: unknown` / `phase: awaiting_result`; the maximum rolling age remains 24 hours. This prevents yesterday's unresolved inventory from appearing as current LIVE. Catalogue views and API use the same session boundary.

A scheduled session window is **not proof of bidding on this lot**. `auction.is_bidding_now` remains null unless established; use fresh live lane observations for the current bidding vehicle. `auction.live_window_expires_at` is the UTC expiry of the listing window: refresh cached records at that time and display **Awaiting auction result** if no source-ended result has arrived. Do not use a past start time to display an indefinite “Auction started” badge.

Treat `state: finished` / `phase: finished` or `removed` as ended according to source evidence (or the timed-auction deadline). A confirmed sale additionally requires `result_confirmed` and the relevant `outcome_status`. An expired LIVE window alone does not prove Sold, No Sale or a final price.

`lot_sub_status=Live` uses that active window and excludes source-ended lots. `lot_sub_status=Ended` uses source completion/removal markers. A timed auction can also end at its explicit `timed_end_at` deadline; that is different from a regular auction's scheduled start. Unresolved older lots remain available through identifier lookups; do not silently delete them from your local inventory because a time window elapsed.

`auction.result_confirmed` indicates source-backed result/removal evidence. `auction.completion_source` is `source_marker`, `timed_deadline`, or null. A source-ended marker without a detailed result, or an expired timed deadline, does not prove a sale. Inspect `auction.outcome_status`, `auction.last_sold_status` and source-backed sale price. **Sold on Approval is conditional, not a confirmed final sale.** A historical price must not be presented as a current sale price without matching outcome evidence.

Example of an unsold vehicle still waiting in today's auction:

```json
{"auction":{"state":"live","phase":"in_progress","phase_label":"Auction in progress / awaiting turn","result_confirmed":false,"completion_source":null,"is_bidding_now":null}}
```

All API timestamps use ISO 8601 with timezone. Preserve timezone information; do not parse timestamps as naive browser-local dates. Lot numbers must be strings, keyed together with `platform`.

## Live lane integration — private beta

The read-only live transport is separate from normal REST polling and Sync Center. **Read-only customer WebSocket access is included in active Pro and higher Vehicle Auction Data API plans at no additional monthly cost.** There are no per-message or overage fees for the live stream, and WebSocket messages do not consume monthly REST request allowances. Basic, Power and Test do not include streaming. If `POST /live/v1/session` returns `403`, check plan eligibility and contact support; never send your API key in chat. Do not retry that error in a loop. The public on-site demo socket is origin-restricted and is not a third-party integration endpoint.

The stream contains observations received from supported source lanes. Availability and freshness depend on source observations; it does not guarantee every lot, lane or intermediate bid. This API supplies data, not bidder access. Placing bids requires the customer's own broker/source arrangement and is outside these read-only endpoints.

### 1. Create a short-lived session on your backend

```bash
curl -X POST 'https://apibara.tech/live/v1/session' \
  -H "X-API-Key: $APIBARA_API_KEY" \
  -H 'Content-Type: application/json' --data '{}'
```

```json
{"token":"SHORT_LIVED_SESSION_TOKEN","expires_at":"2026-11-11T16:05:00.000Z","websocket_url":"wss://apibara.tech/live/v1/socket","schema_version":"2026-10-11.beta1"}
```

The token lasts 5 minutes. Use the returned socket URL, authenticate within 5 seconds, and obtain a fresh session before reconnecting after expiry. Keep the long-lived API key on your server. Prefer one backend connection with a safe broadcast to your own browser clients, instead of opening one upstream connection per visitor. Never put credentials in URL query strings or commit them to source control.

### 2. Authenticate, then watch the selected lot's lane

Send these JSON messages in order:

```json
{"type":"auth","token":"SHORT_LIVED_SESSION_TOKEN"}
```

Wait for `{"type":"ready",...}`, then:

```json
{"type":"watch_lot","platform":"copart","lot_number":"73008676"}
```

Use the platform and lot number returned by the REST vehicle record. Send another `watch_lot` to switch the one active lane projection on that connection. The same method works with `platform=iaai`.

The server supplies three kinds of messages:

| Message | Meaning |
| --- | --- |
| `lanes` | Observed lane identifiers and freshness; not a promise of complete source coverage |
| `queue` | `data` contains the selected lane's catalogue vehicles, or null when lane context is unavailable |
| `lane` | `data` contains `previous`, `current`, `next`, `observed_at`, `stale`, and a state version, or null while observations are unavailable |

A queue has `id`, `platform`, `label`, `auction_at`, `source_order_unique`, `selected_lot_number`, and `cars`. Each car can include `lot_number`, `line_number`, `title`, `image_url`, `vin`, `stored_bid`, `result_status`, `result_price`, and `result_observed_at`. Nullable/missing source fields must stay unknown, not zero.

A lane card can contain `lot_number`, `status`, `current_bid`, `sale_price`, `observed_at`, and source-backed title/image metadata. `next.next_source` distinguishes an observed next lot from a schedule-based preview. `current` is the lane's latest observed current card, which can already contain a terminal result while the next lot has not been observed yet. Label it Bidding now only when its status is `Live` **and** its observation is fresh.

Render the full queue from `queue.data.cars`. Overlay live cards by `(platform, lot_number)`. The source can change order or skip lots. Do not choose the current car from the first unfinished row, from `line_number + 1`, from elapsed time, or from a synthetic replay frontier. If `source_order_unique=false`, do not infer previous/next from catalogue positions.

A minimal backend client is available at [live-lane-client.mjs](https://apibara.tech/examples/live-lane-client.mjs). It authenticates, watches a lane, reconnects with a new session, handles ping/pong and avoids logging credentials. Install the `ws` dependency in your own Node project and provide `APIBARA_API_KEY`, `AUCTION_PLATFORM` and `AUCTION_LOT_NUMBER` as environment variables.

### 3. Treat freshness and reconnection as part of the UI

Use `observed_at`, not the time your browser received the message. When `stale=true` or the latest observation is over 30 seconds old, display Last observed bid / Live data delayed. A disconnect must not turn the car into Sold or Ended. Keep the last visible state, reconnect with exponential backoff and jitter, get a new session, authenticate and send `watch_lot` again. Queue/lane messages are replaceable snapshots and require no ACK cursor.

The beta currently allows at most 5 authenticated connections per account and 20 session requests per minute per IP. Live transport is included at no additional fee in active Pro and higher plans. WebSocket messages do not count as REST API calls. The service remains subject to capacity and fairness limits and source-data availability; there is no separate live-stream overage billing.

### 4. Optional durable per-lot event subscription

Use this mode when you need to persist events rather than just display the current lane. It is a separate mode on a connection; switching to it stops the lane projection.

After authentication send up to 50 lots:

```json
{"type":"subscribe","lots":[{"platform":"copart","lot_number":"73008676"},{"platform":"iaai","lot_number":"45760722"}]}
```

The first response is a `snapshot` containing `origin_id`, `next_cursor` and `data`. Snapshot fields are wrapped as `{ "value": ..., "observed_at": ..., "sequence": ... }`. After safely committing that snapshot, ACK its exact delivered cursor:

```json
{"type":"ack","cursor":12345}
```

Subsequent `events` batches contain `from_cursor`, `next_cursor`, `latest_cursor`, `has_more` and `data`. Events include `event_id`, `sequence`, `platform`, `lot_number`, `auction_id`, `type`, `observed_at` and changed `data`. Commit events and cursor atomically, then ACK the exact batch `next_cursor` even if `data=[]`; the global scan cursor can advance past events belonging to other lots. Acknowledge within 30 seconds. Deduplicate by sequence/event identity and scope records by auction cycle, not just VIN.

On reconnect use the last committed cursor and journal identity:

```json
{"type":"subscribe","origin_id":"SAVED_ORIGIN_ID","after":12345,"lots":[{"platform":"copart","lot_number":"73008676"}]}
```

On `cursor_expired` (410) or `origin_changed` (409), request a fresh snapshot and rebuild the projection; never skip ahead blindly. The replay journal is retained for a bounded window, currently 14 days, and is not a permanent sale-history archive. Relevant event types include `bid.changed`, `bid.observed`, `auction.status.changed`, `auction.started`, `auction.ended`, `lot.sold`, `lot.not_sold`, `lot.removed`, `buy_now.changed`, and `lane.updated`. A recovered `bid.observed` event belongs in historical bid storage and must not replace a newer visible bid or a terminal result.

## Build an auction marketplace with Apibara Tech

Use this division of responsibilities for a BidCars-style catalogue and live auction interface:

1. **Initial inventory:** bootstrap supported Open + Live inventory through Sync Center on an eligible plan, or use REST cursor pagination. Keep the same filters for every cursor page and obey the effective plan-specific `per_page` cap; do not assume 100/200 records per page.
2. **Local catalogue:** store auctions by `(platform, lot_number, auction_id/cycle)` and associate VINs for history. Keep scheduled dates, lifecycle phase, result evidence and observation timestamps separately. Null means unknown. Use a local search index for browsing, facets and SEO pages.
3. **Background updates:** consume `GET /changes` or Sync Center incremental files with checkpoints and reconciliation. A generation-ready webhook announces a file; it is not an individual bid or lane event.
4. **Vehicle detail:** fetch the normal vehicle detail/history endpoints on demand and cache stable metadata. Keep the API key behind your backend, respect 429 / `Retry-After`, and use bounded backoff on transient errors.
5. **Live page:** connect the selected lot to the authenticated `watch_lot` projection. Broadcast that lane to your viewers, show the full queue and fresh previous/current/next cards, and reconcile the final result with REST/changes afterward.
6. **Results and relists:** distinguish Sold, Sold on Approval, Not Sold and Removed. Start a new cycle when a lot is relisted; never reuse a previous auction's terminal state or bid ladder as the new current auction.
7. **Operational recovery:** persist inventory checkpoints and raw-event cursors server-side, reconnect on expiry, deduplicate, monitor freshness and reconcile after gaps. A successful WebSocket connection alone does not prove live source coverage.

### Copyable brief for an AI coding assistant

```text
Build a read-only vehicle-auction marketplace using Apibara Tech.
Use https://apibara.tech/openapi/v1.json for REST fields and endpoints,
and https://apibara.tech/docs/vehicle-auction-live.md for lifecycle and live integration.
Keep X-API-Key server-side. Store source platform + lot number + auction cycle.
Use Sync Center/GET /changes for inventory synchronization and authenticated
POST /live/v1/session + WebSocket /live/v1/socket with auth/watch_lot for lane UI.
Live streaming is included with active Pro and higher plans; handle 403 access errors without retry loops.
Render auction.phase; never infer a sale or ended status from the scheduled start.
Only label Bidding now for a fresh observed Live card. Handle stale data, missing queues,
reordered lanes, session expiry, reconnect, conditional sales and relists explicitly.
Do not add bidding/payment capabilities that these read-only data endpoints do not provide.
```


## Build the same live lane block as our lot pages

Full-size bid.cars-style progression uses an original Apibara design (not copied CSS), with three observed lane cards and a separate selected lot. The interface is read-only and uses source timestamps instead of an invented per-lot countdown. The complete starter supports Node.js browser fan-out plus Python and PHP backend subscriber examples.

Our lot pages display two different things: the selected vehicle's catalogue status, and a **lane projection** that follows the source's currently observed vehicle. The current car in the lane can be completely different from the lot whose page is open. Build these as separate UI states.

Try the [interactive sidebar below](https://apibara.tech/en/products/vehicle-auction-data-api/docs#live-sidebar-example), then [download the complete runnable starter](https://apibara.tech/examples/live-sidebar-starter.zip). It contains the authenticated Node.js client, a local backend with browser fan-out, the HTML sidebar, CSS, renderer, state reducer, synthetic training messages, tests and setup instructions. No framework is required. [Read the embedding guide](https://apibara.tech/examples/live-sidebar/README.md).

### From WebSocket messages to a sidebar

1. Your backend creates the session and authenticates the customer WebSocket as shown above. Wait for `ready`, then send `watch_lot` using the selected vehicle's `platform` and `lot_number`.
2. On `queue`, retain `message.data`, draw `data.cars`, and locate the selected lot by the pair `(platform, lot_number)`. `queue.data.id` identifies that lane; treat it as opaque. If data is null, display Waiting for lane context.
3. On `lane`, replace the previous projection for the matching lane. Draw `data.previous`, `data.current` and `data.next`. Render source title/photo, lot number, run number when provided, status, current bid and observation time. A null card is unavailable, not an ended car.
4. Show **Bidding now** only if `current.status === "Live"`, its `observed_at` is no more than 30 seconds old, the lane is not stale and the connection is up. A newer source result already stored for that lot takes precedence over a delayed Live card. A current card with Sold or Sold on Approval stays a result card until the next current vehicle is observed.
5. Overlay the card on the queue by identity, not array index. Keep your selected lot visible in its own small card. It can say Waiting for turn while another car is Bidding now. Never mark a car as sold because it is behind the current index. With verified order, an unresolved earlier row can say Result not observed; with ambiguous order, use Awaiting observation.
6. On disconnect, preserve the last visible data, remove the Bidding now claim and reconnect. On a lot change, clear the old lane projection before watching the new lot; reject late messages for a different lane. Restore the latest queue and lane snapshots to browser clients after reconnecting.

Example message shapes (synthetic training values; omitted fields remain optional):

```json
{"type":"queue","data":{"id":"iaai:EXAMPLE-B","platform":"iaai","label":"Example B","source_order_unique":true,"selected_lot_number":"90000004","cars":[{"platform":"iaai","lot_number":"90000002","line_number":102,"title":"Example current car","stored_bid":0,"result_status":null},{"platform":"iaai","lot_number":"90000004","line_number":104,"title":"Your selected car","stored_bid":null,"result_status":null}]}}
```

```json
{"type":"lane","data":{"id":"iaai:EXAMPLE-B","platform":"iaai","current":{"platform":"iaai","lot_number":"90000002","line_number":102,"title":"Example current car","status":"Live","current_bid":100,"observed_at":"2026-11-11T18:00:00Z"},"previous":null,"next":{"platform":"iaai","lot_number":"90000004","status":"Upcoming","next_source":"schedule"},"observed_at":"2026-11-11T18:00:00Z","stale":false}}
```

At that example timestamp, the sidebar shows the current car at $100 and your selected car still waiting. Do not treat that static example timestamp as fresh today. `next_source=schedule` means a preview based on source order, not a guarantee of the next auction or its start time. Queue length is not an ETA. Preserve zero bids; display unknown `null` as a dash.

### Run the complete example on your computer

Unzip the starter, open its directory, install dependencies with `npm install`, then run `npm start` (Node.js 22+). Open `http://127.0.0.1:8787`. The clearly labelled training mode works without credentials. Each Next example event demonstrates a bid change, a conditional result or a lane rotation.

For real data, set `APIBARA_API_KEY`, `AUCTION_PLATFORM` and `AUCTION_LOT_NUMBER` as server environment variables and restart. Use your currently scheduled lot from REST. Click Connect my backend. An active Pro or higher plan is required for the read-only live stream.

The included server opens **one authenticated Apibara WebSocket** and forwards queue/lane observations to same-origin browser clients via Server-Sent Events (`EventSource`). This small fan-out layer keeps both API keys and session tokens on your backend. You can use your own browser WebSocket transport instead; the renderer consumes the same messages. Do not open a separate upstream connection for every visitor. The local starter listens on loopback; add your site's viewer authorization, TLS, capacity controls and reverse-proxy configuration before exposing it publicly.

### Embed the renderer in your own site's sidebar

Copy `sidebar.js`, `state.js` and `sidebar.css` to your assets, mount the component in an `aside`, and feed it the messages from your authorized backend. Replace the lot URL callback with your own site's URL scheme:

```html
<link rel="stylesheet" href="/assets/auction/sidebar.css">
<aside><div id="auction-lane"></div></aside>
<script type="module">
import {mountSidebar} from '/assets/auction/sidebar.js';
const ui = mountSidebar(document.querySelector('#auction-lane'), {
  lotHref: car => `/lots/${car.platform}/${car.lot_number}`
});
ui.select('iaai', 'YOUR_SELECTED_LOT_NUMBER');
ui.mode('Live observations');
const source = new EventSource('/your-authorized-lane-events');
source.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.type === 'queue' || message.type === 'lane') {
    ui.connection(true);
    ui.message(message);
  }
};
source.onerror = () => ui.connection(false);
window.addEventListener('pagehide', () => { source.close(); ui.destroy(); });
</script>
```

Your backend route must watch the same lot selected in the UI, forward upstream disconnect/error state and replay the most recent queue/lane snapshots when the browser connects. The complete starter includes that bridge and explicit `bridge_status` handling; the snippet above demonstrates rendering only. A browser connection to your backend is not by itself proof that the upstream lane is live.

For an AI coding assistant, provide this guide and the starter sources. Ask it to keep the wire contract, use backend-only credentials, authorize viewers through your app, key vehicles by platform plus lot number, and retain freshness/unknown/conditional-result behavior. Do not ask it to copy Apibara's origin-restricted on-site preview socket into a third-party website.
