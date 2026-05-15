export type Exchange =
  | "binance" | "okx" | "bybit" | "bitget"
  | "mexc" | "gate" | "htx" | "kucoin"
  | "hyperliquid" | "asterdex" | "lighter" | "edgex" | "tradexyz";

export type ExchangeType = "cex" | "dex";

export const EXCHANGE_META: Record<Exchange, { label: string; type: ExchangeType; fundingInterval: number }> = {
  // CEX
  binance:     { label: "Binance",     type: "cex", fundingInterval: 8 },
  okx:         { label: "OKX",         type: "cex", fundingInterval: 8 },
  bybit:       { label: "Bybit",       type: "cex", fundingInterval: 8 },
  bitget:      { label: "Bitget",      type: "cex", fundingInterval: 8 },
  mexc:        { label: "MEXC",        type: "cex", fundingInterval: 8 },
  gate:        { label: "Gate.io",     type: "cex", fundingInterval: 8 },
  htx:         { label: "HTX",         type: "cex", fundingInterval: 8 },
  kucoin:      { label: "KuCoin",      type: "cex", fundingInterval: 8 },
  // DEX
  hyperliquid: { label: "Hyperliquid", type: "dex", fundingInterval: 1 },
  asterdex:    { label: "AsterDEX",    type: "dex", fundingInterval: 8 },
  lighter:     { label: "Lighter",     type: "dex", fundingInterval: 1 },
  edgex:       { label: "EdgeX",       type: "dex", fundingInterval: 4 },
  tradexyz:    { label: "Trade[XYZ]", type: "dex", fundingInterval: 1 },
};

export const CEX_EXCHANGES = Object.entries(EXCHANGE_META)
  .filter(([, m]) => m.type === "cex")
  .map(([k]) => k as Exchange);

export const DEX_EXCHANGES = Object.entries(EXCHANGE_META)
  .filter(([, m]) => m.type === "dex")
  .map(([k]) => k as Exchange);

export interface FundingRate {
  symbol: string;
  exchange: Exchange;
  rate: number;
  nextFundingTime: number;
  annualizedRate: number;
  recordedAt?: number;
}

export interface ArbitrageOpportunity {
  symbol: string;
  longExchange: Exchange;
  shortExchange: Exchange;
  longRate: number;
  shortRate: number;
  rateDiff: number;
  annualizedProfit: number;
  longNextFundingTime: number;
  shortNextFundingTime: number;
}

export interface StableRateAsset {
  symbol: string;
  exchange: Exchange;
  avgRate30d: number;
  avgRate90d: number;
  positiveRatio30d: number;
  direction: "positive" | "negative" | "neutral";
  sampleCount: number;
}

export interface StableAsset {
  symbol: string;
  exchange: string;
  heatmap: number[];
  consecutiveDays: number;
  consistency: number;
  annMean: number;
  annMedian: number;
  annWorst: number;
  annCurrent: number;
  cnt: number;
}

export interface FundingRateRecord {
  id?: number;
  symbol: string;
  exchange: Exchange;
  rate: number;
  next_funding_time: number;
  recorded_at: number;
}

export type RWACategory = "stock" | "etf" | "commodity" | "forex";

export interface RWAAsset {
  name: string;
  category: RWACategory;
  symbol: string;
  // 只在 symbol 與預設不同時才填
  symbolOverride?: Partial<Record<Exchange, string>>;
}

export function getRWASymbol(asset: RWAAsset, exchange: Exchange): string {
  return asset.symbolOverride?.[exchange] ?? asset.symbol;
}

export const RWA_EXCHANGES: Exchange[] = [
  "binance", "okx", "bybit", "bitget", "mexc", "htx", "kucoin",
  "tradexyz", "lighter", "asterdex", "edgex",
];

