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
