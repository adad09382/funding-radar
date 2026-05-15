import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

// 本地執行時從 .env.local 讀取環境變數
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

const DAYS_BACK = 30;
const START_MS = Date.now() - DAYS_BACK * 86_400_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY = 250; // ms between requests
const FETCH_TIMEOUT = 8_000; // ms

const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7)?.toLowerCase();

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ─── DB 寫入 ────────────────────────────────────────────────────────────────

async function insertBatch(
  records: Array<{ symbol: string; exchange: string; rate: number; fundingTime: number }>
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
  return records.length;
}

// ─── 取得各交易所幣種清單 ─────────────────────────────────────────────────────

async function getSymbols(
  name: string,
  fetcher: () => Promise<Array<{ symbol: string }>>
): Promise<string[]> {
  try {
    const rates = await fetcher();
    const symbols = [...new Set(rates.map((r) => r.symbol))];
    console.log(`  ${name}: ${symbols.length} 個幣種`);
    return symbols;
  } catch (e) {
    console.warn(`  ${name} 幣種列表失敗:`, (e as Error).message);
    return [];
  }
}

// ─── Binance ─────────────────────────────────────────────────────────────────
// limit=1000 覆蓋 333 天，一個 symbol 只需一次 call

async function backfillBinance(symbols: string[]) {
  console.log(`\n[Binance] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const res = await fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${START_MS}&limit=1000`
      );
      if (!res.ok) continue;
      const data: Array<{ fundingRate: string; fundingTime: number }> = await res.json();
      const records = data.map((d) => ({
        symbol: sym, exchange: "binance", rate: parseFloat(d.fundingRate), fundingTime: d.fundingTime,
      }));
      total += await insertBatch(records);
    } catch {}
  }
  console.log(`[Binance] 完成 ${total} 筆`);
}

// ─── Bybit ───────────────────────────────────────────────────────────────────
// 支援 startTime，200 條 > 60天×3次 = 180條，一次搞定

async function backfillBybit(symbols: string[]) {
  console.log(`\n[Bybit] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const res = await fetchWithTimeout(
        `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${sym}USDT&startTime=${START_MS}&endTime=${Date.now()}&limit=200`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (!res.ok) continue;
      const json: {
        result: { list: Array<{ fundingRate: string; fundingRateTimestamp: string }> };
      } = await res.json();
      const records = (json.result?.list ?? []).map((d) => ({
        symbol: sym, exchange: "bybit", rate: parseFloat(d.fundingRate),
        fundingTime: parseInt(d.fundingRateTimestamp),
      }));
      total += await insertBatch(records);
    } catch {}
  }
  console.log(`[Bybit] 完成 ${total} 筆`);
}

// ─── OKX ─────────────────────────────────────────────────────────────────────
// limit=100，需分頁（after = 最舊那筆的 fundingTime，往更早翻）

async function backfillOkx(symbols: string[]) {
  console.log(`\n[OKX] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
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
          if (ft < START_MS) { done = true; break; }
          records.push({ symbol: sym, exchange: "okx", rate: parseFloat(d.fundingRate), fundingTime: ft });
        }
        if (done || list.length < 100) break;
        after = list[list.length - 1].fundingTime;
      } catch { break; }
    }
    total += await insertBatch(records);
  }
  console.log(`[OKX] 完成 ${total} 筆`);
}

// ─── Bitget ───────────────────────────────────────────────────────────────────

async function backfillBitget(symbols: string[]) {
  console.log(`\n[Bitget] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
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
          if (ft < START_MS) { done = true; break; }
          records.push({ symbol: sym, exchange: "bitget", rate: parseFloat(d.fundingRate), fundingTime: ft });
        }
        if (done || list.length < 100) break;
        pageNo++;
      } catch { break; }
    }
    total += await insertBatch(records);
  }
  console.log(`[Bitget] 完成 ${total} 筆`);
}

// ─── MEXC ─────────────────────────────────────────────────────────────────────

async function backfillMexc(symbols: string[]) {
  console.log(`\n[MEXC] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
    const records: Array<{ symbol: string; exchange: string; rate: number; fundingTime: number }> = [];
    let pageNum = 1;
    while (true) {
      await sleep(DELAY);
      try {
        const res = await fetchWithTimeout(
          `https://contract.mexc.com/api/v1/contract/funding_rate/history?symbol=${sym}_USDT&page_num=${pageNum}&page_size=100`
        );
        if (!res.ok) break;
        const json: {
          data?: { resultList?: Array<{ fundingRate: number; settleTime: number }> };
        } = await res.json();
        const list = json.data?.resultList ?? [];
        if (!list.length) break;
        let done = false;
        for (const d of list) {
          if (d.settleTime < START_MS) { done = true; break; }
          records.push({ symbol: sym, exchange: "mexc", rate: d.fundingRate, fundingTime: d.settleTime });
        }
        if (done || list.length < 100) break;
        pageNum++;
      } catch { break; }
    }
    total += await insertBatch(records);
  }
  console.log(`[MEXC] 完成 ${total} 筆`);
}

