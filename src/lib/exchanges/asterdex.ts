import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://fapi.asterdex.com";

export async function getAsterDexFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(`${BASE}/fapi/v1/premiumIndex`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`AsterDEX API error: ${res.status}`);

  const data: Array<{
    symbol: string;
    lastFundingRate: string;
    nextFundingTime: number;
  }> = await res.json();

  return data
    .filter((d) => d.symbol.endsWith("USDT") && d.lastFundingRate)
    .map((d) => {
      const rate = parseFloat(d.lastFundingRate);
      return {
        symbol: d.symbol.replace("USDT", ""),
        exchange: "asterdex" as const,
        rate,
        nextFundingTime: d.nextFundingTime,
        annualizedRate: rate * 3 * 365,
      };
    });
}

export async function getAsterDexHistory(
  symbol: string,
  limit = 100
): Promise<Array<{ rate: number; fundingTime: number }>> {
  const res = await fetch(
    `${BASE}/fapi/v1/fundingRate?symbol=${symbol}USDT&limit=${limit}`
  );
  if (!res.ok) throw new Error(`AsterDEX history error: ${res.status}`);

  const data: Array<{ fundingRate: string; fundingTime: number }> =
    await res.json();

  return data.map((d) => ({
    rate: parseFloat(d.fundingRate),
    fundingTime: d.fundingTime,
  }));
}
