import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://api-futures.kucoin.com";

export async function getKucoinFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(`${BASE}/api/v1/contracts/active`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`KuCoin API error: ${res.status}`);

  const json: {
    data?: Array<{
      symbol: string;
      fundingFeeRate: number;
      nextFundingRateTime: number;
      quoteCurrency: string;
    }>;
  } = await res.json();

  return (json.data ?? [])
    .filter((d) => d.quoteCurrency === "USDT" && d.fundingFeeRate !== undefined)
    .map((d) => {
      const rate = d.fundingFeeRate;
      // KuCoin symbol 格式：XBTUSDTM → BTC，一般為 XXXUSDTM
      const symbol = d.symbol.replace("USDTM", "").replace("XBT", "BTC");
      return {
        symbol,
        exchange: "kucoin" as const,
        rate,
        nextFundingTime: Date.now() + d.nextFundingRateTime,
        annualizedRate: rate * 3 * 365,
      };
    });
}

// KuCoin 符號轉換：BTC → XBTUSDTM，其他 → XXXUSDTM
function toKucoinSymbol(symbol: string): string {
  return symbol === "BTC" ? "XBTUSDTM" : `${symbol}USDTM`;
}

export async function getKucoinHistory(
  symbol: string,
  fromMs: number,
  toMs: number
): Promise<Array<{ rate: number; fundingTime: number }>> {
  const res = await fetch(
    `${BASE}/api/v1/funding-history?symbol=${toKucoinSymbol(symbol)}&from=${fromMs}&to=${toMs}&reverse=true&maxCount=1000`
  );
  if (!res.ok) throw new Error(`KuCoin history error: ${res.status}`);

  const json: {
    data?: { dataList?: Array<{ fundingRate: string; timepoint: number }> };
  } = await res.json();

  return (json.data?.dataList ?? []).map((d) => ({
    rate: parseFloat(d.fundingRate),
    fundingTime: d.timepoint,
  }));
}