// ─── Gate.io ──────────────────────────────────────────────────────────────────
// limit=1000，時間範圍一次搞定

async function backfillGate(symbols: string[]) {
  console.log(`\n[Gate.io] ${symbols.length} 個幣種...`);
  let total = 0;
  const from = Math.floor(START_MS / 1000);
  const to = Math.floor(Date.now() / 1000);
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const res = await fetchWithTimeout(
        `https://api.gateio.ws/api/v4/futures/usdt/funding_rate?contract=${sym}_USDT&from=${from}&to=${to}&limit=1000`
      );
      if (!res.ok) continue;
      const data: Array<{ r: string; t: number }> = await res.json();
      const records = data.map((d) => ({
        symbol: sym, exchange: "gate", rate: parseFloat(d.r), fundingTime: d.t * 1000,
      }));
      total += await insertBatch(records);
    } catch {}
  }
  console.log(`[Gate.io] 完成 ${total} 筆`);
}

// ─── HTX ──────────────────────────────────────────────────────────────────────
// 每頁上限 50，需分頁；60天×3次=180條 → 約 4 頁

async function backfillHtx(symbols: string[]) {
  console.log(`\n[HTX] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
    const records: Array<{ symbol: string; exchange: string; rate: number; fundingTime: number }> = [];
    let pageIndex = 1;
    while (true) {
      await sleep(DELAY);
      try {
        const res = await fetchWithTimeout(
          `https://api.hbdm.com/linear-swap-api/v1/swap_historical_funding_rate?contract_code=${sym}-USDT&page_index=${pageIndex}&page_size=50`
        );
        if (!res.ok) break;
        const json: {
          data?: { data: Array<{ funding_rate: string; funding_time: string }>; total_page: number };
        } = await res.json();
        const list = json.data?.data ?? [];
        if (!list.length) break;
        let done = false;
        for (const d of list) {
          const ft = parseInt(d.funding_time);
          if (ft < START_MS) { done = true; break; }
          records.push({ symbol: sym, exchange: "htx", rate: parseFloat(d.funding_rate), fundingTime: ft });
        }
        if (done || pageIndex >= (json.data?.total_page ?? 1)) break;
        pageIndex++;
      } catch { break; }
    }
    total += await insertBatch(records);
  }
  console.log(`[HTX] 完成 ${total} 筆`);
}

// ─── KuCoin ───────────────────────────────────────────────────────────────────
// maxCount=1000，時間範圍一次搞定

async function backfillKucoin(symbols: string[]) {
  console.log(`\n[KuCoin] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const kSym = sym === "BTC" ? "XBTUSDTM" : `${sym}USDTM`;
      const res = await fetchWithTimeout(
        `https://api-futures.kucoin.com/api/v1/funding-history?symbol=${kSym}&from=${START_MS}&to=${Date.now()}&reverse=true&maxCount=1000`
      );
      if (!res.ok) continue;
      const json: {
        data?: { dataList?: Array<{ fundingRate: string; timepoint: number }> };
      } = await res.json();
      const records = (json.data?.dataList ?? []).map((d) => ({
        symbol: sym, exchange: "kucoin", rate: parseFloat(d.fundingRate), fundingTime: d.timepoint,
      }));
      total += await insertBatch(records);
    } catch {}
  }
  console.log(`[KuCoin] 完成 ${total} 筆`);
}

// ─── Hyperliquid ──────────────────────────────────────────────────────────────

async function backfillHyperliquid(symbols: string[]) {
  console.log(`\n[Hyperliquid] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const res = await fetchWithTimeout("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fundingHistory", coin: sym, startTime: START_MS }),
      });
      if (!res.ok) continue;
      const data: Array<{ coin: string; fundingRate: string; time: number }> = await res.json();
      const records = data.map((d) => ({
        symbol: d.coin, exchange: "hyperliquid", rate: parseFloat(d.fundingRate), fundingTime: d.time,
      }));
      total += await insertBatch(records);
    } catch {}
  }
  console.log(`[Hyperliquid] 完成 ${total} 筆`);
}

// ─── Trade.xyz ────────────────────────────────────────────────────────────────

async function backfillTradexyz(symbols: string[]) {
  console.log(`\n[Trade.xyz] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const res = await fetchWithTimeout("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fundingHistory", coin: `xyz:${sym}`, startTime: START_MS }),
      });
      if (!res.ok) continue;
      const data: Array<{ coin: string; fundingRate: string; time: number }> = await res.json();
      const records = data.map((d) => ({
        symbol: sym, exchange: "tradexyz", rate: parseFloat(d.fundingRate), fundingTime: d.time,
      }));
      total += await insertBatch(records);
    } catch {}
  }
  console.log(`[Trade.xyz] 完成 ${total} 筆`);
}

