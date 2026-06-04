import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import {
  getLatestFundingTimes,
  syncLatestFundingTimes,
  type FundingRecord,
} from "../src/lib/funding-db";

try {
  const text = readFileSync(".env.local", "utf-8");
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const NEW_SYMBOL_LOOKBACK = 7 * 86_400_000;  // 新幣種預設回溯 7 天
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY = 200;
const FETCH_TIMEOUT = 8_000;

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function getLatestTimes(exchange: string, symbols: string[]): Promise<Map<string, number>> {
  return getLatestFundingTimes(db, exchange, symbols);
}

async function insertBatch(
  records: FundingRecord[]
) {
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

function startOf(latest: number | undefined): number {
  return latest !== undefined ? latest + 1 : Date.now() - NEW_SYMBOL_LOOKBACK;
}

// ─── OKX ─────────────────────────────────────────────────────────────────────

async function collectOkx(symbols: string[]) {
  console.log(`\n[OKX] ${symbols.length} 個幣種...`);
  const latest = await getLatestTimes("okx", symbols);
  let total = 0;
  for (const sym of symbols) {
    const since = startOf(latest.get(sym));
    const records: Array<{ symbol: string; exchange: string; rate: number; fundingTime: number }> = [];
    let after = "";
    while (true) {
      await sleep(DELAY);
      try {
        const url = `https://www.okx.com/api/v5/public/funding-rate-history?instId=${sym}-USDT-SWAP&limit=100${after ? `&after=${after}` : ""}`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) break;
        const json: { data: Array<{ fundingRate: string; fundingTime: string }> } = await res.json();
        const list = json.data ?? [];
        if (!list.length) break;
        let done = false;
        for (const d of list) {
          const ft = parseInt(d.fundingTime);
          if (ft < since) { done = true; break; }
          records.push({ symbol: sym, exchange: "okx", rate: parseFloat(d.fundingRate), fundingTime: ft });
        }
        if (done || list.length < 100) break;
        after = list[list.length - 1].fundingTime;
      } catch { break; }
    }
    total += await insertBatch(records);
  }
  console.log(`[OKX] +${total} 筆`);
}

// ─── Bitget ───────────────────────────────────────────────────────────────────

async function collectBitget(symbols: string[]) {
  console.log(`\n[Bitget] ${symbols.length} 個幣種...`);
  const latest = await getLatestTimes("bitget", symbols);
  let total = 0;
  for (const sym of symbols) {
    const since = startOf(latest.get(sym));
    const records: Array<{ symbol: string; exchange: string; rate: number; fundingTime: number }> = [];
    let pageNo = 1;
    while (true) {
      await sleep(DELAY);
      try {
        const res = await fetchWithTimeout(
          `https://api.bitget.com/api/v2/mix/market/history-fund-rate?symbol=${sym}USDT&productType=USDT-FUTURES&pageSize=100&pageNo=${pageNo}`
        );
        if (!res.ok) break;
        const json: { data: Array<{ fundingRate: string; fundingTime: string }> } = await res.json();
        const list = json.data ?? [];
        if (!list.length) break;
        let done = false;
        for (const d of list) {
          const ft = parseInt(d.fundingTime);
          if (ft < since) { done = true; break; }
          records.push({ symbol: sym, exchange: "bitget", rate: parseFloat(d.fundingRate), fundingTime: ft });
        }
        if (done || list.length < 100) break;
        pageNo++;
      } catch { break; }
    }
    total += await insertBatch(records);
  }
  console.log(`[Bitget] +${total} 筆`);
}

// ─── MEXC ─────────────────────────────────────────────────────────────────────

async function collectMexc(symbols: string[]) {
  console.log(`\n[MEXC] ${symbols.length} 個幣種...`);
  const latest = await getLatestTimes("mexc", symbols);
  let total = 0;
  for (const sym of symbols) {
    const since = startOf(latest.get(sym));
    const records: Array<{ symbol: string; exchange: string; rate: number; fundingTime: number }> = [];
    let pageNum = 1;
    while (true) {
      await sleep(DELAY);
      try {
        const res = await fetchWithTimeout(
          `https://contract.mexc.com/api/v1/contract/funding_rate/history?symbol=${sym}_USDT&page_num=${pageNum}&page_size=100`
        );
        if (!res.ok) break;
        const json: { data?: { resultList?: Array<{ fundingRate: number; settleTime: number }> } } = await res.json();
        const list = json.data?.resultList ?? [];
        if (!list.length) break;
        let done = false;
        for (const d of list) {
          if (d.settleTime < since) { done = true; break; }
          records.push({ symbol: sym, exchange: "mexc", rate: d.fundingRate, fundingTime: d.settleTime });
        }
        if (done || list.length < 100) break;
        pageNum++;
      } catch { break; }
    }
    total += await insertBatch(records);
  }
  console.log(`[MEXC] +${total} 筆`);
}

// ─── Gate.io ──────────────────────────────────────────────────────────────────

async function collectGate(symbols: string[]) {
  console.log(`\n[Gate.io] ${symbols.length} 個幣種...`);
  const latest = await getLatestTimes("gate", symbols);
  let total = 0;
  const to = Math.floor(Date.now() / 1000);
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const since = startOf(latest.get(sym));
      const from = Math.floor(since / 1000);
      const res = await fetchWithTimeout(
        `https://api.gateio.ws/api/v4/futures/usdt/funding_rate?contract=${sym}_USDT&from=${from}&to=${to}&limit=1000`
      );
      if (!res.ok) continue;
      const data: Array<{ r: string; t: number }> = await res.json();
      total += await insertBatch(
        data.map((d) => ({ symbol: sym, exchange: "gate", rate: parseFloat(d.r), fundingTime: d.t * 1000 }))
      );
    } catch {}
  }
  console.log(`[Gate.io] +${total} 筆`);
}

