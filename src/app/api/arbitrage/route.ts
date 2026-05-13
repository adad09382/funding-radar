import { NextResponse } from "next/server";
import { getAllFundingRates } from "@/lib/exchanges";
import type { ArbitrageOpportunity, Exchange, FundingRate } from "@/lib/types";

export const revalidate = 60;

export async function GET() {
  try {
    const rates = await getAllFundingRates();

    // 按 symbol 分組
    const bySymbol = new Map<string, FundingRate[]>();
    for (const r of rates) {
      const list = bySymbol.get(r.symbol) ?? [];
      list.push(r);
      bySymbol.set(r.symbol, list);
    }

    const opportunities: ArbitrageOpportunity[] = [];

    for (const [symbol, list] of bySymbol) {
      if (list.length < 2) continue;

      // 找最低和最高費率的交易所
      const sorted = [...list].sort((a, b) => a.rate - b.rate);
      const lowest = sorted[0];
      const highest = sorted[sorted.length - 1];

      const rateDiff = highest.rate - lowest.rate;
      if (rateDiff <= 0) continue;

      opportunities.push({
        symbol,
        longExchange: lowest.exchange as Exchange,
        shortExchange: highest.exchange as Exchange,
        longRate: lowest.rate,
        shortRate: highest.rate,
        rateDiff,
        annualizedProfit: rateDiff * 3 * 365,
        longNextFundingTime: lowest.nextFundingTime,
        shortNextFundingTime: highest.nextFundingTime,
      });
    }

    opportunities.sort((a, b) => b.annualizedProfit - a.annualizedProfit);

    return NextResponse.json(opportunities);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
