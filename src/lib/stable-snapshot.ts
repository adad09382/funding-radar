import type { Client } from "@libsql/client";
import type { StableAsset } from "./types";

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function computeStableAssets(db: Client, windowDays: number): Promise<StableAsset[]> {
  const since = Date.now() - windowDays * 86_400_000;
  const minRecords = Math.max(2, windowDays);

  const pass1 = await db.execute(`
    SELECT symbol, exchange
    FROM funding_rates
    WHERE funding_time >= ${since}
    GROUP BY symbol, exchange
    HAVING COUNT(*) >= ${minRecords} AND ABS(AVG(rate)) > 0.000005
    ORDER BY ABS(AVG(rate)) DESC
    LIMIT 300
  `);

  if (!pass1.rows.length) return [];

  const inClause = pass1.rows
    .map((r) => `('${r.symbol}','${r.exchange}')`)
    .join(",");

  const pass2 = await db.execute(`
    SELECT symbol, exchange,
      GROUP_CONCAT(rate) AS rates,
      COUNT(*)           AS cnt,
      AVG(rate)          AS avg_rate,
      MIN(rate)          AS min_rate,
      MAX(rate)          AS max_rate
    FROM (
      SELECT symbol, exchange, rate
      FROM funding_rates
      WHERE funding_time >= ${since}
        AND (symbol, exchange) IN (${inClause})
      ORDER BY symbol, exchange, funding_time ASC
    )
    GROUP BY symbol, exchange
  `);

  const assets: StableAsset[] = pass2.rows.map((row) => {
    const rates = (row.rates as string).split(",").map(Number);
    const cnt = row.cnt as number;
    const settlementsPerYear = (cnt / windowDays) * 365;
    const settlementsPerDay = cnt / windowDays;

    const med = median(rates);
    const dir = med >= 0 ? 1 : -1;
    const consistency = rates.filter((r) => (dir > 0 ? r > 0 : r < 0)).length / cnt;
    const annMedian = med * settlementsPerYear;
    const annMean = (row.avg_rate as number) * settlementsPerYear;
    const annWorst =
      (dir > 0 ? (row.min_rate as number) : (row.max_rate as number)) * settlementsPerYear;
    const annCurrent = rates[rates.length - 1] * settlementsPerYear;

    let consecutive = 0;
    for (let i = rates.length - 1; i >= 0; i--) {
      if (dir > 0 ? rates[i] > 0 : rates[i] < 0) consecutive++;
      else break;
    }

    return {
      symbol: row.symbol as string,
      exchange: row.exchange as string,
      heatmap: rates.slice(-30),
      consecutiveDays: Math.round((consecutive / settlementsPerDay) * 10) / 10,
      consistency,
      annMean,
      annMedian,
      annWorst,
      annCurrent,
      cnt,
    };
  });

  assets.sort((a, b) => Math.abs(b.annMedian) - Math.abs(a.annMedian));
  return assets;
}

export const SNAPSHOT_WINDOWS = [7, 14, 30] as const;

export async function refreshSnapshot(db: Client): Promise<void> {
  for (const w of SNAPSHOT_WINDOWS) {
    const assets = await computeStableAssets(db, w);
    await db.execute({
      sql: `INSERT OR REPLACE INTO stable_snapshot (window_days, data, updated_at) VALUES (?, ?, ?)`,
      args: [w, JSON.stringify(assets), Date.now()],
    });
    console.log(`  window=${w}d → ${assets.length} 個幣種`);
  }
}
