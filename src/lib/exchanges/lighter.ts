// Lighter API docs: https://apidocs.lighter.xyz/docs/get-started
// Base URL: https://mainnet.zklighter.elliot.ai
// Note: CloudFront requires Origin/Referer headers from app.lighter.xyz
import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://mainnet.zklighter.elliot.ai";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "Accept": "application/json, text/plain, */*",
  "Origin": "https://app.lighter.xyz",
  "Referer": "https://app.lighter.xyz/",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
};

interface LighterFundingRate {
  market_id: number;
  exchange: string;
  symbol: string;
  rate: number;
}

export async function getLighterFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(`${BASE}/api/v1/funding-rates`, {
    headers: HEADERS,
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Lighter API error: ${res.status}`);

  const json: { funding_rates: LighterFundingRate[] } = await res.json();

  // 只取 Lighter 自己的費率（其餘是 Binance/Bybit/Hyperliquid 參考費率）
  return json.funding_rates
    .filter((r) => r.exchange === "lighter" && r.symbol && r.rate !== undefined)
    .map((r) => {
      // Lighter's endpoint returns an 8h-equivalent rate, while funding settles hourly.
      const hourlyRate = r.rate / 8;
      return {
        symbol: r.symbol,
        exchange: "lighter" as const,
        rate: hourlyRate,
        nextFundingTime: nextHourBoundary(),
        annualizedRate: hourlyRate * 24 * 365,
      };
    });
}

function nextHourBoundary(): number {
  const now = Date.now();
  return now + (3600_000 - (now % 3600_000));
}
