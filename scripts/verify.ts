import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

try {
  const text = readFileSync(".env.local", "utf-8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const TOLERANCE = 1e-7;
const TIMEOUT_MS = 8_000;

let passed = 0, failed = 0, skipped = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (r: number) => `${(r * 100).toFixed(6)}%`;
const ts = (ms: number) => new Date(ms).toISOString().slice(0, 19) + "Z";
const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;

function record(label: string, dbRate: number, apiRate: number | null) {
  if (apiRate === null) {
    console.log(`    ⏭  ${label}  DB=${fmt(dbRate)}  →  API 找不到`);
    skipped++;
  } else if (near(dbRate, apiRate)) {
    console.log(`    ✅  ${label}  DB=${fmt(dbRate)}  API=${fmt(apiRate)}`);
    passed++;
  } else {
    console.log(`    ❌  ${label}  DB=${fmt(dbRate)}  API=${fmt(apiRate)}  diff=${fmt(Math.abs(dbRate - apiRate))}`);
    failed++;
  }
}

async function get<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return res.json() as T;
  } catch {
    return null;
  }
}

// 從 DB 取最近 N 筆
async function dbSamples(exchange: string, symbol: string, n = 5) {
  const r = await db.execute(
    `SELECT rate, funding_time FROM funding_rates
     WHERE exchange = '${exchange}' AND symbol = '${symbol}'
     ORDER BY funding_time DESC LIMIT ${n}`
  );
  return r.rows as unknown as Array<{ rate: number; funding_time: number }>;
}

// 取該交易所最優先使用的幣種（BTC > ETH > 第一個）
async function pickSymbol(exchange: string) {
  for (const pref of ["BTC", "ETH"]) {
    const r = await db.execute(
      `SELECT symbol FROM funding_rates WHERE exchange = '${exchange}' AND symbol = '${pref}' LIMIT 1`
    );
    if (r.rows.length) return pref;
  }
  const r = await db.execute(
    `SELECT symbol FROM funding_rates WHERE exchange = '${exchange}' LIMIT 1`
  );
  return (r.rows[0]?.symbol as string) ?? null;
}

// ─── Binance ──────────────────────────────────────────────────────────────────

async function verifyBinance() {
  console.log("\n[Binance]");
  const sym = await pickSymbol("binance");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}`);
  for (const s of await dbSamples("binance", sym)) {
    await sleep(250);
    type Row = { fundingRate: string; fundingTime: number };
    const data = await get<Row[]>(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${s.funding_time}&endTime=${s.funding_time}&limit=1`
    );
    record(ts(s.funding_time), s.rate, data?.[0] ? parseFloat(data[0].fundingRate) : null);
  }
}

// ─── Bybit ────────────────────────────────────────────────────────────────────

async function verifyBybit() {
  console.log("\n[Bybit]");
  const sym = await pickSymbol("bybit");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}`);
  for (const s of await dbSamples("bybit", sym)) {
    await sleep(250);
    type Resp = { result: { list: Array<{ fundingRate: string; fundingRateTimestamp: string }> } };
    const data = await get<Resp>(
      `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${sym}USDT&startTime=${s.funding_time}&endTime=${s.funding_time + 1000}&limit=1`
    );
    const item = data?.result?.list?.[0];
    const apiRate = item && parseInt(item.fundingRateTimestamp) === s.funding_time
      ? parseFloat(item.fundingRate) : null;
    record(ts(s.funding_time), s.rate, apiRate);
  }
}

// ─── OKX ─────────────────────────────────────────────────────────────────────
// after=X 代表「回傳比 X 更舊的紀錄」（cursor 往舊翻），after=ft+1 → 最新一筆 = ft

async function verifyOkx() {
  console.log("\n[OKX]");
  const sym = await pickSymbol("okx");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}`);
  for (const s of await dbSamples("okx", sym)) {
    await sleep(250);
    type Resp = { data: Array<{ fundingRate: string; fundingTime: string }> };
    const data = await get<Resp>(
      `https://www.okx.com/api/v5/public/funding-rate-history?instId=${sym}-USDT-SWAP&after=${s.funding_time + 1}&limit=1`
    );
    const item = data?.data?.[0];
    const apiRate = item && parseInt(item.fundingTime) === s.funding_time
      ? parseFloat(item.fundingRate) : null;
    record(ts(s.funding_time), s.rate, apiRate);
  }
}

