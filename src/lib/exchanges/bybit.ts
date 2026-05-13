import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://api.bybit.com";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" };

export async function getBybitFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(
    `${BASE}/v5/market/tickers?category=linear`,
    { headers: HEADERS, next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`Bybit API error: ${res.status}`);

  const json: {
    result: {
      list: Array<{
        symbol: string;
        fundingRate: string;
        nextFundingTime: string;
      }>;
    };
  } = await res.json();

  return json.result.list
    .filter((d) => d.symbol.endsWith("USDT") && d.fundingRate)
    .map((d) => {
      const rate = parseFloat(d.fundingRate);
      return {
        symbol: d.symbol.replace("USDT", ""),
        exchange: "bybit",
        rate,
        nextFundingTime: parseInt(d.nextFundingTime),
        annualizedRate: rate * 3 * 365,
      };
    });
}

export async function getBybitHistory(
  symbol: string,
  limit = 100
): Promise<Array<{ rate: number; fundingTime: number }>> {
  const res = await fetch(
    `${BASE}/v5/market/funding/history?category=linear&symbol=${symbol}USDT&limit=${limit}`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Bybit history error: ${res.status}`);

  const json: {
    result: {
      list: Array<{ fundingRate: string; fundingRateTimestamp: string }>;
    };
  } = await res.json();

  return json.result.list.map((d) => ({
    rate: parseFloat(d.fundingRate),
    fundingTime: parseInt(d.fundingRateTimestamp),
  }));
}
