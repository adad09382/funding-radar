"use client";

import { useState, useEffect } from "react";
import type { ArbitrageOpportunity, Exchange, FundingRate } from "@/lib/types";
import { getBinanceFundingRates } from "@/lib/exchanges/binance";
import { getBybitFundingRates } from "@/lib/exchanges/bybit";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ExchangeBadge } from "@/components/ExchangeBadge";

function buildArbitrageList(rates: FundingRate[]): ArbitrageOpportunity[] {
  const bySymbol = new Map<string, FundingRate[]>();
  for (const r of rates) {
    const list = bySymbol.get(r.symbol) ?? [];
    list.push(r);
    bySymbol.set(r.symbol, list);
  }

  const opportunities: ArbitrageOpportunity[] = [];
  for (const [symbol, list] of bySymbol) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.rate - b.rate);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const rateDiff = highest.rate - lowest.rate;
    if (rateDiff < 0.0001) continue;

    opportunities.push({
      symbol,
      longExchange: lowest.exchange as Exchange,
      shortExchange: highest.exchange as Exchange,
      longRate: lowest.rate,
      shortRate: highest.rate,
      rateDiff,
      annualizedProfit: highest.annualizedRate - lowest.annualizedRate,
      longNextFundingTime: lowest.nextFundingTime,
      shortNextFundingTime: highest.nextFundingTime,
    });
  }

  return opportunities.sort((a, b) => b.annualizedProfit - a.annualizedProfit);
}

export function ArbitrageClient({ serverRates }: { serverRates: FundingRate[] }) {
  const [rates, setRates] = useState<FundingRate[]>(serverRates);
  const [clientLoading, setClientLoading] = useState(true);

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

  const opportunities = buildArbitrageList(rates);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-bold">套利機會排行</h1>
        <span className="text-sm text-zinc-500">
          {opportunities.length} 個機會 · 按年化收益排序
        </span>
        {clientLoading && (
          <span className="text-xs text-zinc-600 animate-pulse">Binance · Bybit 載入中...</span>
        )}
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        做多低費率交易所合約 + 做空高費率交易所合約，賺取費率差。
      </p>

      <div className="rounded-lg border border-zinc-800 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400 w-8">#</TableHead>
              <TableHead className="text-zinc-400">幣種</TableHead>
              <TableHead className="text-zinc-400">做多（低費率）</TableHead>
              <TableHead className="text-zinc-400">做空（高費率）</TableHead>
              <TableHead className="text-zinc-400">費率差 / 次</TableHead>
              <TableHead className="text-zinc-400">預估年化</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.slice(0, 100).map((op, i) => (
              <TableRow key={`${op.symbol}-${i}`} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell className="text-zinc-600 text-sm">{i + 1}</TableCell>
                <TableCell className="font-mono font-bold text-white">{op.symbol}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ExchangeBadge exchange={op.longExchange} />
                    <span className="font-mono text-sm text-zinc-400">
                      {(op.longRate * 100).toFixed(4)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ExchangeBadge exchange={op.shortExchange} />
                    <span className="font-mono text-sm text-zinc-400">
                      {(op.shortRate * 100).toFixed(4)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-purple-400">
                    +{(op.rateDiff * 100).toFixed(4)}%
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`font-mono font-bold ${op.annualizedProfit > 0.1 ? "text-green-400" : "text-zinc-300"}`}>
                    {(op.annualizedProfit * 100).toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
