// One-off extra probes after day1 (3 requests): scheduled-lot counts + soonest lots, change-feed density.
import { readFileSync, writeFileSync } from "node:fs";
const KEY = process.env.APIBARA_API_KEY?.trim() || readFileSync(new URL("../../../.env", import.meta.url), "utf8").match(/^APIBARA_API_KEY=["']?([^"'\r\n]+)/m)?.[1]?.trim();
if (!KEY) throw new Error("APIBARA_API_KEY missing in environment or root .env");
const OUT = new URL("../trial-results/", import.meta.url);
const BASE = "https://apibara.tech/api/v1/vehicle-auction";
async function call(name, path, params) {
  const u = new URL(BASE + path); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { Accept: "application/json", "X-API-Key": KEY } });
  const body = await r.json(); const used = r.headers.get("x-subscription-used");
  writeFileSync(new URL(`p2-${name}.json`, OUT), JSON.stringify({ request: u.pathname + u.search, status: r.status, used, body }, null, 2));
  console.log(r.status, "used(before)", used, name); return body;
}
const st = JSON.parse(readFileSync(new URL("state.json", OUT)));
st.soonest = {};
for (const p of ["copart", "iaai"]) {
  const b = await call(`upcoming-${p}`, "/vehicles", { platform: p, upcoming: "only", sort: "auction_soonest", include_total: "true" });
  console.log(" ", p, "scheduled total", b.meta?.total);
  st.scheduledTotals = { ...(st.scheduledTotals ?? {}), [p]: b.meta?.total };
  st.soonest[p] = (b.data ?? []).slice(0, 3).map((v) => ({ lot: v.lot_number, slug: v.slug_vin, auction_at: v.auction?.auction_at, bid: v.pricing?.current_bid_usd }));
}
const latest = 108082245;
const b = await call("changes-density", "/changes", { after: String(latest - 20000), limit: "500" });
const d = b.data ?? []; const t = d.map((e) => Date.parse(e.recorded_at));
const span = (Math.max(...t) - Math.min(...t)) / 60000;
const types = {}; for (const e of d) types[e.event] = (types[e.event] ?? 0) + 1;
st.density = { events: d.length, seqSpan: d.at(-1)?.sequence - d[0]?.sequence, minutes: +span.toFixed(1), types, from: d[0]?.recorded_at, latest: b.meta?.latest_available_sequence };
console.log(st.density);
writeFileSync(new URL("state.json", OUT), JSON.stringify(st, null, 2));
