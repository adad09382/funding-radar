import { createClient } from "@libsql/client";
import { getBinanceFundingRates } from "../src/lib/exchanges/binance";
import { getOkxFundingRates } from "../src/lib/exchanges/okx";
import { getBybitFundingRates } from "../src/lib/exchanges/bybit";
import { getBitgetFundingRates } from "../src/lib/exchanges/bitget";
import { getMexcFundingRates } from "../src/lib/exchanges/mexc";
import { getGateFundingRates } from "../src/lib/exchanges/gate";
import { getHtxFundingRates } from "../src/lib/exchanges/htx";
import { getKucoinFundingRates } from "../src/lib/exchanges/kucoin";
import { getHyperliquidFundingRates } from "../src/lib/exchanges/hyperliquid";
import { getAsterDexFundingRates } from "../src/lib/exchanges/asterdex";
import { getLighterFundingRates } from "../src/lib/exchanges/lighter";
import { getEdgeXFundingRates } from "../src/lib/exchanges/edgex";
import { getTradexyzFundingRates } from "../src/lib/exchanges/tradexyz";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const FETCHERS = [
  { name: "binance",     fn: getBinanceFundingRates },
  { name: "okx",         fn: getOkxFundingRates },
  { name: "bybit",       fn: getBybitFundingRates },
  { name: "bitget",      fn: getBitgetFundingRates },
  { name: "mexc",        fn: getMexcFundingRates },
  { name: "gate",        fn: getGateFundingRates },
  { name: "htx",         fn: getHtxFundingRates },
  { name: "kucoin",      fn: getKucoinFundingRates },
  { name: "hyperliquid", fn: getHyperliquidFundingRates },
  { name: "asterdex",    fn: getAsterDexFundingRates },
  { name: "lighter",     fn: getLighterFundingRates },
  { name: "edgex",       fn: getEdgeXFundingRates },
  { name: "tradexyz",   fn: getTradexyzFundingRates },
];

async function main() {
  const now = Date.now();
  console.log(`[${new Date(now).toISOString()}] 開始收集資金費率...`);

  const results = await Promise.allSettled(FETCHERS.map((f) => f.fn()));
  let total = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const name = FETCHERS[i].name;

    if (result.status === "rejected") {
      console.error(`[${name}] 失敗:`, result.reason);
      continue;
    }

    const rates = result.value;
    console.log(`[${name}] ${rates.length} 筆`);

    const BATCH = 100;
    for (let j = 0; j < rates.length; j += BATCH) {
      const batch = rates.slice(j, j + BATCH);
      await db.batch(
        batch.map((r) => ({
          sql: `INSERT OR IGNORE INTO funding_rates (symbol, exchange, rate, funding_time)
                VALUES (?, ?, ?, ?)`,
          args: [r.symbol, r.exchange, r.rate, r.nextFundingTime],
        }))
      );
    }
    total += rates.length;
  }

  const cutoff = now - 35 * 24 * 60 * 60 * 1000;
  const deleted = await db.execute(
    `DELETE FROM funding_rates WHERE funding_time < ${cutoff}`
  );
  console.log(`清理舊資料: ${deleted.rowsAffected} 筆`);
  console.log(`完成，共寫入 ${total} 筆`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
