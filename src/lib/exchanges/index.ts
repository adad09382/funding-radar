import { getBinanceFundingRates } from "./binance";
import { getOkxFundingRates } from "./okx";
import { getBybitFundingRates } from "./bybit";
import { getBitgetFundingRates } from "./bitget";
import { getMexcFundingRates } from "./mexc";
import { getGateFundingRates } from "./gate";
import { getHtxFundingRates } from "./htx";
import { getKucoinFundingRates } from "./kucoin";
import { getHyperliquidFundingRates } from "./hyperliquid";
import { getAsterDexFundingRates } from "./asterdex";
import { getLighterFundingRates } from "./lighter";
import { getEdgeXFundingRates } from "./edgex";
import { getTradexyzFundingRates } from "./tradexyz";
import type { FundingRate } from "@/lib/types";

// Binance and Bybit block cloud provider IPs; they are fetched client-side instead.
export async function getAllFundingRates(): Promise<FundingRate[]> {
  const results = await Promise.allSettled([
    // CEX (Binance + Bybit handled client-side via CORS)
    getOkxFundingRates(),
    getBitgetFundingRates(),
    getMexcFundingRates(),
    getGateFundingRates(),
    getHtxFundingRates(),
    getKucoinFundingRates(),
    // DEX
    getHyperliquidFundingRates(),
    getAsterDexFundingRates(),
    getLighterFundingRates(),
    getEdgeXFundingRates(),
    getTradexyzFundingRates(),
  ]);

  return results.flatMap((r, i) => {
    if (r.status === "rejected") {
      const names = [
        "okx","bitget","mexc","gate","htx","kucoin",
        "hyperliquid","asterdex","lighter","edgex","tradexyz",
      ];
      console.error(`[${names[i]}] fetch failed:`, r.reason);
      return [];
    }
    return r.value;
  });
}

export {
  getBinanceFundingRates, getOkxFundingRates,
  getBybitFundingRates, getBitgetFundingRates,
  getMexcFundingRates, getGateFundingRates,
  getHtxFundingRates, getKucoinFundingRates,
  getHyperliquidFundingRates, getAsterDexFundingRates,
  getLighterFundingRates, getEdgeXFundingRates,
  getTradexyzFundingRates,
};
