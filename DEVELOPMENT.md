# Exchange 資金費率看板 — 開發文件

## 專案概覽

跨交易所加密貨幣資金費率監控看板，整合 8 家 CEX + 5 家 DEX，核心目標：**篩選長期穩定正/負費率標的，支援期現套利策略**。

## 技術架構

```
GitHub Actions（每 8 小時）
  ├─ 首次執行：回填各交易所 180 天歷史結算紀錄
  └─ 增量執行：補上次 funding_time 之後的新結算

Vercel（Next.js 14）
  ├─ 即時資料  → 直接打交易所 API（60s cache）
  ├─ 穩定費率分析 → 查 Turso（180 天真實結算歷史）
  └─ 歷史走勢圖 → 交易所歷史 API（on-demand）
```

| 層級 | 技術 | 免費方案 |
|---|---|---|
| 前端框架 | Next.js 14 + TypeScript + Tailwind | Vercel free |
| UI 元件 | shadcn/ui | — |
| 圖表 | Recharts | — |
| 資料庫 | Turso (LibSQL) | 5GB，無 pause |
| 資料收集 | GitHub Actions cron | Public repo 無限分鐘 |

---

## 資料收集策略

### 核心原則

存的不是「我們採集的時間點快照」，而是**每一次真實發生的費率結算事件**。

| | 舊策略（快照） | 新策略（結算紀錄） |
|---|---|---|
| 資料意義 | cron 跑的當下費率 | 交易所實際結算的費率 |
| 首次執行 | 只有當期 1 筆 | 回填 180 天完整歷史 |
| 增量更新 | 每 8h 快照 1 筆 | 補上次之後的所有新結算 |
| 漏跑補救 | 無法補 | 再跑一次自動補齊 |
| 資料密度 | 3 筆/天（cron 頻率） | 實際結算頻率（Hyperliquid 24 筆/天） |

### 增量更新邏輯

```
每次執行 collect.ts：
  對每個 (exchange, symbol)：
    1. 查 DB 取得該組合最新的 funding_time
    2. 從該時間點向後打歷史 API
    3. INSERT OR IGNORE 寫入（天然去重）
  清理 180 天前資料
```

---

## 交易所整合

### CEX（8 家）

#### 即時費率 API

| 交易所 | 費率週期 | Endpoint | 官方文件 |
|---|---|---|---|
| Binance | 8h | `GET fapi.binance.com/fapi/v1/premiumIndex` | https://binance-docs.github.io/apidocs/futures/en/ |
| OKX | 8h | `GET okx.com/api/v5/public/funding-rate?instId=` | https://www.okx.com/docs-v5/en/ |
| Bybit | 8h | `GET api.bybit.com/v5/market/tickers?category=linear` | https://bybit-exchange.github.io/docs/v5/market/tickers |
| Bitget | 8h | `GET api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES` | https://www.bitget.com/api-doc/contract/market/ |
| MEXC | 8h | `GET contract.mexc.com/api/v1/contract/ticker` | https://mexcdevelop.github.io/apidocs/contract_v1_en/ |
| Gate.io | 8h | `GET api.gateio.ws/api/v4/futures/usdt/contracts` | https://www.gate.io/docs/developers/apiv4/en/ |
| HTX | 8h | `GET api.hbdm.com/linear-swap-api/v1/swap_batch_funding_rate` | https://huobiapi.github.io/docs/usdt_swap/v1/en/ |
| KuCoin | 8h | `GET api-futures.kucoin.com/api/v1/contracts/active` | https://www.kucoin.com/docs-new/rest/futures-trading |

#### 歷史費率 API

| 交易所 | Endpoint | 分頁方式 | 單次上限 | 實作狀態 |
|---|---|---|---|---|
| Binance | `GET /fapi/v1/fundingRate?symbol=&startTime=&endTime=&limit=` | startTime / endTime | 1000 | ✅ 已實作，需加回填邏輯 |
| OKX | `GET /api/v5/public/funding-rate-history?instId=&after=&limit=` | cursor（after = fundingTime ms） | 100 | ✅ 已實作，需加分頁回填 |
| Bybit | `GET /v5/market/funding/history?category=linear&symbol=&startTime=&endTime=&limit=` | startTime / endTime | 200 | ✅ 已實作，需加回填邏輯 |
| Bitget | `GET /api/v2/mix/market/history-fund-rate?symbol=&productType=USDT-FUTURES&pageSize=&pageNo=` | pageNo | 100 | ✅ 已實作，需加分頁回填 |
| MEXC | `GET contract.mexc.com/api/v1/contract/funding_rate/history?symbol=BTC_USDT&page_num=&page_size=` | pageNo | 100 | ❌ 尚未實作 |
| Gate.io | `GET /api/v4/futures/usdt/funding_rate?contract=BTC_USDT&from=&to=&limit=` | from / to（Unix 秒） | 1000 | ❌ 尚未實作 |
| HTX | `GET /linear-swap-api/v1/swap_historical_funding_rate?contract_code=BTC-USDT&page_index=&page_size=` | pageNo | 50 | ❌ 尚未實作 |
| KuCoin | `GET api-futures.kucoin.com/api/v1/funding-history?symbol=XBTUSDTM&from=&to=&reverse=true&maxCount=` | from / to（ms） | 1000 | ❌ 尚未實作 |

