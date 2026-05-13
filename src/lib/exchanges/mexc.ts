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
