import { NextRequest } from "next/server";
import { db } from "@/lib/turso";
import type { StableAsset } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── in-process cache ────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 min
const cache = new Map<number, { data: StableAsset[]; expires: number }>();

function getCached(window: number): StableAsset[] | null {
  const e = cache.get(window);
  return e && Date.now() < e.expires ? e.data : null;
}
function setCached(window: number, data: StableAsset[]) {
  cache.set(window, { data, expires: Date.now() + CACHE_TTL });
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ─── handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const windowDays = Math.min(30, Math.max(1, parseInt(req.nextUrl.searchParams.get("window") ?? "7")));

  const cached = getCached(windowDays);
  if (cached) return Response.json(cached);

  const since = Date.now() - windowDays * 86_400_000;
  const minRecords = Math.max(2, windowDays);

  try {
    // Pass 1: aggregate stats only — fast, get top 300 by |avg_rate|
    const pass1 = await db.execute(`
      SELECT symbol, exchange
      FROM funding_rates
      WHERE funding_time >= ${since}
      GROUP BY symbol, exchange
      HAVING COUNT(*) >= ${minRecords} AND ABS(AVG(rate)) > 0.000005
      ORDER BY ABS(AVG(rate)) DESC
      LIMIT 300
    `);

    if (!pass1.rows.length) {
      setCached(windowDays, []);
      return Response.json([]);
    }

    const inClause = pass1.rows
      .map((r) => `('${r.symbol}','${r.exchange}')`)
      .join(",");

    // Pass 2: GROUP_CONCAT only for top 300
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

    // Sort by |annMedian| descending as canonical order (client will re-sort)
    assets.sort((a, b) => Math.abs(b.annMedian) - Math.abs(a.annMedian));

    setCached(windowDays, assets);
    return Response.json(assets);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
