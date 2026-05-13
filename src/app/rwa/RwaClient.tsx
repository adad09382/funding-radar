"use client";

import { useState, useEffect } from "react";
import type { Exchange, FundingRate } from "@/lib/types";
import { RWA_ASSETS, RWA_EXCHANGES, getRWASymbol, type RWACategory } from "@/lib/types";
import { getBinanceFundingRates } from "@/lib/exchanges/binance";
import { getBybitFundingRates } from "@/lib/exchanges/bybit";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ExchangeBadge } from "@/components/ExchangeBadge";
import { RateCell } from "@/components/RateCell";

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

const CATEGORY_CHIP: Record<RWACategory, string> = {
  commodity: "text-amber-400 bg-amber-400/10",
  etf:       "text-blue-400 bg-blue-400/10",
  stock:     "text-purple-400 bg-purple-400/10",
  forex:     "text-teal-400 bg-teal-400/10",
};

type SortDir = "desc" | "asc";

export function RwaClient({ serverRates }: { serverRates: FundingRate[] }) {
  const [rates, setRates] = useState<FundingRate[]>(serverRates);
  const [clientLoading, setClientLoading] = useState(true);
  const [sortExchange, setSortExchange] = useState<Exchange | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    Promise.allSettled([getBinanceFundingRates(), getBybitFundingRates()]).then(
      (results) => {
        const extra = results.flatMap((r) =>
          r.status === "fulfilled" ? r.value : []
        );
        if (extra.length > 0) setRates([...serverRates, ...extra]);
        setClientLoading(false);
      }
    );
  }, []);

  function handleExchangeClick(ex: Exchange) {
    if (sortExchange !== ex) {
      setSortExchange(ex);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortExchange(null);
      setSortDir("desc");
    }
  }

  const byExchange = new Map<Exchange, Map<string, FundingRate>>();
  for (const ex of RWA_EXCHANGES) {
    byExchange.set(ex, new Map());
  }
  for (const r of rates) {
    byExchange.get(r.exchange as Exchange)?.set(r.symbol, r);
  }

  const flatSorted = sortExchange
    ? [...RWA_ASSETS].sort((a, b) => {
        const rA = byExchange.get(sortExchange)?.get(getRWASymbol(a, sortExchange))?.rate;
        const rB = byExchange.get(sortExchange)?.get(getRWASymbol(b, sortExchange))?.rate;
        if (rA === undefined && rB === undefined) return 0;
        if (rA === undefined) return 1;
        if (rB === undefined) return -1;
        return sortDir === "desc" ? rB - rA : rA - rB;
      })
    : null;

  const grouped = new Map<RWACategory, typeof RWA_ASSETS>();
  if (!flatSorted) {
    for (const asset of RWA_ASSETS) {
      if (!grouped.has(asset.category)) grouped.set(asset.category, []);
      grouped.get(asset.category)!.push(asset);
    }
  }

  function ExchangeHeaders() {
    return (
      <>
        {RWA_EXCHANGES.map((ex) => {
          const active = sortExchange === ex;
          return (
            <TableHead
              key={ex}
              onClick={() => handleExchangeClick(ex)}
              className={`cursor-pointer select-none transition-colors ${
                active
                  ? "bg-zinc-800/60 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-1 whitespace-nowrap">
                <ExchangeBadge exchange={ex} />
                <span className="text-xs">
                  {active
                    ? <span className="text-zinc-300">{sortDir === "desc" ? "↓" : "↑"}</span>
                    : <span className="text-zinc-400">⇅</span>
                  }
                </span>
              </div>
            </TableHead>
          );
        })}
      </>
    );
  }

  function AssetRow({
    asset,
    showCategoryChip,
  }: {
    asset: (typeof RWA_ASSETS)[0];
    showCategoryChip: boolean;
  }) {
    return (
      <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
        <TableCell>
          <div className="flex items-start gap-2">
            <div>
              <div className="font-bold text-white text-sm">{asset.name}</div>
              <div className="text-xs text-zinc-500 font-mono">{asset.symbol}</div>
            </div>
            {showCategoryChip && (
              <span
                className={`shrink-0 mt-0.5 text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_CHIP[asset.category]}`}
              >
                {CATEGORY_LABEL[asset.category]}
              </span>
            )}
          </div>
        </TableCell>
        {RWA_EXCHANGES.map((ex) => {
          const sym = getRWASymbol(asset, ex);
          const r = byExchange.get(ex)?.get(sym);
          const active = sortExchange === ex;
          return (
            <TableCell key={ex} className={active ? "bg-zinc-800/30" : ""}>
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
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-xl font-bold">RWA 專區</h1>
          {clientLoading && (
            <span className="text-xs text-zinc-600 animate-pulse">
              Binance · Bybit 載入中...
            </span>
          )}
          {sortExchange && (
            <span className="text-xs text-zinc-500">
              依{" "}
              <span className="text-zinc-300 font-medium">{sortExchange}</span>{" "}
              {sortDir === "desc" ? "費率高→低" : "費率低→高"} · 再點一次還原分組
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 mb-3">
          追蹤傳統金融資產永續合約（股票、ETF、大宗商品）的資金費率。點擊交易所欄位排序。
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
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

      {flatSorted ? (
        <div className="rounded-lg border border-zinc-800 overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 w-44">資產</TableHead>
                <ExchangeHeaders />
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatSorted.map((asset) => (
                <AssetRow key={asset.symbol} asset={asset} showCategoryChip />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        (["commodity", "etf", "stock", "forex"] as RWACategory[]).map((cat) => {
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
                      <TableHead className="text-zinc-400 w-44">資產</TableHead>
                      <ExchangeHeaders />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <AssetRow key={asset.symbol} asset={asset} showCategoryChip={false} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
