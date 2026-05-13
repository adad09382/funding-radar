import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://api.hyperliquid.xyz";

export async function getTradexyzFundingRates(): Promise<FundingRate[]> {
  const res = await fetchWithTimeout(`${BASE}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`trade.xyz API error: ${res.status}`);

  const [meta, ctxs]: [
    { universe: Array<{ name: string }> },
    Array<{ funding: string }>
  ] = await res.json();

  const nextHour = nextHourBoundary();
  const results: FundingRate[] = [];
  for (let i = 0; i < meta.universe.length; i++) {
    const rawName = meta.universe[i].name; // e.g. "xyz:TSLA"
    const ctx = ctxs[i];
    if (!ctx?.funding) continue;
    const symbol = rawName.startsWith("xyz:") ? rawName.slice(4) : rawName;
    const rate = parseFloat(ctx.funding);
    results.push({
      symbol,
      exchange: "tradexyz",
      rate,
      nextFundingTime: nextHour,
      annualizedRate: rate * 24 * 365,
    });
  }
  return results;
}

function nextHourBoundary(): number {
  const now = Date.now();
  return now + (3_600_000 - (now % 3_600_000));
}

export async function getTradexyzHistory(
  symbol: string,
  startTime: number
): Promise<Array<{ rate: number; fundingTime: number }>> {
  const res = await fetch(`${BASE}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "fundingHistory",
      coin: `xyz:${symbol}`,
      startTime,
    }),
  });
  if (!res.ok) throw new Error(`trade.xyz history error: ${res.status}`);

  const data: Array<{ coin: string; fundingRate: string; time: number }> =
    await res.json();

  return data.map((d) => ({
    rate: parseFloat(d.fundingRate),
    fundingTime: d.time,
  }));
}
