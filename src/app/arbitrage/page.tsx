import { getAllFundingRates } from "@/lib/exchanges";
import { ArbitrageClient } from "./ArbitrageClient";

export const revalidate = 60;

export default async function ArbitragePage() {
  const rates = await getAllFundingRates();
  return <ArbitrageClient serverRates={rates} />;
}
