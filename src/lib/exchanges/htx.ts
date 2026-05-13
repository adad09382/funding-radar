import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://api.hbdm.com";

function next8HourBoundary(): number {
  const now = Date.now();
  const interval = 8 * 3_600_000;
  return now + (interval - (now % interval));
}

export async function getHtxFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(
    `${BASE}/linear-swap-api/v1/swap_batch_funding_rate`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`HTX API error: ${res.status}`);

  const json: {
    data?: Array<{
      contract_code: string;
      funding_rate: string;
      funding_time: string;
    }>;
  } = await res.json();

  return (json.data ?? [])
    .filter((d) => d.contract_code.endsWith("-USDT"))
    .map((d) => {
      const rate = parseFloat(d.funding_rate);
      return {
        symbol: d.contract_code.replace("-USDT", ""),
        exchange: "htx" as const,
        rate,
        nextFundingTime: parseInt(d.funding_time) || next8HourBoundary(),
        annualizedRate: rate * 3 * 365,
      };
    });
}

// HTX 每頁上限 50，需分頁
export async function getHtxHistory(
  symbol: string,
  pageIndex = 1,
  pageSize = 50
): Promise<Array<{ rate: number; fundingTime: number; totalPage: number }>> {
  const res = await fetch(
    `${BASE}/linear-swap-api/v1/swap_historical_funding_rate?contract_code=${symbol}-USDT&page_index=${pageIndex}&page_size=${pageSize}`
  );
  if (!res.ok) throw new Error(`HTX history error: ${res.status}`);

  const json: {
    data?: {
      data: Array<{ funding_rate: string; funding_time: string }>;
      total_page: number;
    };
  } = await res.json();

  return (json.data?.data ?? []).map((d) => ({
    rate: parseFloat(d.funding_rate),
    fundingTime: parseInt(d.funding_time),
    totalPage: json.data?.total_page ?? 1,
  }));
}
