import { getAllFundingRates } from "@/lib/exchanges";
import { RwaClient } from "./RwaClient";

export const revalidate = 60;

export default async function RwaPage() {
  const rates = await getAllFundingRates();
  return <RwaClient serverRates={rates} />;
}
