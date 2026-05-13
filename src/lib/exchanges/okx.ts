import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://www.okx.com";
const CONCURRENCY = 50;

function next8HourBoundary(): number {
  const now = Date.now();
  const interval = 8 * 3_600_000;
  return now + (interval - (now % interval));
}

async function getOkxInstruments(): Promise<string[]> {
  const res = await fetchWithTimeout(`${BASE}/api/v5/public/instruments?instType=SWAP`, {
    next: { revalidate: 3600 },
  }, 5000);
  if (!res.ok) throw new Error(`OKX instruments error: ${res.status}`);
  const json: { data: Array<{ instId: string }> } = await res.json();
  return json.data
    .map((d) => d.instId)
    .filter((id) => id.endsWith("-USDT-SWAP"));
}

async function fetchRate(
  instId: string
): Promise<FundingRate | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}/api/v5/public/funding-rate?instId=${instId}`, {}, 5000);
    if (!res.ok) return null;
    const json: {
      data: Array<{
        fundingRate: string;
        fundingTime: string;
      }>;
    } = await res.json();
    const d = json.data?.[0];
    if (!d) return null;
    const rate = parseFloat(d.fundingRate);
    return {
      symbol: instId.replace("-USDT-SWAP", ""),
      exchange: "okx",
      rate,
      nextFundingTime: parseInt(d.fundingTime) || next8HourBoundary(),
      annualizedRate: rate * 3 * 365,
    };
  } catch {
    return null;
  }
}

export async function getOkxFundingRates(): Promise<FundingRate[]> {
  const instIds = await getOkxInstruments();

  // 所有批次並行，避免序列累加延遲
  const batches: string[][] = [];
  for (let i = 0; i < instIds.length; i += CONCURRENCY) {
    batches.push(instIds.slice(i, i + CONCURRENCY));
  }
  const allResults = await Promise.all(
    batches.map((batch) => Promise.all(batch.map(fetchRate)))
  );
  return allResults.flat().filter((r): r is FundingRate => r !== null);
}

export async function getOkxHistory(
  symbol: string,
  limit = 100
): Promise<Array<{ rate: number; fundingTime: number }>> {
  const instId = `${symbol}-USDT-SWAP`;
  const res = await fetch(
    `${BASE}/api/v5/public/funding-rate-history?instId=${instId}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`OKX history error: ${res.status}`);
  const json: {
    data: Array<{ fundingRate: string; fundingTime: string }>;
  } = await res.json();
  return json.data.map((d) => ({
    rate: parseFloat(d.fundingRate),
    fundingTime: parseInt(d.fundingTime),
  }));
}
