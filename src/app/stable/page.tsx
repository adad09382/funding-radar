import { db } from "@/lib/turso";
import type { StableRateAsset, Exchange } from "@/lib/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ExchangeBadge } from "@/components/ExchangeBadge";

export const revalidate = 3600;

async function getStableAssets(): Promise<StableRateAsset[]> {
  const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const since90d = Date.now() - 90 * 24 * 60 * 60 * 1000;

  const result = await db.execute(`
    SELECT
      symbol, exchange,
      AVG(CASE WHEN recorded_at >= ${since30d} THEN rate END) AS avg30d,
      AVG(CASE WHEN recorded_at >= ${since90d} THEN rate END) AS avg90d,
      CAST(SUM(CASE WHEN recorded_at >= ${since30d} AND rate > 0 THEN 1 ELSE 0 END) AS REAL) /
        NULLIF(COUNT(CASE WHEN recorded_at >= ${since30d} THEN 1 END), 0) AS positive_ratio30d,
      COUNT(CASE WHEN recorded_at >= ${since30d} THEN 1 END) AS sample_count
    FROM funding_rates
    WHERE recorded_at >= ${since90d}
    GROUP BY symbol, exchange
    HAVING sample_count >= 5
  `);

  return result.rows
    .map((r): StableRateAsset => {
      const ratio = (r.positive_ratio30d as number) ?? 0.5;
      return {
        symbol: r.symbol as string,
        exchange: r.exchange as Exchange,
        avgRate30d: (r.avg30d as number) ?? 0,
        avgRate90d: (r.avg90d as number) ?? 0,
        positiveRatio30d: ratio,
        direction: ratio >= 0.8 ? "positive" : ratio <= 0.2 ? "negative" : "neutral",
        sampleCount: r.sample_count as number,
      };
    })
    .filter((a) => a.direction !== "neutral")
    .sort((a, b) => Math.abs(b.avgRate30d) - Math.abs(a.avgRate30d));
}

export default async function StablePage() {
  let assets: StableRateAsset[] = [];
  let error = "";

  try {
    assets = await getStableAssets();
  } catch {
    error = "尚無歷史資料，請等 GitHub Actions 收集幾次後再來查看。";
  }

  const positive = assets.filter((a) => a.direction === "positive");
  const negative = assets.filter((a) => a.direction === "negative");

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold mb-1">穩定費率標的</h1>
        <p className="text-sm text-zinc-500">
          過去 30 天正費率佔比 ≥ 80% 或 ≤ 20% 的標的，適合長期期現套利。
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
          {error}
        </div>
      )}

      {positive.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-green-400 mb-2 uppercase tracking-wide">
            穩定正費率（做空可收費）
          </h2>
          <StableTable assets={positive} />
        </section>
      )}

      {negative.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-400 mb-2 uppercase tracking-wide">
            穩定負費率（做多可收費）
          </h2>
          <StableTable assets={negative} />
        </section>
      )}
    </div>
  );
}

function StableTable({ assets }: { assets: StableRateAsset[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-400">幣種</TableHead>
            <TableHead className="text-zinc-400">交易所</TableHead>
            <TableHead className="text-zinc-400">30日均費率</TableHead>
            <TableHead className="text-zinc-400">90日均費率</TableHead>
            <TableHead className="text-zinc-400">正費率佔比</TableHead>
            <TableHead className="text-zinc-400">樣本數</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((a, i) => (
            <TableRow key={i} className="border-zinc-800 hover:bg-zinc-900/50">
              <TableCell className="font-mono font-bold text-white">
                {a.symbol}
              </TableCell>
              <TableCell>
                <ExchangeBadge exchange={a.exchange} />
              </TableCell>
              <TableCell className="font-mono text-sm">
                <span className={a.avgRate30d >= 0 ? "text-green-400" : "text-red-400"}>
                  {a.avgRate30d >= 0 ? "+" : ""}
                  {(a.avgRate30d * 100).toFixed(4)}%
                </span>
              </TableCell>
              <TableCell className="font-mono text-sm text-zinc-400">
                {a.avgRate90d >= 0 ? "+" : ""}
                {(a.avgRate90d * 100).toFixed(4)}%
              </TableCell>
              <TableCell>
                <span className={`font-mono text-sm ${
                  a.positiveRatio30d >= 0.8 ? "text-green-400" : "text-red-400"
                }`}>
                  {(a.positiveRatio30d * 100).toFixed(0)}%
                </span>
              </TableCell>
              <TableCell className="text-zinc-500 text-sm">{a.sampleCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