// ─── HTX ──────────────────────────────────────────────────────────────────────

async function collectHtx(symbols: string[]) {
  console.log(`\n[HTX] ${symbols.length} 個幣種...`);
  const latest = await getLatestTimes("htx", symbols);
  let total = 0;
  for (const sym of symbols) {
    const since = startOf(latest.get(sym));
    const records: Array<{ symbol: string; exchange: string; rate: number; fundingTime: number }> = [];
    let pageIndex = 1;
    while (true) {
      await sleep(DELAY);
      try {
        const res = await fetchWithTimeout(
          `https://api.hbdm.com/linear-swap-api/v1/swap_historical_funding_rate?contract_code=${sym}-USDT&page_index=${pageIndex}&page_size=50`
        );
        if (!res.ok) break;
        const json: { data?: { data: Array<{ funding_rate: string; funding_time: string }>; total_page: number } } = await res.json();
        const list = json.data?.data ?? [];
        if (!list.length) break;
        let done = false;
        for (const d of list) {
          const ft = parseInt(d.funding_time);
          if (ft < since) { done = true; break; }
          records.push({ symbol: sym, exchange: "htx", rate: parseFloat(d.funding_rate), fundingTime: ft });
        }
        if (done || pageIndex >= (json.data?.total_page ?? 1)) break;
        pageIndex++;
      } catch { break; }
    }
    total += await insertBatch(records);
  }
  console.log(`[HTX] +${total} 筆`);
}

// ─── KuCoin ───────────────────────────────────────────────────────────────────

function toKucoinSymbol(symbol: string): string {
  return symbol === "BTC" ? "XBTUSDTM" : `${symbol}USDTM`;
}

async function collectKucoin(symbols: string[]) {
  console.log(`\n[KuCoin] ${symbols.length} 個幣種...`);
  const latest = await getLatestTimes("kucoin", symbols);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const since = startOf(latest.get(sym));
      const res = await fetchWithTimeout(
        `https://api-futures.kucoin.com/api/v1/funding-history?symbol=${toKucoinSymbol(sym)}&from=${since}&to=${Date.now()}&reverse=true&maxCount=1000`
      );
      if (!res.ok) continue;
      const json: {
        data?: { dataList?: Array<{ fundingRate: string; timepoint: number }> };
      } = await res.json();
      total += await insertBatch(
        (json.data?.dataList ?? []).map((d) => ({
          symbol: sym,
          exchange: "kucoin",
          rate: parseFloat(d.fundingRate),
          fundingTime: d.timepoint,
        }))
      );
    } catch {}
  }
  console.log(`[KuCoin] +${total} 筆`);
}

