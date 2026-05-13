import type { FundingRate } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetch";

const BASE = "https://pro.edgex.exchange";
const HEADERS = { "User-Agent": "Mozilla/5.0" };
const BATCH_SIZE = 50;

interface EdgeXContract {
  contractId: string;
  contractName: string;
  enableTrade: boolean;
  enableDisplay: boolean;
}

interface EdgeXFundingRate {
  contractId: string;
  fundingRate: string;
  fundingTime: string;
  fundingTimestamp: string;
  fundingRateIntervalMin: string;
}

export async function getEdgeXFundingRates(): Promise<FundingRate[]> {
  // 取合約清單
  const metaRes = await fetchWithTimeout(`${BASE}/api/v1/public/meta/getMetaData`, {
    headers: HEADERS,
    next: { revalidate: 3600 },
  }, 5000);
  if (!metaRes.ok) throw new Error(`EdgeX meta error: ${metaRes.status}`);

  const meta: { data: { contractList: EdgeXContract[] } } = await metaRes.json();
  const contracts = meta.data.contractList.filter(
    (c) => c.enableTrade && c.enableDisplay
  );
  const idToName = new Map(contracts.map((c) => [c.contractId, c.contractName]));
  const ids = contracts.map((c) => c.contractId);

  // 所有批次並行
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    batches.push(ids.slice(i, i + BATCH_SIZE));
  }
  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const params = batch.map((id) => `contractId=${id}`).join("&");
      const res = await fetchWithTimeout(
        `${BASE}/api/v1/public/funding/getLatestFundingRate?${params}`,
        { headers: HEADERS, next: { revalidate: 60 } },
        5000
      );
      if (!res.ok) return [];
      const json: { data: EdgeXFundingRate[] } = await res.json();
      return json.data ?? [];
    })
  );
  const allRates: EdgeXFundingRate[] = batchResults.flat();

  return allRates.map((r) => {
    const rate = parseFloat(r.fundingRate);
    const contractName = idToName.get(r.contractId) ?? r.contractId;
    // contractName 格式：BTCUSD → BTC
    const symbol = contractName.replace(/USD$/, "");
    return {
      symbol,
      exchange: "edgex" as const,
      rate,
      // fundingTime = 上次結算，加上週期推算下次
      nextFundingTime: parseInt(r.fundingTime) + parseInt(r.fundingRateIntervalMin) * 60_000,
      // 4 小時結算，一天 6 次
      annualizedRate: rate * 6 * 365,
    };
  });
}
