import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://api.bitget.com";

function next8HourBoundary(): number {
  const now = Date.now();
  const interval = 8 * 3_600_000;
  return now + (interval - (now % interval));
}

export async function getBitgetFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(
    `${BASE}/api/v2/mix/market/tickers?productType=USDT-FUTURES`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`Bitget API error: ${res.status}`);

  const json: {
    data: Array<{
      symbol: string;
      fundingRate: string;
      nextFundingTime: string;
    }>;
  } = await res.json();

  return (json.data ?? [])
    .filter((d) => d.symbol.endsWith("USDT") && d.fundingRate)
    .map((d) => {
      const rate = parseFloat(d.fundingRate);
      return {
        symbol: d.symbol.replace("USDT", ""),
        exchange: "bitget",
        rate,
        nextFundingTime: parseInt(d.nextFundingTime) || next8HourBoundary(),
        annualizedRate: rate * 3 * 365,
      };
    });
}

export async function getBitgetHistory(
  symbol: string,
  limit = 100
): Promise<Array<{ rate: number; fundingTime: number }>> {
  const res = await fetch(
    `${BASE}/api/v2/mix/market/history-fund-rate?symbol=${symbol}USDT&productType=USDT-FUTURES&pageSize=${limit}`
  );
  if (!res.ok) throw new Error(`Bitget history error: ${res.status}`);

  const json: {
    data: Array<{ fundingRate: string; fundingTime: string }>;
  } = await res.json();

  return (json.data ?? []).map((d) => ({
    rate: parseFloat(d.fundingRate),
    fundingTime: parseInt(d.fundingTime),
  }));
}