// ─── Bitget ───────────────────────────────────────────────────────────────────
// 不支援時間查詢，取 API 最近 10 筆建 Map，比對 DB 最近 5 筆

async function verifyBitget() {
  console.log("\n[Bitget]");
  const sym = await pickSymbol("bitget");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}  （比對最近 5 筆）`);
  const samples = await dbSamples("bitget", sym);
  type Row = { fundingRate: string; fundingTime: string };
  const data = await get<{ data: Row[] }>(
    `https://api.bitget.com/api/v2/mix/market/history-fund-rate?symbol=${sym}USDT&productType=USDT-FUTURES&pageSize=20&pageNo=1`
  );
  const apiMap = new Map(
    (data?.data ?? []).map((d) => [parseInt(d.fundingTime), parseFloat(d.fundingRate)])
  );
  for (const s of samples) {
    record(ts(s.funding_time), s.rate, apiMap.get(s.funding_time) ?? null);
  }
}

// ─── MEXC ─────────────────────────────────────────────────────────────────────

async function verifyMexc() {
  console.log("\n[MEXC]");
  const sym = await pickSymbol("mexc");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}  （比對最近 5 筆）`);
  const samples = await dbSamples("mexc", sym);
  type Row = { fundingRate: number; settleTime: number };
  const data = await get<{ data?: { resultList?: Row[] } }>(
    `https://contract.mexc.com/api/v1/contract/funding_rate/history?symbol=${sym}_USDT&page_num=1&page_size=20`
  );
  const apiMap = new Map(
    (data?.data?.resultList ?? []).map((d) => [d.settleTime, d.fundingRate])
  );
  for (const s of samples) {
    record(ts(s.funding_time), s.rate, apiMap.get(s.funding_time) ?? null);
  }
}

// ─── Gate.io ──────────────────────────────────────────────────────────────────
// Gate 用 Unix 秒

async function verifyGate() {
  console.log("\n[Gate.io]");
  const sym = await pickSymbol("gate");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}`);
  for (const s of await dbSamples("gate", sym)) {
    await sleep(250);
    const from = Math.floor(s.funding_time / 1000);
    type Row = { r: string; t: number };
    const data = await get<Row[]>(
      `https://api.gateio.ws/api/v4/futures/usdt/funding_rate?contract=${sym}_USDT&from=${from}&to=${from + 1}&limit=1`
    );
    const item = data?.[0];
    const apiRate = item && item.t * 1000 === s.funding_time ? parseFloat(item.r) : null;
    record(ts(s.funding_time), s.rate, apiRate);
  }
}

// ─── HTX ──────────────────────────────────────────────────────────────────────

async function verifyHtx() {
  console.log("\n[HTX]");
  const sym = await pickSymbol("htx");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}  （比對最近 5 筆）`);
  const samples = await dbSamples("htx", sym);
  type Row = { funding_rate: string; funding_time: string };
  const data = await get<{ data?: { data: Row[] } }>(
    `https://api.hbdm.com/linear-swap-api/v1/swap_historical_funding_rate?contract_code=${sym}-USDT&page_index=1&page_size=20`
  );
  const apiMap = new Map(
    (data?.data?.data ?? []).map((d) => [parseInt(d.funding_time), parseFloat(d.funding_rate)])
  );
  for (const s of samples) {
    record(ts(s.funding_time), s.rate, apiMap.get(s.funding_time) ?? null);
  }
}