// ─── Hyperliquid ──────────────────────────────────────────────────────────────

async function collectHyperliquid(symbols: string[]) {
  console.log(`\n[Hyperliquid] ${symbols.length} 個幣種...`);
  const latest = await getLatestTimes("hyperliquid", symbols);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const since = startOf(latest.get(sym));
      const res = await fetchWithTimeout("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fundingHistory", coin: sym, startTime: since }),
      });
      if (!res.ok) continue;
      const data: Array<{ coin: string; fundingRate: string; time: number }> = await res.json();
      total += await insertBatch(
        data.map((d) => ({ symbol: d.coin, exchange: "hyperliquid", rate: parseFloat(d.fundingRate), fundingTime: d.time }))
      );
    } catch {}
  }
  console.log(`[Hyperliquid] +${total} 筆`);
}

// ─── Trade.xyz ────────────────────────────────────────────────────────────────

async function collectTradexyz(symbols: string[]) {
  console.log(`\n[Trade.xyz] ${symbols.length} 個幣種...`);
  const latest = await getLatestTimes("tradexyz", symbols);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const since = startOf(latest.get(sym));
      const res = await fetchWithTimeout("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fundingHistory", coin: `xyz:${sym}`, startTime: since }),
      });
      if (!res.ok) continue;
      const data: Array<{ coin: string; fundingRate: string; time: number }> = await res.json();
      total += await insertBatch(
        data.map((d) => ({ symbol: sym, exchange: "tradexyz", rate: parseFloat(d.fundingRate), fundingTime: d.time }))
      );
    } catch {}
  }
  console.log(`[Trade.xyz] +${total} 筆`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = Date.now();
  console.log(`[${new Date(startedAt).toISOString()}] 增量補齊，新幣種回溯 7 天\n`);

  const { getOkxFundingRates }         = await import("../src/lib/exchanges/okx");
  const { getBitgetFundingRates }      = await import("../src/lib/exchanges/bitget");
  const { getMexcFundingRates }        = await import("../src/lib/exchanges/mexc");
  const { getGateFundingRates }        = await import("../src/lib/exchanges/gate");
  const { getHtxFundingRates }         = await import("../src/lib/exchanges/htx");
  const { getKucoinFundingRates }      = await import("../src/lib/exchanges/kucoin");
  const { getHyperliquidFundingRates } = await import("../src/lib/exchanges/hyperliquid");
  const { getTradexyzFundingRates }    = await import("../src/lib/exchanges/tradexyz");

  console.log("取得各交易所幣種列表...");

  async function symbols(name: string, fn: () => Promise<Array<{ symbol: string }>>) {
    try {
      const rates = await fn();
      const syms = [...new Set(rates.map((r) => r.symbol))];
      console.log(`  ${name}: ${syms.length} 個`);
      return syms;
    } catch (e) {
      console.warn(`  ${name} 失敗:`, (e as Error).message);
      return [];
    }
  }

  const [
    okx, bitget, mexc, gate, htx, kucoin, hl, tradexyz,
  ] = await Promise.all([
    symbols("OKX",         getOkxFundingRates),
    symbols("Bitget",      getBitgetFundingRates),
    symbols("MEXC",        getMexcFundingRates),
    symbols("Gate.io",     getGateFundingRates),
    symbols("HTX",         getHtxFundingRates),
    symbols("KuCoin",      getKucoinFundingRates),
    symbols("Hyperliquid", getHyperliquidFundingRates),
    symbols("Trade.xyz",   getTradexyzFundingRates),
  ]);

  await collectOkx(okx);
  await collectBitget(bitget);
  await collectMexc(mexc);
  await collectGate(gate);
  await collectHtx(htx);
  await collectKucoin(kucoin);
  await collectHyperliquid(hl);
  await collectTradexyz(tradexyz);

  // 清理超過 30 天的舊資料（max window = 30d，不需要保留更多）
  const cutoff = Date.now() - 30 * 86_400_000;
  const del = await db.execute(`DELETE FROM funding_rates WHERE funding_time < ${cutoff}`);
  console.log(`\n清理: ${del.rowsAffected} 筆 (>30天)`);

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`✓ 完成，耗時 ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
