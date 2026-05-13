import { NextResponse } from "next/server";
import { getBinanceHistory } from "@/lib/exchanges/binance";
import { getOkxHistory } from "@/lib/exchanges/okx";
import { getBybitHistory } from "@/lib/exchanges/bybit";
import { getBitgetHistory } from "@/lib/exchanges/bitget";
import { getTradexyzHistory } from "@/lib/exchanges/tradexyz";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const exchange = searchParams.get("exchange") ?? "binance";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    let data: Array<{ rate: number; fundingTime: number }> = [];

    if (exchange === "binance") data = await getBinanceHistory(symbol, limit);
    else if (exchange === "okx") data = await getOkxHistory(symbol, limit);
    else if (exchange === "bybit") data = await getBybitHistory(symbol, limit);
    else if (exchange === "bitget") data = await getBitgetHistory(symbol, limit);
    else if (exchange === "tradexyz") {
      // 每小時結算，用 limit 換算 startTime
      const startTime = Date.now() - limit * 3_600_000;
      data = await getTradexyzHistory(symbol, startTime);
    }
    else return NextResponse.json({ error: "unknown exchange" }, { status: 400 });

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
