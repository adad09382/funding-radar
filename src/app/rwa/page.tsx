import { getAllFundingRates } from "@/lib/exchanges";
import { RWA_ASSETS, RWA_EXCHANGES, getRWASymbol, type RWACategory } from "@/lib/types";
import type { Exchange, FundingRate } from "@/lib/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ExchangeBadge } from "@/components/ExchangeBadge";
import { RateCell } from "@/components/RateCell";

export const revalidate = 60;

function formatCountdown(nextFundingTime: number): string {
  if (!Number.isFinite(nextFundingTime) || nextFundingTime <= 0) return "—";
  const ms = nextFundingTime - Date.now();
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const CATEGORY_LABEL: Record<RWACategory, string> = {
  commodity: "大宗商品",
  etf: "ETF",
  stock: "股票",
  forex: "外匯",
};

export default async function RwaPage() {
  const rates = await getAllFundingRates();

  // 每個交易所建立 symbol → FundingRate 查找表
  const byExchange = new Map<Exchange, Map<string, FundingRate>>();
  for (const ex of RWA_EXCHANGES) {
    byExchange.set(ex, new Map());
  }
  for (const r of rates) {
    byExchange.get(r.exchange as Exchange)?.set(r.symbol, r);
  }

  // 依分類分組
  const grouped = new Map<RWACategory, typeof RWA_ASSETS>();
  for (const asset of RWA_ASSETS) {
    if (!grouped.has(asset.category)) grouped.set(asset.category, []);
    grouped.get(asset.category)!.push(asset);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">RWA 專區</h1>
        <p className="text-sm text-zinc-500 mb-3">
          追蹤傳統金融資產永續合約（股票、ETF、大宗商品）的資金費率。
        </p>
        <div className="flex items-center gap-5 text-xs">
          <span className="flex items-center gap-1.5 text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            綠色：費率 &gt; +0.05%，多頭付費（做空可收）
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            紅色：費率 &lt; -0.05%，空頭付費（做多可收）
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
            灰色：介於 ±0.05%，市場中性
          </span>
        </div>
      </div>

      {(["commodity", "etf", "stock", "forex"] as RWACategory[]).map((cat) => {
        const assets = grouped.get(cat);
        if (!assets?.length) return null;

        return (
          <div key={cat} className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
              {CATEGORY_LABEL[cat]}
            </h2>
            <div className="rounded-lg border border-zinc-800 overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 w-40">資產</TableHead>
                    {RWA_EXCHANGES.map((ex) => (
                      <TableHead key={ex} className="text-zinc-400">
                        <ExchangeBadge exchange={ex} />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => {
                    const hasAny = RWA_EXCHANGES.some((ex) => {
                      const sym = getRWASymbol(asset, ex);
                      return byExchange.get(ex)?.has(sym);
                    });

                    return (
                      <TableRow key={asset.symbol} className="border-zinc-800 hover:bg-zinc-900/50">
                        <TableCell>
                          <div className="font-bold text-white text-sm">{asset.name}</div>
                          <div className="text-xs text-zinc-500 font-mono">{asset.symbol}</div>
                        </TableCell>
                        {RWA_EXCHANGES.map((ex) => {
                          const sym = getRWASymbol(asset, ex);
                          const r = byExchange.get(ex)?.get(sym);
                          return (
                            <TableCell key={ex}>
                              {r ? (
                                <div>
                                  <RateCell rate={r.rate} />
                                  <div className="text-xs text-zinc-500 font-mono mt-0.5">
                                    {formatCountdown(r.nextFundingTime)}
                                  </div>
                                  {asset.symbolOverride?.[ex] && (
                                    <div className="text-xs text-zinc-600 font-mono">{sym}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-700">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