**OKX 特殊說明：** 無批次 endpoint，需逐一打每個 instId，50 concurrent 並發（約 5 秒取完 311 個市場）。回填時需特別控制 rate limit。

### DEX（5 家）

#### 即時費率 API

| 交易所 | 費率週期 | Endpoint | 官方文件 |
|---|---|---|---|
| Hyperliquid | 1h | `POST api.hyperliquid.xyz/info` `{"type":"metaAndAssetCtxs"}` | https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api |
| trade.xyz | 1h | `POST api.hyperliquid.xyz/info` `{"type":"metaAndAssetCtxs","dex":"xyz"}` | Hyperliquid fork |
| AsterDEX | 8h | `GET fapi.asterdex.com/fapi/v1/premiumIndex` | https://docs.asterdex.com/ |
| Lighter | 1h | `GET mainnet.zklighter.elliot.ai/api/v1/funding-rates` | https://apidocs.lighter.xyz/docs/get-started |
| EdgeX | 4h | `GET pro.edgex.exchange/api/v1/public/funding/getLatestFundingRate?contractId=` | https://edgex-1.gitbook.io/edgex-documentation/api/public-api/funding-api |

#### 歷史費率 API

| 交易所 | Endpoint | 分頁方式 | 單次上限 | 實作狀態 |
|---|---|---|---|---|
| Hyperliquid | `POST /info` `{"type":"fundingHistory","coin":"BTC","startTime":ms}` | startTime（無上限） | 無限制 | ✅ 已實作 |
| trade.xyz | `POST /info` `{"type":"fundingHistory","coin":"xyz:TSLA","startTime":ms}` | startTime（無上限） | 無限制 | ✅ 已實作 |
| AsterDEX | `GET /fapi/v1/fundingRate?symbol=BTCUSDT&startTime=&endTime=&limit=` | startTime / endTime（Binance fork） | 1000 | ✅ 已實作，需確認 startTime 支援 |
| Lighter | `GET /api/v1/funding-rate-history?market_id=&from=&to=` | from / to（待確認） | 待確認 | ❓ 需實測確認 endpoint |
| EdgeX | `GET /api/v1/public/funding/getFundingRateHistory?contractId=&startTime=&endTime=` | startTime / endTime（待確認） | 待確認 | ❓ 需實測確認 endpoint |

**Lighter 特殊說明：** CloudFront 封鎖無瀏覽器 headers，必須帶 `Origin: https://app.lighter.xyz` + `Referer: https://app.lighter.xyz/`。歷史 endpoint 需同樣帶 headers。

**EdgeX 特殊說明：** 需先打 `/api/v1/public/meta/getMetaData` 取合約清單（帶 User-Agent），合約命名 `BTCUSD`（非 USDT）。

---

## 頁面結構

| 路由 | 說明 | 資料來源 | Cache |
|---|---|---|---|
| `/` | 費率總覽，跨交易所對比表 | 所有交易所即時 API | 60s |
| `/arbitrage` | 套利機會排行，按年化收益排序 | 所有交易所即時 API | 60s |
| `/stable` | 期現套利標的篩選（長期穩定正/負費率） | Turso 歷史結算資料 | 1h |
| `/rwa` | RWA 代幣專區 | 所有交易所即時 API | 60s |
| `/history` | 歷史費率走勢圖（互動式） | 交易所歷史 API | on-demand |

---

## 資料庫 Schema

```sql
CREATE TABLE funding_rates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol       TEXT    NOT NULL,
  exchange     TEXT    NOT NULL,
  rate         REAL    NOT NULL,
  funding_time INTEGER NOT NULL,        -- 實際結算時間（ms）
  UNIQUE (symbol, exchange, funding_time)
);

CREATE INDEX idx_funding_rates_funding_time
ON funding_rates (funding_time DESC);
```

**設計說明：**
- `funding_time` = 交易所實際結算的時間戳，是天然的唯一鍵
- 拿掉 `next_funding_time`（預告時間，無分析價值）
- 拿掉 `recorded_at`（採集時間，非結算時間）
- `INSERT OR IGNORE` 天然去重，重跑或補跑不影響資料正確性
- 保留最近 180 天，每次 GitHub Actions 執行後自動清理

---

## 年化費率計算方式

| 費率週期 | 計算公式 | 適用交易所 |
|---|---|---|
| 8 小時 | `rate × 3 × 365` | Binance, OKX, Bybit, Bitget, MEXC, Gate.io, HTX, KuCoin, AsterDEX |
| 4 小時 | `rate × 6 × 365` | EdgeX |
| 1 小時 | `rate × 24 × 365` | Hyperliquid, Lighter, trade.xyz |

---

## 環境變數

