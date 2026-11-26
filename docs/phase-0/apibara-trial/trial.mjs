// apibara trial (see ../apibara-trial-plan.md). Node 20+, no dependencies.
//   node trial.mjs day1       steps 1–9, 13, 14 (≈47 requests)
//   node trial.mjs followup   steps 10–12, run on day 2 and day 7 (≈8 requests)
// Raw responses go to ../trial-results/. The API key comes from the environment or ../../../.env and is never printed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "trial-results");
const BASE = "https://apibara.tech/api/v1/vehicle-auction";
const QUOTA_STOP = 92; // Test plan = 100 requests; keep a margin
const RUN_CAP = 55; // hard cap per run

const KEY = process.env.APIBARA_API_KEY?.trim() || readFileSync(join(here, "..", "..", "..", ".env"), "utf8").match(/^APIBARA_API_KEY=["']?([^"'\r\n]+)/m)?.[1]?.trim();
if (!KEY) throw new Error("APIBARA_API_KEY missing in environment or root .env");
mkdirSync(OUT, { recursive: true });

let sent = 0;
let lastUsed = null;
const log = [];

async function call(name, path, params = {}) {
  if (sent >= RUN_CAP) throw new Error(`run cap ${RUN_CAP} reached`);
  if (lastUsed !== null && lastUsed >= QUOTA_STOP) throw new Error(`quota used ${lastUsed} ≥ ${QUOTA_STOP}, stopping`);
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  sent++;
  const t0 = Date.now();
  const res = await fetch(url, { headers: { Accept: "application/json", "X-API-Key": KEY } });
  const ms = Date.now() - t0;
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 5000); }
  const headers = Object.fromEntries([...res.headers].filter(([k]) => k !== "set-cookie"));
  const usedHdr = Object.entries(headers).find(([k]) => /subscription-used/i.test(k));
  if (usedHdr) lastUsed = Number(usedHdr[1]);
  const file = `${String(sent).padStart(2, "0")}-${name}.json`;
  writeFileSync(join(OUT, file), JSON.stringify({ request: url.pathname + url.search, status: res.status, ms, headers, body }, null, 2));
  const n = Array.isArray(body?.data) ? body.data.length : "";
  console.log(`${String(sent).padStart(2)} ${res.status} ${String(ms).padStart(5)}ms used=${lastUsed ?? "?"} ${name} ${n !== "" ? `(${n} rows)` : ""}`);
  log.push({ file, request: url.pathname + url.search, status: res.status, ms, used: lastUsed, rows: n });
  return { status: res.status, body };
}

const rows = (r) => (Array.isArray(r?.body?.data) ? r.body.data : []);
const get = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
const save = (f, o) => writeFileSync(join(OUT, f), JSON.stringify(o, null, 2));
const safe = async (fn) => { try { return await fn(); } catch (e) { console.log("  !", e.message); if (/cap|quota/.test(e.message)) throw e; } };

function pickVaried(list, n) {
  const seen = new Set(), out = [];
  for (const v of list) {
    const d = get(v, "condition.primary_damage") ?? "?";
    if (!seen.has(d)) { seen.add(d); out.push(v); }
    if (out.length === n) return out;
  }
  for (const v of list) if (out.length < n && !out.includes(v)) out.push(v);
  return out;
}
const id = (v) => v.slug_vin ?? v.lot_number;

