import { NextResponse } from "next/server";
import { db } from "@/lib/turso";
import type { StableRateAsset, Exchange } from "@/lib/types";

export const revalidate = 3600;

export async function GET() {
  try {
    const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const since90d = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const result = await db.execute(`
      SELECT
        symbol,
        exchange,
        AVG(CASE WHEN recorded_at >= ${since30d} THEN rate END) AS avg30d,
        AVG(CASE WHEN recorded_at >= ${since90d} THEN rate END) AS avg90d,
        SUM(CASE WHEN recorded_at >= ${since30d} AND rate > 0 THEN 1 ELSE 0 END) * 1.0 /
          NULLIF(COUNT(CASE WHEN recorded_at >= ${since30d} THEN 1 END), 0) AS positive_ratio30d,
        COUNT(CASE WHEN recorded_at >= ${since30d} THEN 1 END) AS sample_count
      FROM funding_rates
      WHERE recorded_at >= ${since90d}
      GROUP BY symbol, exchange
      HAVING sample_count >= 5
    `);

    const assets: StableRateAsset[] = result.rows
      .map((r) => ({
        symbol: r.symbol as string,
        exchange: r.exchange as Exchange,
        avgRate30d: (r.avg30d as number) ?? 0,
        avgRate90d: (r.avg90d as number) ?? 0,
        positiveRatio30d: (r.positive_ratio30d as number) ?? 0,
        direction: (
          ((r.positive_ratio30d as number) ?? 0) >= 0.8 ? "positive" :
          ((r.positive_ratio30d as number) ?? 1) <= 0.2 ? "negative" : "neutral"
        ) as StableRateAsset["direction"],
        sampleCount: r.sample_count as number,
      }))
      .sort((a, b) => Math.abs(b.avgRate30d) - Math.abs(a.avgRate30d));

    return NextResponse.json(assets);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