// ─── KuCoin ───────────────────────────────────────────────────────────────────

function toKucoinSymbol(symbol: string): string {
  return symbol === "BTC" ? "XBTUSDTM" : `${symbol}USDTM`;
}

async function verifyKucoin() {
  console.log("\n[KuCoin]");
  const sym = await pickSymbol("kucoin");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}`);
  for (const s of await dbSamples("kucoin", sym)) {
    await sleep(250);
    type Row = { fundingRate: string; timepoint: number };
    const data = await get<{ data?: { dataList?: Row[] } }>(
      `https://api-futures.kucoin.com/api/v1/funding-history?symbol=${toKucoinSymbol(sym)}&from=${s.funding_time}&to=${s.funding_time + 1000}&reverse=true&maxCount=10`
    );
    const item = data?.data?.dataList?.find((d) => d.timepoint === s.funding_time);
    record(ts(s.funding_time), s.rate, item ? parseFloat(item.fundingRate) : null);
  }
}

// ─── Hyperliquid ──────────────────────────────────────────────────────────────

async function verifyHyperliquid() {
  console.log("\n[Hyperliquid]");
  const sym = await pickSymbol("hyperliquid");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}`);
  for (const s of await dbSamples("hyperliquid", sym)) {
    await sleep(250);
    type Row = { time: number; fundingRate: string };
    const data = await get<Row[]>("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "fundingHistory", coin: sym, startTime: s.funding_time }),
    });
    const item = data?.find((d) => d.time === s.funding_time);
    record(ts(s.funding_time), s.rate, item ? parseFloat(item.fundingRate) : null);
  }
}

// ─── Trade.xyz ────────────────────────────────────────────────────────────────

async function verifyTradexyz() {
  console.log("\n[Trade.xyz]");
  const sym = await pickSymbol("tradexyz");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}`);
  for (const s of await dbSamples("tradexyz", sym)) {
    await sleep(250);
    type Row = { time: number; fundingRate: string };
    const data = await get<Row[]>("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "fundingHistory", coin: `xyz:${sym}`, startTime: s.funding_time }),
    });
    const item = data?.find((d) => d.time === s.funding_time);
    record(ts(s.funding_time), s.rate, item ? parseFloat(item.fundingRate) : null);
  }
}

// ─── AsterDEX ─────────────────────────────────────────────────────────────────

async function verifyAsterdex() {
  console.log("\n[AsterDEX]");
  const sym = await pickSymbol("asterdex");
  if (!sym) return console.log("  no data");
  console.log(`  symbol: ${sym}`);
  for (const s of await dbSamples("asterdex", sym)) {
    await sleep(250);
    type Row = { fundingRate: string; fundingTime: number };
    const data = await get<Row[]>(
      `https://fapi.asterdex.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${s.funding_time}&endTime=${s.funding_time}&limit=1`
    );
    record(ts(s.funding_time), s.rate, data?.[0] ? parseFloat(data[0].fundingRate) : null);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== 資金費率歷史資料驗證 ===");
  console.log("每家交易所抽查 5 筆，比對 DB 儲存值 vs 交易所即時 API\n");

  await verifyBinance();
  await verifyBybit();
  await verifyOkx();
  await verifyBitget();
  await verifyMexc();
  await verifyGate();
  await verifyHtx();
  await verifyKucoin();
  await verifyHyperliquid();
  await verifyTradexyz();
  await verifyAsterdex();

  const total = passed + failed + skipped;
  console.log(`\n${"─".repeat(50)}`);
  console.log(`共驗 ${total} 筆：✅ ${passed}  ❌ ${failed}  ⏭ ${skipped}（API 未回傳）`);
  if (failed > 0) {
    console.log("⚠️  有資料不一致，請進一步確認");
    process.exit(1);
  } else {
    console.log("🎉 所有可驗資料完全吻合");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