async function day1() {
  const st = {};
  // 1 entitlements
  await call("usage", "/usage");
  // 2 active counts
  const open = {};
  for (const p of ["copart", "iaai"]) {
    open[p] = await call(`vehicles-${p}-open`, "/vehicles", { platform: p, lot_sub_status: "Open", include_total: true });
    await call(`vehicles-${p}-live`, "/vehicles", { platform: p, lot_sub_status: "Live", include_total: true });
  }
  // 3 change feed
  const ch = await call("changes-after0", "/changes", { after: 0, limit: 500 });
  if (ch.status < 200 || ch.status >= 300) throw new Error(`change feed failed with HTTP ${ch.status}; cursor not saved`);
  st.changesStatus = ch.status;
  const evs = rows(ch);
  st.changesMaxSeq = evs.reduce((m, e) => Math.max(m, Number(e.sequence ?? e.seq ?? e.id ?? 0)), 0) || get(ch.body, "meta.next_after") || null;
  // 4 removal / sale events
  const removed = await call("changes-removed", "/changes", { event_type: "lot.removed", include_record: "all", limit: 50 });
  await call("changes-sold", "/changes", { event_type: "lot.sold", include_record: "all", limit: 20 });
  await call("changes-notsold", "/changes", { event_type: "lot.not_sold", include_record: "all", limit: 20 });
  await call("changes-sold-iaai", "/changes", { event_type: "lot.sold", platform: "iaai", include_record: "all", limit: 20 });
  await call("changes-rescheduled", "/changes", { event_type: "auction.rescheduled", limit: 20 });
  // 5 removed lots fetched directly
  for (const e of rows(removed).slice(0, 2)) {
    const lot = e.lot_number ?? get(e, "record.lot_number");
    if (lot) await safe(() => call(`removed-lot-${lot}`, `/vehicles/${lot}`));
  }
  // 6 detail for 6 + 6 varied lots
  const picks = { copart: pickVaried(rows(open.copart), 6), iaai: pickVaried(rows(open.iaai), 6) };
  st.picked = Object.fromEntries(Object.entries(picks).map(([p, l]) => [p, l.map((v) => ({ lot: v.lot_number, vin: v.vin, slug: v.slug_vin, damage: get(v, "condition.primary_damage"), auction_at: get(v, "auction.auction_at") }))]));
  for (const p of ["copart", "iaai"])
    for (const v of picks[p]) await safe(() => call(`detail-${p}-${v.lot_number}`, `/vehicles/${id(v)}`, { include: "history,vin_lots" }));
  // 7 identifier forms on one Copart lot (+ IAAI stock form if present)
  const c = picks.copart[0], i = picks.iaai[0];
  if (c?.vin) await safe(() => call("ident-by-vin", `/vehicles/${c.vin}`));
  if (c?.lot_number) await safe(() => call("ident-by-lot", `/vehicles/${c.lot_number}`));
  if (c?.lot_number) await safe(() => call("ident-urltodetails", "/vehicles/urltodetails", { url: `https://www.copart.com/lot/${c.lot_number}` }));
  const stock = i && JSON.stringify(i).match(/1110\d{8}/)?.[0];
  if (stock) await safe(() => call("ident-iaai-stock", `/vehicles/${stock}`));
  // 8 sold results and history depth
  const ended = {};
  for (const p of ["copart", "iaai"]) ended[p] = await call(`vehicles-${p}-ended`, "/vehicles", { platform: p, lot_sub_status: "Ended", include_total: true });
  const today = new Date();
  const monthsAgo = (m) => { const d = new Date(today); d.setUTCMonth(d.getUTCMonth() - m); return d.toISOString().slice(0, 10); };
  const plus = (s, days) => { const d = new Date(s); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  st.historyDepth = {};
  for (const m of [1, 3, 6, 9, 12]) {
    const r = await call(`ended-${m}mo-ago`, "/vehicles", { platform: "copart", lot_sub_status: "Ended", auction_date_from: monthsAgo(m), auction_date_to: plus(monthsAgo(m), 2), include_total: true });
    st.historyDepth[`${m}mo`] = { status: r.status, rows: rows(r).length, total: get(r.body, "meta.total") };
  }
  const vins = [...rows(ended.copart), ...rows(ended.iaai)].map((v) => v.vin).filter((v) => v && /^[A-HJ-NPR-Z0-9]{17}$/.test(v)).slice(0, 5);
  for (const v of vins) await safe(() => call(`history-${v}`, `/vehicles/${v}/history`));
  await call("market-sold-prices", "/market/sold-prices", { make: "Toyota", model: "Camry", sale_date_from: monthsAgo(3) });
  // 9 change volume per 15 min (repeat on later days via followup)
  const u = await call("updated-15min", "/vehicles", { updated_within_minutes: 15, include_total: true });
  st.updated15 = [{ at: new Date().toISOString(), total: get(u.body, "meta.total") }];
  // 13 towing prices
  for (const v of [...picks.copart.slice(0, 2), ...picks.iaai.slice(0, 1)])
    await safe(() => call(`towing-${v.lot_number}`, "/shipping/auction-to-port", { lot_number: v.lot_number }));
  // 14 invalid call
  await call("invalid-perpage", "/vehicles", { per_page: 999 });

  // photo URLs for step 12 (loaded directly, no API cost)
  st.photos = {};
  for (const f of log.filter((l) => l.file.includes("detail-"))) {
    const body = JSON.parse(readFileSync(join(OUT, f.file), "utf8")).body;
    const urls = JSON.stringify(body).match(/https?:\/\/[^"]+\.(?:jpe?g|webp|png)[^"]*|https?:\/\/vis\.iaai\.com\/resizer[^"]*/gi) ?? [];
    st.photos[f.file] = [...new Set(urls)].slice(0, 2);
  }
  st.day1At = new Date().toISOString();
  save("state.json", st);
}

async function followup() {
  const st = JSON.parse(readFileSync(join(OUT, "state.json"), "utf8"));
  const tag = new Date().toISOString().slice(0, 10);
  // 10 resume the change feed from the saved cursor
  if (st.changesMaxSeq) {
    const ch = await call(`changes-resume-${tag}`, "/changes", { after: st.changesMaxSeq, limit: 500 });
    if (ch.status < 200 || ch.status >= 300) throw new Error(`change feed resume failed with HTTP ${ch.status}`);
  }
  // 11 re-fetch picked lots after their sale date
  // lots with a real sale date come from probe2.mjs (st.soonest); the day-1 picks had none
  const pool = st.soonest ? [...st.soonest.copart, ...st.soonest.iaai] : [...st.picked.copart, ...st.picked.iaai];
  const due = pool.filter((v) => v.auction_at && new Date(v.auction_at) < new Date()).slice(0, 4);
  for (const v of due) await safe(() => call(`after-sale-${v.lot}-${tag}`, `/vehicles/${v.slug ?? v.lot}`));
  // 9 again
  const u = await call(`updated-15min-${tag}`, "/vehicles", { updated_within_minutes: 15, include_total: true });
  (st.updated15 ??= []).push({ at: new Date().toISOString(), total: get(u.body, "meta.total") });
  // 12 photo links (no API cost)
  st.photoChecks ??= [];
  for (const [file, urls] of Object.entries(st.photos ?? {}))
    for (const url of urls) {
      const r = await fetch(url, { method: "GET" }).catch((e) => ({ status: "ERR " + e.message }));
      st.photoChecks.push({ at: new Date().toISOString(), file, url: url.slice(0, 120), status: r.status });
    }
  save("state.json", st);
}

const cmd = process.argv[2];
try {
  if (cmd === "day1") await day1();
  else if (cmd === "followup") await followup();
  else { console.log("usage: node trial.mjs day1|followup"); process.exit(1); }
} finally {
  const prev = existsSync(join(OUT, "log.json")) ? JSON.parse(readFileSync(join(OUT, "log.json"), "utf8")) : [];
  save("log.json", [...prev, { run: cmd, at: new Date().toISOString(), sent, lastUsed, calls: log }]);
  console.log(`\nsent ${sent} requests this run; quota used per header: ${lastUsed ?? "unknown"}`);
}