export const RWA_ASSETS: RWAAsset[] = [
  // ── 大宗商品 ──────────────────────────────────────────────────────────
  { name: "Gold",          category: "commodity", symbol: "XAU",
    symbolOverride: { edgex: "IAU", tradexyz: "GOLD" } },
  { name: "Silver",        category: "commodity", symbol: "XAG",
    symbolOverride: { edgex: "SLV", tradexyz: "SILVER" } },
  { name: "Platinum",      category: "commodity", symbol: "XPT",
    symbolOverride: { tradexyz: "PLATINUM" } },
  { name: "Palladium",     category: "commodity", symbol: "XPD",
    symbolOverride: { tradexyz: "PALLADIUM" } },
  { name: "Copper",        category: "commodity", symbol: "COPPER",
    symbolOverride: { okx: "XCU", asterdex: "XCU", lighter: "XCU" } },
  { name: "WTI Crude Oil", category: "commodity", symbol: "CL",
    symbolOverride: { lighter: "WTI" } },
  { name: "Brent Crude",   category: "commodity", symbol: "BZ",
    symbolOverride: { lighter: "BRENTOIL", tradexyz: "BRENTOIL" } },
  { name: "Natural Gas",   category: "commodity", symbol: "NATGAS",
    symbolOverride: { okx: "NG" } },
  { name: "Wheat",         category: "commodity", symbol: "WHEAT" },
  // ── ETF ──────────────────────────────────────────────────────────────
  { name: "Nasdaq 100",    category: "etf", symbol: "QQQ",
    symbolOverride: { tradexyz: "XYZ100" } },
  { name: "S&P 500",       category: "etf", symbol: "SPY",
    symbolOverride: { tradexyz: "SP500" } },
  { name: "Nasdaq 3x",     category: "etf", symbol: "TQQQ" },
  { name: "Nasdaq -3x",    category: "etf", symbol: "SQQQ" },
  { name: "SOX 3x",        category: "etf", symbol: "SOXL" },
  { name: "SOX -3x",       category: "etf", symbol: "SOXS" },
  { name: "SOX (1x)",      category: "etf", symbol: "SOXX" },
  { name: "iShares Japan", category: "etf", symbol: "EWJ" },
  { name: "iShares Korea", category: "etf", symbol: "EWY" },
  { name: "Russell 2000",  category: "etf", symbol: "IWM" },
  { name: "Mag 7",         category: "etf", symbol: "MAGS" },
  { name: "Robotics ETF",  category: "etf", symbol: "BOTZ" },
  { name: "Uranium ETF",   category: "etf", symbol: "URA" },
  // ── 美股 ─────────────────────────────────────────────────────────────
  { name: "Apple",         category: "stock", symbol: "AAPL" },
  { name: "Nvidia",        category: "stock", symbol: "NVDA" },
  { name: "Microsoft",     category: "stock", symbol: "MSFT" },
  { name: "Alphabet",      category: "stock", symbol: "GOOGL",
    symbolOverride: { edgex: "GOOG", asterdex: "GOOG" } },
  { name: "Amazon",        category: "stock", symbol: "AMZN" },
  { name: "Meta",          category: "stock", symbol: "META" },
  { name: "Tesla",         category: "stock", symbol: "TSLA" },
  { name: "AMD",           category: "stock", symbol: "AMD" },
  { name: "Broadcom",      category: "stock", symbol: "AVGO" },
  { name: "Micron",        category: "stock", symbol: "MU" },
  { name: "Intel",         category: "stock", symbol: "INTC" },
  { name: "Qualcomm",      category: "stock", symbol: "QCOM" },
  { name: "Marvell",       category: "stock", symbol: "MRVL" },
  { name: "SanDisk",       category: "stock", symbol: "SNDK" },
  { name: "ASML",          category: "stock", symbol: "ASML" },
  { name: "TSMC",          category: "stock", symbol: "TSM" },
  { name: "Alibaba",       category: "stock", symbol: "BABA" },
  { name: "PayPal",        category: "stock", symbol: "PAYP" },
  { name: "MicroStrategy", category: "stock", symbol: "MSTR" },
  { name: "Coinbase",      category: "stock", symbol: "COIN" },
  { name: "Palantir",      category: "stock", symbol: "PLTR" },
  { name: "Robinhood",     category: "stock", symbol: "HOOD" },
  { name: "Circle",        category: "stock", symbol: "CRCL" },
  { name: "USA Rare Earth",category: "stock", symbol: "USAR" },
  { name: "Netflix",       category: "stock", symbol: "NFLX" },
  { name: "Oracle",        category: "stock", symbol: "ORCL" },
  { name: "ARM Holdings",  category: "stock", symbol: "ARM" },
  { name: "GameStop",      category: "stock", symbol: "GME" },
  { name: "SpaceX",        category: "stock", symbol: "SPACEX" },
  { name: "Berkshire B",   category: "stock", symbol: "BRKB" },
  // ── 亞股 ─────────────────────────────────────────────────────────────
  { name: "Meituan",       category: "stock", symbol: "MEITUAN" },
  { name: "Tencent",       category: "stock", symbol: "TENCENT" },
  { name: "PDD",           category: "stock", symbol: "PDD" },
  { name: "Pop Mart",      category: "stock", symbol: "POPMART" },
  { name: "Samsung",       category: "stock", symbol: "SAMSUNG",
    symbolOverride: { lighter: "SAMSUNGUSD", tradexyz: "SMSN" } },
  { name: "Hyundai",       category: "stock", symbol: "HYUNDAI",
    symbolOverride: { lighter: "HYUNDAIUSD" } },
  { name: "SK Hynix",      category: "stock", symbol: "SKHYNIX",
    symbolOverride: { lighter: "SKHYNIXUSD", tradexyz: "SKHX" } },
  // ── 外匯 ─────────────────────────────────────────────────────────────
  { name: "EUR/USD",       category: "forex", symbol: "EUR",
    symbolOverride: { lighter: "EURUSD" } },
  { name: "GBP/USD",       category: "forex", symbol: "GBP",
    symbolOverride: { lighter: "GBPUSD" } },
  { name: "AUD/USD",       category: "forex", symbol: "AUD",
    symbolOverride: { lighter: "AUDUSD" } },
  { name: "USD/JPY",       category: "forex", symbol: "USDJPY",
    symbolOverride: { lighter: "USDJPY", tradexyz: "JPY" } },
];
