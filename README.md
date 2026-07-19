# 台股樂活五線譜

一個純前端的台灣股票研究工具，使用 React、TypeScript、ECharts、Tailwind CSS，並以本地可擁有的 React Bits-style 動畫元件打造視覺介面。

## 目前功能

- 以股票代號或名稱搜尋示範股票（目前內建 2330 台積電、2317 鴻海）
- ECharts 股價走勢圖與時間區間切換介面
- 樂活五線譜的估值區間卡片與快速摘要
- 響應式版面，支援桌面與行動裝置
- `src/data/stocks.ts` 作為未來串接證交所、券商或自建 API 的資料邊界
- `job/watchlist.yml` 集中管理要關注的台股清單

## 技術選型

- Vite + React 19 + TypeScript
- ECharts + `echarts-for-react`
- Tailwind CSS 4（Vite plugin）
- React Bits：元件採 copy/paste、原始碼留在專案內；目前的 reveal primitive 位於 `src/components/reactbits/AnimatedContent.tsx`

React Bits 官方文件提供元件的 Tailwind 與 CSS 版本，適合將元件原始碼直接複製到 `src/components/reactbits/` 後自行維護：<https://reactbits.dev/>

## 開始使用

需求：Node.js 18+、npm。

```bash
make install
make dev
```

接著開啟終端機顯示的本機網址，通常是 `http://localhost:5173`。

其他指令：

```bash
make build    # Create the production bundle
make preview  # Preview the production bundle
make lint     # Run the TypeScript check
make fetch    # Fetch one latest close per watchlist stock
make backfill START_DATE=2026-01-01 END_DATE=2026-07-19  # Fill a date range
make clean    # Remove build output and temporary files
```

## 後續接 API 建議

1. 將 `src/data/stocks.ts` 的 mock data 改成 `src/services/stockApi.ts`。
2. 建立 API response type，將行情、財報與估值計算分開。
3. 將五線譜計算放在純函式中，補上 Vitest 測試。
4. 若瀏覽器直接呼叫資料來源遇到 CORS，使用同源 proxy 或後端 API gateway。

## 關注清單設定

`job/watchlist.yml` 是排程工作與未來資料服務共用的關注清單。每一筆資料包含：

- `market`：建議使用國際市場代碼 `TWSE`（上市）或 `TPEx`（上櫃）
- `code`：四位數股票代號，使用字串以保留前導零
- `name`：股票名稱

市場代碼採用交易所英文縮寫，方便未來串接國際資料服務：

- `TWSE`：Taiwan Stock Exchange，台灣證券交易所，對應上市公司
- `TPEx`：Taipei Exchange，證券櫃檯買賣中心，對應上櫃公司

英文描述可使用 `TWSE-listed company` 或 `TPEx-listed company`；`OTC-listed company` 雖然常見，但不如 `TPEx-listed` 精準。

目前清單內的股票是初始化範例，可直接編輯增刪；正式串接資料服務時，建議由此檔案作為查詢股票的來源。

## 注意事項

目前資料與合理價為介面示意，不代表即時行情，也不是投資建議。正式使用前，請確認資料授權、更新頻率、計算公式與錯誤狀態處理。

## 拉取每日收盤價

`job/fetch_stock_prices.py` 會讀取 `job/watchlist.yml`，預設每檔股票取得一筆最新的已完成交易日收盤價，並寫入 `job/data/{股票代號}.json`。每個 JSON 檔案是 object，股票基本資料放在外層，歷史價格放在 `data` array；每次交易日執行會追加一筆，同一交易日重複執行時會更新該筆資料，不會產生重複紀錄。週末或休市日會使用最近一個已完成交易日，避免寫入虛假的收盤價。

若要補齊一段歷史資料，可使用 `backfill` 模式：

```bash
python3 job/fetch_stock_prices.py \
  --mode backfill \
  --start-date 2026-01-01 \
  --end-date 2026-07-19
```

或使用 Makefile：

```bash
make backfill START_DATE=2026-01-01 END_DATE=2026-07-19
```

`backfill` 會抓取指定日期範圍內的每日收盤價，合併到既有 JSON object 的 `data` array，並依日期去重。

每次執行前，腳本也會同步檢查 `job/data/`：凡是股票代號不再存在於 `job/watchlist.yml` 的 `.json` 檔案都會被清除；非 JSON 檔案不會受到影響。為避免誤刪，空的關注清單會讓腳本直接停止。

```bash
make job-install
make fetch
```

輸出資料包含 `date`、`close`、`market`、`code`、`name`、Yahoo symbol、幣別與抓取時間。這個工作適合在台灣收盤後透過 cron、GitHub Actions 或其他排程器執行。
