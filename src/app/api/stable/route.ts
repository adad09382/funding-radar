import { NextRequest } from "next/server";
import { db } from "@/lib/turso";

export const dynamic = "force-dynamic";

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const windowDays = Math.min(30, Math.max(1, parseInt(p.get("window") ?? "7")));
  const sort = p.get("sort") ?? "yield"; // yield | consistent | recent
  const since = Date.now() - windowDays * 86_400_000;
  const minRecords = Math.max(2, windowDays);

  try {
    const result = await db.execute(`
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
        ORDER BY symbol, exchange, funding_time ASC
      )
      GROUP BY symbol, exchange
      HAVING cnt >= ${minRecords} AND ABS(avg_rate) > 0.000005
    `);

    const assets = result.rows.map((row) => {
      const rates = (row.rates as string).split(",").map(Number);
      const cnt = row.cnt as number;
      const settlementsPerYear = (cnt / windowDays) * 365;
      const settlementsPerDay = cnt / windowDays;

      const med = median(rates);
      const dir = med >= 0 ? 1 : -1;
      const sameDir = rates.filter((r) => (dir > 0 ? r > 0 : r < 0)).length;
      const consistency = sameDir / cnt;

      const annMedian = med * settlementsPerYear;
      const annMean = (row.avg_rate as number) * settlementsPerYear;
      const annWorst = (dir > 0 ? (row.min_rate as number) : (row.max_rate as number)) * settlementsPerYear;
      const annCurrent = rates[rates.length - 1] * settlementsPerYear;

      let consecutive = 0;
      for (let i = rates.length - 1; i >= 0; i--) {
        if (dir > 0 ? rates[i] > 0 : rates[i] < 0) consecutive++;
        else break;
      }
      const consecutiveDays = Math.round((consecutive / settlementsPerDay) * 10) / 10;

      return {
        symbol: row.symbol as string,
        exchange: row.exchange as string,
        heatmap: rates.slice(-30),
        consecutiveDays,
        consistency,
        annMean,
        annMedian,
        annWorst,
        annCurrent,
        cnt,
      };
    });

    let sorted = assets;
    if (sort === "yield") {
      sorted = assets.sort((a, b) => Math.abs(b.annMedian) - Math.abs(a.annMedian));
    } else if (sort === "consistent") {
      sorted = assets.sort(
        (a, b) => b.consistency - a.consistency || Math.abs(b.annMedian) - Math.abs(a.annMedian)
      );
    } else {
      sorted = assets.sort((a, b) => Math.abs(b.annCurrent) - Math.abs(a.annCurrent));
    }

    return Response.json(sorted.slice(0, 100));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
