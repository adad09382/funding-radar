import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/turso";
import {
  getLatestFundingTimes,
  syncLatestFundingTimes,
  type FundingRecord,
} from "@/lib/funding-db";
import { getBinanceFundingRates } from "@/lib/exchanges/binance";
import { getBybitFundingRates } from "@/lib/exchanges/bybit";
import { getAsterDexFundingRates } from "@/lib/exchanges/asterdex";

export const dynamic = "force-dynamic";

export const maxDuration = 60; // Vercel Pro: 60s；Hobby: capped at 10s

const NEW_SYMBOL_LOOKBACK = 7 * 86_400_000;
const BATCH = 100;  // 每批並行請求數（提高並行度，減少總耗時）

function ft(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function since(latest: number | undefined): number {
  return latest !== undefined ? latest + 1 : Date.now() - NEW_SYMBOL_LOOKBACK;
}

async function upsert(records: FundingRecord[]) {
  if (!records.length) return 0;
  const CHUNK = 100;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    await db.batch(
      chunk.map((r) => ({
        sql: `INSERT OR IGNORE INTO funding_rates (symbol, exchange, rate, funding_time) VALUES (?, ?, ?, ?)`,
        args: [r.symbol, r.exchange, r.rate, r.fundingTime],
      }))
    );
  }
  await syncLatestFundingTimes(db, records);
  return records.length;
}

// ─── per-symbol fetchers ──────────────────────────────────────────────────────

async function binanceFetch(sym: string, start: number) {
  try {
    const res = await ft(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${start}&limit=1000`);
    if (!res.ok) return [];
    const data: Array<{ fundingRate: string; fundingTime: number }> = await res.json();
    return data.map((d) => ({ symbol: sym, exchange: "binance", rate: parseFloat(d.fundingRate), fundingTime: d.fundingTime }));
  } catch { return []; }
}

async function bybitFetch(sym: string, start: number) {
  try {
    const res = await ft(
      `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${sym}USDT&startTime=${start}&endTime=${Date.now()}&limit=200`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return [];
    const json: { result: { list: Array<{ fundingRate: string; fundingRateTimestamp: string }> } } = await res.json();
    return (json.result?.list ?? []).map((d) => ({
      symbol: sym, exchange: "bybit", rate: parseFloat(d.fundingRate), fundingTime: parseInt(d.fundingRateTimestamp),
    }));
  } catch { return []; }
}

async function asterFetch(sym: string, start: number) {
  try {
    const res = await ft(`https://fapi.asterdex.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${start}&limit=1000`);
    if (!res.ok) return [];
    const data: Array<{ fundingRate: string; fundingTime: number }> = await res.json();
    return data.map((d) => ({ symbol: sym, exchange: "asterdex", rate: parseFloat(d.fundingRate), fundingTime: d.fundingTime }));
  } catch { return []; }
}

// ─── parallel collector ───────────────────────────────────────────────────────

async function collect(
  exchange: string,
  symbols: string[],
  fetcher: (sym: string, start: number) => Promise<FundingRecord[]>
): Promise<number> {
  const latest = await getLatestFundingTimes(db, exchange, symbols);
  let total = 0;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((sym) => fetcher(sym, since(latest.get(sym)))));
    const records = results
      .filter((r): r is PromiseFulfilledResult<ReturnType<typeof binanceFetch> extends Promise<infer T> ? T : never> => r.status === "fulfilled")
      .flatMap((r) => r.value as FundingRecord[]);
    total += await upsert(records);
  }
  return total;
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.COLLECT_SECRET || secret !== process.env.COLLECT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  // 取幣種清單（三家並行）
  const [binanceRes, bybitRes, asterRes] = await Promise.allSettled([
    getBinanceFundingRates(),
    getBybitFundingRates(),
    getAsterDexFundingRates(),
  ]);

  const binanceSyms = binanceRes.status === "fulfilled" ? [...new Set(binanceRes.value.map((r) => r.symbol))] : [];
  const bybitSyms   = bybitRes.status   === "fulfilled" ? [...new Set(bybitRes.value.map((r) => r.symbol))]   : [];
  const asterSyms   = asterRes.status   === "fulfilled" ? [...new Set(asterRes.value.map((r) => r.symbol))]   : [];

  // 三家同時並行收集
  const [binanceN, bybitN, asterN] = await Promise.all([
    collect("binance",  binanceSyms, binanceFetch),
    collect("bybit",    bybitSyms,   bybitFetch),
    collect("asterdex", asterSyms,   asterFetch),
  ]);

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  return NextResponse.json({
    ok: true,
    elapsed,
    binance: binanceN,
    bybit: bybitN,
    asterdex: asterN,
  });
}