```bash
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

需設定在：
- `.env.local`（本地開發）
- Vercel 環境變數
- GitHub Actions Secrets（`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`）

---

## 部署流程（首次）

### Step 1 — 重新命名資料夾 ✅ 完成

### Step 2 — 建立 Turso DB ✅ 完成

```
DB：funding-radar-wade-lin.aws-us-west-2.turso.io
.env.local 已建立
```

### Step 3 — 推上 GitHub

```bash
git add -A
git commit -m "feat: initial funding rate dashboard"
gh repo create funding-radar --public --source=. --remote=origin --push
```

> 需要 `gh` CLI（`brew install gh` 並 `gh auth login`）。
> 或手動在 GitHub 建 repo 後：
> `git remote add origin https://github.com/adad09382/funding-radar.git && git push -u origin main`

### Step 4 — 設定 GitHub Actions Secrets

```bash
gh secret set TURSO_DATABASE_URL --body "libsql://funding-radar-wade-lin.aws-us-west-2.turso.io"
gh secret set TURSO_AUTH_TOKEN   --body "eyJ..."
```

### Step 5 — 初始化 DB 並回填歷史資料

```bash
npx tsx scripts/init-db.ts    # 建表
npx tsx scripts/backfill.ts   # 回填 180 天歷史結算紀錄（首次執行）
```

### Step 6 — 連接 Vercel

1. 到 vercel.com/new，Import `adad09382/funding-radar`
2. Framework 選 **Next.js**（會自動偵測）
3. 加入兩個環境變數：`TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`
4. Deploy

### Step 7 — 驗收

- [ ] 首頁費率表有資料
- [ ] RWA 專區有資料
- [ ] 套利頁面有資料
- [ ] `/stable` 頁面有歷史資料（回填完成後應立即有資料）
- [ ] GitHub Actions 自動排程確認為啟用狀態

---

## 待完成項目

### 核心：歷史資料收集重構

- [ ] **更新 DB schema**：`funding_time` 取代 `next_funding_time` + `recorded_at`，加 UNIQUE 約束
- [ ] **新增 `scripts/backfill.ts`**：首次回填各交易所 180 天歷史結算紀錄
- [ ] **重構 `scripts/collect.ts`**：改為增量更新（查最新 `funding_time`，補之後的新結算）
- [ ] 補齊尚未實作歷史 API 的 5 家交易所：
  - [ ] MEXC — `GET /api/v1/contract/funding_rate/history`
  - [ ] Gate.io — `GET /api/v4/futures/usdt/funding_rate?from=&to=`
  - [ ] HTX — `GET /linear-swap-api/v1/swap_historical_funding_rate`
  - [ ] KuCoin — `GET /api/v1/funding-history?from=&to=`
  - [ ] AsterDEX — 確認 startTime 支援，補回填邏輯
- [ ] 確認並實作 Lighter、EdgeX 歷史 endpoint（需實測）

### 部署流程

- [x] Step 1：重新命名資料夾為 `funding-radar`
- [x] Step 2：建立 Turso DB，取得 URL + token，建立 `.env.local`
- [ ] Step 3：推上 GitHub（public repo）
- [ ] Step 4：設定 GitHub Actions Secrets
- [ ] Step 5：本地跑 `init-db.ts` + `backfill.ts` 確認正常
- [ ] Step 6：連接 Vercel，設定 env var，部署
- [ ] Step 7：驗收各頁面

### 功能補強

- [ ] `/history` 頁面新增所有 DEX 選項（目前只有 CEX）
- [ ] 首頁費率總覽加 DEX/CEX 分頁 tab 篩選
- [ ] 套利排行加 CEX×CEX / DEX×DEX / CEX×DEX 分類篩選
- [ ] RWA 代幣清單持續更新（目前只有 10 個）
- [ ] `/stable` 頁面加「資料筆數 / 覆蓋天數」說明，讓用戶知道分析深度

### 未來功能

- [ ] **頁面自動更新**：client component 每 5 分鐘 `router.refresh()`
- [ ] **警報系統**：費率超過閾值時發送 Telegram / Email 通知
- [ ] **GRVT 整合**：需要獨立 WebSocket 中繼伺服器（Railway/Fly.io）
- [ ] Ourbit：已確認無公開 API，跳過

---

## 已知問題 / 注意事項

- **OKX 回填成本高**：300+ 個 symbol，每個需多頁請求，需控制 concurrency 避免被 rate limit
- **HTX 歷史 API 效率低**：單次上限 50 筆，symbol 數量多時回填較慢
- **Lighter** 必須帶特定 headers，若 CloudFront 規則變動可能再次失效；歷史 endpoint 待確認
- **EdgeX** 歷史 endpoint 待實測確認；合約命名用 `USD` 後綴（非 `USDT`）
- **Hyperliquid / trade.xyz / Lighter** 費率週期為 1 小時，180 天資料量約為 8h 制交易所的 8 倍
- **AsterDEX** 為 Binance fork，歷史 endpoint 格式應相同，但需確認 startTime 參數是否支援
