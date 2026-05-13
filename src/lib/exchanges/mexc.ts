import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://contract.mexc.com";

export async function getMexcFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(`${BASE}/api/v1/contract/ticker`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`MEXC API error: ${res.status}`);

  const json: {
    data?: Array<{
      symbol: string;
      fundingRate: number;
      nextSettleTime: number;
    }>;
  } = await res.json();

  return (json.data ?? [])
    .filter((d) => d.symbol.endsWith("_USDT") && d.fundingRate !== undefined)
    .map((d) => {
      const rate = d.fundingRate;
      return {
        symbol: d.symbol.replace("_USDT", ""),
        exchange: "mexc" as const,
        rate,
        nextFundingTime: d.nextSettleTime,
        annualizedRate: rate * 3 * 365,
      };
    });
}

export async function getMexcHistory(
  symbol: string,
  pageNum = 1,
  pageSize = 100
): Promise<Array<{ rate: number; fundingTime: number }>> {
  const res = await fetch(
    `${BASE}/api/v1/contract/funding_rate/history?symbol=${symbol}_USDT&page_num=${pageNum}&page_size=${pageSize}`
  );
  if (!res.ok) throw new Error(`MEXC history error: ${res.status}`);

  const json: {
    data?: { resultList?: Array<{ fundingRate: number; settleTime: number }> };
  } = await res.json();

  return (json.data?.resultList ?? []).map((d) => ({
    rate: d.fundingRate,
    fundingTime: d.settleTime,
  }));
}
