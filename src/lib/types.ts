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
  "binance", "okx", "bybit", "bitget", "mexc", "gate", "htx", "kucoin",
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
    symbolOverride: { mexc: "QQQSTOCK", tradexyz: "XYZ100" } },
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
  { name: "Uranium Miners",category: "etf", symbol: "URNM" },
  { name: "Space ETF",     category: "etf", symbol: "SPCX" },
  { name: "Defense Tech",  category: "etf", symbol: "SHLD" },
  { name: "Energy ETF",    category: "etf", symbol: "XLE" },
  { name: "US Oil Fund",   category: "etf", symbol: "USO" },
  { name: "iShares HK",    category: "etf", symbol: "EWH" },
  { name: "iShares Taiwan",category: "etf", symbol: "EWT" },
  { name: "iShares Brazil",category: "etf", symbol: "EWZ" },
  { name: "iShares India", category: "etf", symbol: "INDA" },
  { name: "China Internet",category: "etf", symbol: "KWEB" },
  { name: "Nikkei 225",    category: "etf", symbol: "JP225" },
  { name: "KOSPI 200",     category: "etf", symbol: "KR200" },
  { name: "VIX",           category: "etf", symbol: "VIX" },
  { name: "Bitcoin VIX",   category: "etf", symbol: "BVIX" },
  { name: "Ether VIX",     category: "etf", symbol: "EVIX" },
  // ── 美股 ─────────────────────────────────────────────────────────────
  { name: "Apple",         category: "stock", symbol: "AAPL",
    symbolOverride: { mexc: "AAPLSTOCK" } },
  { name: "Nvidia",        category: "stock", symbol: "NVDA" },
  { name: "Microsoft",     category: "stock", symbol: "MSFT",
    symbolOverride: { mexc: "MSFTSTOCK" } },
  { name: "Alphabet",      category: "stock", symbol: "GOOGL",
    symbolOverride: { mexc: "GOOGLSTOCK", edgex: "GOOG", asterdex: "GOOG" } },
  { name: "Amazon",        category: "stock", symbol: "AMZN",
    symbolOverride: { mexc: "AMZNSTOCK" } },
  { name: "Meta",          category: "stock", symbol: "META",
    symbolOverride: { mexc: "METASTOCK" } },
  { name: "Tesla",         category: "stock", symbol: "TSLA" },
  { name: "AMD",           category: "stock", symbol: "AMD",
    symbolOverride: { mexc: "AMDSTOCK" } },
  { name: "Broadcom",      category: "stock", symbol: "AVGO",
    symbolOverride: { mexc: "AVGOSTOCK" } },
  { name: "Micron",        category: "stock", symbol: "MU",
    symbolOverride: { mexc: "MUSTOCK" } },
  { name: "Intel",         category: "stock", symbol: "INTC",
    symbolOverride: { mexc: "INTCSTOCK" } },
  { name: "Qualcomm",      category: "stock", symbol: "QCOM",
    symbolOverride: { mexc: "QCOMSTOCK" } },
  { name: "Marvell",       category: "stock", symbol: "MRVL",
    symbolOverride: { mexc: "MRVLSTOCK" } },
  { name: "SanDisk",       category: "stock", symbol: "SNDK",
    symbolOverride: { mexc: "SNDKSTOCK" } },
  { name: "ASML",          category: "stock", symbol: "ASML",
    symbolOverride: { mexc: "ASMLSTOCK" } },
  { name: "TSMC",          category: "stock", symbol: "TSM",
    symbolOverride: { mexc: "TSMSTOCK" } },
  { name: "KLA Corp",      category: "stock", symbol: "KLAC",
    symbolOverride: { mexc: "KLACSTOCK" } },
  { name: "Lam Research",  category: "stock", symbol: "LRCX",
    symbolOverride: { mexc: "LRCXSTOCK" } },
  { name: "Texas Instruments", category: "stock", symbol: "TXN",
    symbolOverride: { mexc: "TXNSTOCK" } },
  { name: "Applied Materials", category: "stock", symbol: "AMAT",
    symbolOverride: { mexc: "AMATSTOCK" } },
  { name: "Corning",       category: "stock", symbol: "GLW",
    symbolOverride: { mexc: "GLWSTOCK" } },
  { name: "Coherent",      category: "stock", symbol: "COHR",
    symbolOverride: { mexc: "COHRSTOCK" } },
  { name: "Western Digital", category: "stock", symbol: "WDC",
    symbolOverride: { mexc: "WDCSTOCK" } },
  { name: "Seagate",       category: "stock", symbol: "STX",
    symbolOverride: { mexc: "STXSTOCK" } },
  { name: "Super Micro",   category: "stock", symbol: "SMCI",
    symbolOverride: { mexc: "SMCISTOCK" } },
  { name: "Alibaba",       category: "stock", symbol: "BABA",
    symbolOverride: { mexc: "BABASTOCK" } },
  { name: "JD.com",        category: "stock", symbol: "JD",
    symbolOverride: { mexc: "JDSTOCK" } },
  { name: "Futu Holdings", category: "stock", symbol: "FUTU",
    symbolOverride: { mexc: "FUTUSTOCK" } },
  { name: "PayPal",        category: "stock", symbol: "PAYP",
    symbolOverride: { mexc: "PAYPSTOCK" } },
  { name: "Visa",          category: "stock", symbol: "V",
    symbolOverride: { mexc: "VSTOCK" } },
  { name: "Mastercard",    category: "stock", symbol: "MA",
    symbolOverride: { mexc: "MASTOCK" } },
  { name: "JPMorgan",      category: "stock", symbol: "JPM",
    symbolOverride: { mexc: "JPMSTOCK" } },
  { name: "Bank of America", category: "stock", symbol: "BAC",
    symbolOverride: { mexc: "BACSTOCK" } },
  { name: "Wells Fargo",   category: "stock", symbol: "WFC",
    symbolOverride: { mexc: "WFCSTOCK" } },
  { name: "Citigroup",     category: "stock", symbol: "C",
    symbolOverride: { mexc: "CSTOCK" } },
  { name: "MicroStrategy", category: "stock", symbol: "MSTR",
    symbolOverride: { mexc: "MSTRSTOCK" } },
  { name: "Coinbase",      category: "stock", symbol: "COIN" },
  { name: "Palantir",      category: "stock", symbol: "PLTR",
    symbolOverride: { mexc: "PLTRSTOCK" } },
  { name: "Robinhood",     category: "stock", symbol: "HOOD" },
  { name: "Circle",        category: "stock", symbol: "CRCL",
    symbolOverride: { mexc: "CRCLSTOCK" } },
  { name: "USA Rare Earth",category: "stock", symbol: "USAR",
    symbolOverride: { mexc: "USARSTOCK" } },
  { name: "Netflix",       category: "stock", symbol: "NFLX",
    symbolOverride: { mexc: "NFLXSTOCK" } },
  { name: "Oracle",        category: "stock", symbol: "ORCL",
    symbolOverride: { mexc: "ORCLSTOCK" } },
  { name: "Adobe",         category: "stock", symbol: "ADBE",
    symbolOverride: { mexc: "ADBESTOCK" } },
  { name: "Salesforce",    category: "stock", symbol: "CRM",
    symbolOverride: { mexc: "CRMSTOCK" } },
  { name: "ServiceNow",    category: "stock", symbol: "NOW",
    symbolOverride: { mexc: "NOWSTOCK" } },
  { name: "Intuit",        category: "stock", symbol: "INTU",
    symbolOverride: { mexc: "INTUSTOCK" } },
  { name: "Shopify",       category: "stock", symbol: "SHOP",
    symbolOverride: { mexc: "SHOPSTOCK" } },
  { name: "Spotify",       category: "stock", symbol: "SPOT",
    symbolOverride: { mexc: "SPOTSTOCK" } },
  { name: "Snowflake",     category: "stock", symbol: "SNOW",
    symbolOverride: { mexc: "SNOWSTOCK" } },
  { name: "CrowdStrike",   category: "stock", symbol: "CRWD",
    symbolOverride: { mexc: "CRWDSTOCK" } },
  { name: "Palo Alto Networks", category: "stock", symbol: "PANW",
    symbolOverride: { mexc: "PANWSTOCK" } },
  { name: "Uber",          category: "stock", symbol: "UBER",
    symbolOverride: { mexc: "UBERSTOCK" } },
  { name: "CoreWeave",     category: "stock", symbol: "CRWV",
    symbolOverride: { mexc: "CRWVSTOCK" } },
  { name: "Reddit",        category: "stock", symbol: "RDDT",
    symbolOverride: { mexc: "RDDTSTOCK" } },
  { name: "ARM Holdings",  category: "stock", symbol: "ARM",
    symbolOverride: { mexc: "ARMSTOCK" } },
  { name: "Iris Energy",   category: "stock", symbol: "IREN",
    symbolOverride: { mexc: "IRENSTOCK" } },
  { name: "Nebius",        category: "stock", symbol: "NBIS",
    symbolOverride: { mexc: "NBISSTOCK" } },
  { name: "Lumentum",      category: "stock", symbol: "LITE",
    symbolOverride: { mexc: "LITESTOCK" } },
  { name: "DRAM",          category: "stock", symbol: "DRAM" },
  { name: "Vertiv",        category: "stock", symbol: "VRT",
    symbolOverride: { mexc: "VRTSTOCK" } },
  { name: "Hims & Hers",   category: "stock", symbol: "HIMS",
    symbolOverride: { mexc: "HIMSSTOCK" } },
  { name: "GameStop",      category: "stock", symbol: "GME",
    symbolOverride: { mexc: "GMESTOCK" } },
  { name: "SpaceX",        category: "stock", symbol: "SPACEX" },
  { name: "Berkshire B",   category: "stock", symbol: "BRKB",
    symbolOverride: { mexc: "BRKBSTOCK" } },
  { name: "Walmart",       category: "stock", symbol: "WMT",
    symbolOverride: { mexc: "WMTSTOCK" } },
  { name: "Costco",        category: "stock", symbol: "COST",
    symbolOverride: { mexc: "COSTSTOCK" } },
  { name: "Home Depot",    category: "stock", symbol: "HD",
    symbolOverride: { mexc: "HDSTOCK" } },
  { name: "McDonald's",    category: "stock", symbol: "MCD",
    symbolOverride: { mexc: "MCDSTOCK" } },
  { name: "Starbucks",     category: "stock", symbol: "SBUX",
    symbolOverride: { mexc: "SBUXSTOCK" } },
  { name: "Nike",          category: "stock", symbol: "NKE",
    symbolOverride: { mexc: "NKESTOCK" } },
  { name: "Procter & Gamble", category: "stock", symbol: "PG",
    symbolOverride: { mexc: "PGSTOCK" } },
  { name: "Coca-Cola",     category: "stock", symbol: "KO",
    symbolOverride: { mexc: "KOSTOCK" } },
  { name: "Disney",        category: "stock", symbol: "DIS",
    symbolOverride: { mexc: "DISSTOCK" } },
  { name: "ExxonMobil",    category: "stock", symbol: "XOM",
    symbolOverride: { mexc: "XOMSTOCK" } },
  { name: "Chevron",       category: "stock", symbol: "CVX",
    symbolOverride: { mexc: "CVXSTOCK" } },
  { name: "ConocoPhillips", category: "stock", symbol: "COP",
    symbolOverride: { mexc: "COPSTOCK" } },
  { name: "Occidental",    category: "stock", symbol: "OXY",
    symbolOverride: { mexc: "OXYSTOCK" } },
  { name: "Boeing",        category: "stock", symbol: "BA",
    symbolOverride: { mexc: "BASTOCK" } },
  { name: "Lockheed Martin", category: "stock", symbol: "LMT",
    symbolOverride: { mexc: "LMTSTOCK" } },
  { name: "Raytheon",      category: "stock", symbol: "RTX",
    symbolOverride: { mexc: "RTXSTOCK" } },
  { name: "General Electric", category: "stock", symbol: "GE",
    symbolOverride: { mexc: "GESTOCK" } },
  { name: "GE Vernova",    category: "stock", symbol: "GEV",
    symbolOverride: { mexc: "GEVSTOCK" } },
  { name: "Fluence Energy", category: "stock", symbol: "FLNC",
    symbolOverride: { mexc: "FLNCSTOCK" } },
  { name: "UnitedHealth",  category: "stock", symbol: "UNH",
    symbolOverride: { mexc: "UNHSTOCK" } },
  { name: "Eli Lilly",     category: "stock", symbol: "LLY",
    symbolOverride: { mexc: "LLYSTOCK" } },
  { name: "AbbVie",        category: "stock", symbol: "ABBV",
    symbolOverride: { mexc: "ABBVSTOCK" } },
  { name: "Cisco",         category: "stock", symbol: "CSCO",
    symbolOverride: { mexc: "CSCOSTOCK" } },
  { name: "IBM",           category: "stock", symbol: "IBM",
    symbolOverride: { mexc: "IBMSTOCK" } },
  { name: "Verizon",       category: "stock", symbol: "VZ",
    symbolOverride: { mexc: "VZSTOCK" } },
  { name: "Carvana",       category: "stock", symbol: "CVNA",
    symbolOverride: { mexc: "CVNASTOCK" } },
  // ── AI / 量子 / 新科技 ──────────────────────────────────────────────
  { name: "Applovin",      category: "stock", symbol: "APP",
    symbolOverride: { mexc: "APPSTOCK" } },
  { name: "Cerebras",      category: "stock", symbol: "CBRS" },
  { name: "Infleqtion",    category: "stock", symbol: "INFQ",
    symbolOverride: { mexc: "INFQSTOCK" } },
  { name: "IonQ",          category: "stock", symbol: "IONQ",
    symbolOverride: { mexc: "IONQSTOCK" } },
  { name: "Anthropic",     category: "stock", symbol: "ANTHROPIC" },
  { name: "OpenAI",        category: "stock", symbol: "OPENAI" },
  // ── 新能源 / 國防 / 航太 ─────────────────────────────────────────────
  { name: "Bloom Energy",  category: "stock", symbol: "BE" },
  { name: "Oklo",          category: "stock", symbol: "OKLO",
    symbolOverride: { mexc: "OKLOSTOCK" } },
  { name: "MP Materials",  category: "stock", symbol: "MP" },
  { name: "AST SpaceMobile", category: "stock", symbol: "ASTS",
    symbolOverride: { mexc: "ASTSSTOCK" } },
  { name: "Rocket Lab",    category: "stock", symbol: "RKLB",
    symbolOverride: { mexc: "RKLBSTOCK" } },
  { name: "Rivian",        category: "stock", symbol: "RIVN" },
  { name: "Fly Leasing",   category: "stock", symbol: "FLY" },
  // ── 電商 / 消費 ──────────────────────────────────────────────────────
  { name: "eBay",          category: "stock", symbol: "EBAY" },
  { name: "DraftKings",    category: "stock", symbol: "DKNG" },
  { name: "Zoom",          category: "stock", symbol: "ZM" },
  { name: "AllBirds/NewBird AI", category: "stock", symbol: "BIRD" },
  { name: "NIO",           category: "stock", symbol: "NIO" },
  // ── 金融 ─────────────────────────────────────────────────────────────
  { name: "Blackstone",    category: "stock", symbol: "BX" },
  // ── 半導體 / 光電（小型）────────────────────────────────────────────
  { name: "Applied Digital", category: "stock", symbol: "APLD",
    symbolOverride: { mexc: "APLDSTOCK" } },
  { name: "Credo Technology", category: "stock", symbol: "CRDO",
    symbolOverride: { mexc: "CRDOSTOCK" } },
  { name: "Applied Opto",  category: "stock", symbol: "AAOI" },
  { name: "AXT Inc",       category: "stock", symbol: "AXTI" },
  { name: "Kopin",         category: "stock", symbol: "KOPN" },
  { name: "Lightwave Logic", category: "stock", symbol: "LWLG" },
  { name: "Eaton",         category: "stock", symbol: "ETN",
    symbolOverride: { mexc: "ETNSTOCK" } },
  // ── 加密企業股 ───────────────────────────────────────────────────────
  { name: "Bitmine (ETH)", category: "stock", symbol: "BMNR" },
  { name: "Hyperliquid Strategies", category: "stock", symbol: "PURR",
    symbolOverride: { tradexyz: "PURRDAT" } },
  // ── 亞股 ─────────────────────────────────────────────────────────────
  { name: "Meituan",       category: "stock", symbol: "MEITUAN" },
  { name: "Tencent",       category: "stock", symbol: "TENCENT" },
  { name: "PDD",           category: "stock", symbol: "PDD",
    symbolOverride: { mexc: "PDDSTOCK" } },
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
