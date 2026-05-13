import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://api.gateio.ws";

export async function getGateFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(
    `${BASE}/api/v4/futures/usdt/contracts`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`Gate.io API error: ${res.status}`);

  const data: Array<{
    name: string;
    funding_rate: string;
    funding_next_apply: number;
  }> = await res.json();

  return data
    .filter((d) => d.name.endsWith("_USDT") && d.funding_rate)
    .map((d) => {
      const rate = parseFloat(d.funding_rate);
      return {
        symbol: d.name.replace("_USDT", ""),
        exchange: "gate" as const,
        rate,
        nextFundingTime: d.funding_next_apply * 1000,
        annualizedRate: rate * 3 * 365,
      };
    });
}

// Gate.io 歷史 API 時間單位為 Unix 秒
export async function getGateHistory(
  symbol: string,
  fromMs: number,
  toMs: number
): Promise<Array<{ rate: number; fundingTime: number }>> {
  const from = Math.floor(fromMs / 1000);
  const to = Math.floor(toMs / 1000);
  const res = await fetch(
    `${BASE}/api/v4/futures/usdt/funding_rate?contract=${symbol}_USDT&from=${from}&to=${to}&limit=1000`
  );
  if (!res.ok) throw new Error(`Gate history error: ${res.status}`);

  const data: Array<{ r: string; t: number }> = await res.json();
  return data.map((d) => ({
    rate: parseFloat(d.r),
    fundingTime: d.t * 1000,
  }));
}