// ─── AsterDEX ─────────────────────────────────────────────────────────────────
// Binance fork，支援 startTime

async function backfillAsterdex(symbols: string[]) {
  console.log(`\n[AsterDEX] ${symbols.length} 個幣種...`);
  let total = 0;
  for (const sym of symbols) {
    await sleep(DELAY);
    try {
      const res = await fetchWithTimeout(
        `https://fapi.asterdex.com/fapi/v1/fundingRate?symbol=${sym}USDT&startTime=${START_MS}&limit=1000`
      );
      if (!res.ok) continue;
      const data: Array<{ fundingRate: string; fundingTime: number }> = await res.json();
      const records = data.map((d) => ({
        symbol: sym, exchange: "asterdex", rate: parseFloat(d.fundingRate), fundingTime: d.fundingTime,
      }));
      total += await insertBatch(records);
    } catch {}
  }
  console.log(`[AsterDEX] 完成 ${total} 筆`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = Date.now();
  console.log(`回填起始時間: ${new Date(START_MS).toISOString()} (${DAYS_BACK} 天)\n`);
  console.log("取得各交易所幣種列表...");

  const {
    getBinanceFundingRates,
  } = await import("../src/lib/exchanges/binance");
  const { getBybitFundingRates } = await import("../src/lib/exchanges/bybit");
  const { getOkxFundingRates } = await import("../src/lib/exchanges/okx");
  const { getBitgetFundingRates } = await import("../src/lib/exchanges/bitget");
  const { getMexcFundingRates } = await import("../src/lib/exchanges/mexc");
  const { getGateFundingRates } = await import("../src/lib/exchanges/gate");
  const { getHtxFundingRates } = await import("../src/lib/exchanges/htx");
  const { getKucoinFundingRates } = await import("../src/lib/exchanges/kucoin");
  const { getHyperliquidFundingRates } = await import("../src/lib/exchanges/hyperliquid");
  const { getTradexyzFundingRates } = await import("../src/lib/exchanges/tradexyz");
  const { getAsterDexFundingRates } = await import("../src/lib/exchanges/asterdex");

  const [
    binanceSymbols, bybitSymbols, okxSymbols, bitgetSymbols,
    mexcSymbols, gateSymbols, htxSymbols, kucoinSymbols,
    hlSymbols, tradexyzSymbols, asterSymbols,
  ] = await Promise.all([
    getSymbols("Binance", getBinanceFundingRates),
    getSymbols("Bybit", getBybitFundingRates),
    getSymbols("OKX", getOkxFundingRates),
    getSymbols("Bitget", getBitgetFundingRates),
    getSymbols("MEXC", getMexcFundingRates),
    getSymbols("Gate.io", getGateFundingRates),
    getSymbols("HTX", getHtxFundingRates),
    getSymbols("KuCoin", getKucoinFundingRates),
    getSymbols("Hyperliquid", getHyperliquidFundingRates),
    getSymbols("Trade.xyz", getTradexyzFundingRates),
    getSymbols("AsterDEX", getAsterDexFundingRates),
  ]);

  const should = (name: string) => !ONLY || ONLY === name;

  // 依序回填，避免同時打太多 API
  if (should("binance")    && binanceSymbols.length)   await backfillBinance(binanceSymbols);
  if (should("bybit")      && bybitSymbols.length)     await backfillBybit(bybitSymbols);
  if (should("okx")        && okxSymbols.length)       await backfillOkx(okxSymbols);
  if (should("bitget")     && bitgetSymbols.length)    await backfillBitget(bitgetSymbols);
  if (should("mexc")       && mexcSymbols.length)      await backfillMexc(mexcSymbols);
  if (should("gate")       && gateSymbols.length)      await backfillGate(gateSymbols);
  if (should("htx")        && htxSymbols.length)       await backfillHtx(htxSymbols);
  if (should("kucoin")     && kucoinSymbols.length)    await backfillKucoin(kucoinSymbols);
  if (should("hyperliquid")&& hlSymbols.length)        await backfillHyperliquid(hlSymbols);
  if (should("tradexyz")   && tradexyzSymbols.length)  await backfillTradexyz(tradexyzSymbols);
  if (should("asterdex")   && asterSymbols.length)     await backfillAsterdex(asterSymbols);

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n✓ 全部完成，耗時 ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log("Lighter / EdgeX 歷史 endpoint 尚未確認，暫時略過。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
