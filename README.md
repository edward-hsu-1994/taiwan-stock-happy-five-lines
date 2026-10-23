# 均值回歸的標準差五線分析

一個純前端的台灣股票研究工具，使用 React、TypeScript、ECharts、Tailwind CSS，並以本地可擁有的 React Bits-style 動畫元件打造視覺介面。

## 目前功能

- 由固定觀察清單切換股票，支援上市與上櫃標的
- ECharts 股價走勢圖與時間區間切換介面
- 均值回歸與標準差五線的區間卡片與快速摘要
- 14 日 Wilder RSI 動能指標，補充五線與標準差通道的短期動能視角
- 響應式版面，支援桌面與行動裝置
- `src/data/stocks.ts` 作為未來串接證交所、券商或自建 API 的資料邊界
- `public/data/stocks.json` 集中管理要關注的台股清單與靜態行情 JSON
- GitHub Actions 每日盤後自動更新觀察清單內的收盤資料

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
make test     # Run Python and Vitest test suites
make fetch    # Fetch one latest close per watchlist stock
make backfill START_DATE=2026-01-01 END_DATE=2026-07-19  # Fill a date range
make clean    # Remove build output and temporary files
```

## 後續接 API 建議

1. 將 `src/data/stocks.ts` 的 mock data 改成 `src/services/stockApi.ts`。
2. 建立 API response type，將行情、財報與估值計算分開。
3. 將標準差五線與其他指標計算維持為純函式，並以 Vitest 測試重要邊界。
4. 若瀏覽器直接呼叫資料來源遇到 CORS，使用同源 proxy 或後端 API gateway。

## 關注清單設定

`public/data/stocks.json` 是排程工作與前端共用的關注清單。`stocks` 陣列中的每一筆資料包含：

- `market`：建議使用國際市場代碼 `TWSE`（上市）或 `TPEx`（上櫃）
- `code`：股票代號，使用字串以保留前導零與英文字尾碼
- `name`：股票名稱

檔案也會保留 `last_updated_at`，記錄最近一次成功執行資料腳本的台灣時間。

### 調整觀察清單

直接編輯 `public/data/stocks.json` 的 `stocks` 陣列即可增刪股票。例如加入上市中鋼：

```json
{
  "market": "TWSE",
  "code": "2002",
  "name": "中鋼"
}
```

市場代碼必須和股票實際掛牌市場一致：上市使用 `TWSE`，上櫃使用 `TPEx`。`code` 必須使用字串，才能保留像 `0050`、`00751B` 這類代號的格式。修改清單後，先執行資料補抓，再提交 `stocks.json` 與新增的行情 JSON。

可使用 `make sync-watchlist` 從台灣證券交易所 ISIN 清單同步上市與上櫃的股票、ETF；同步結果會寫入 `public/data/stocks.json`，前端也直接讀取這份 JSON。興櫃清單目前不納入。

市場代碼採用交易所英文縮寫，方便未來串接國際資料服務：

- `TWSE`：Taiwan Stock Exchange，台灣證券交易所，對應上市公司
- `TPEx`：Taipei Exchange，證券櫃檯買賣中心，對應上櫃公司

英文描述可使用 `TWSE-listed company` 或 `TPEx-listed company`；`OTC-listed company` 雖然常見，但不如 `TPEx-listed` 精準。

目前清單內的股票是初始化範例，可直接編輯增刪；正式串接資料服務時，建議由此檔案作為查詢股票的來源。

## 注意事項

目前資料與合理價為介面示意，不代表即時行情，也不是投資建議。正式使用前，請確認資料授權、更新頻率、計算公式與錯誤狀態處理。

## 技術指標與台股解讀

14 日相對強弱指標（RSI）使用每日收盤價變動，先以 14 個交易日變動計算平均漲跌幅，再以 Wilder 平滑法遞推；結果與交易日一一對齊，資料不足時不顯示數值。RSI 介於 0–100，70 與 30 是常見的偏熱／偏冷參考區，不代表價格必定反轉。強勢或弱勢趨勢可能讓 RSI 長時間停留在極端區域，因此應搭配五線與標準差通道解讀。

本專案的行情資料目前只有收盤價，因此採用 RSI 作為可直接計算、且不重複標準差通道的動能補充。ATR 需要最高價與最低價，OBV 需要成交量，VWAP 需要盤中價格與成交量；目前資料無法支援這些指標。

台股規則也會影響指標解讀：TWSE 對一般股票及部分本土證券產品設有每日價格漲跌幅限制，並列有不適用類別；TPEx 興櫃股票則沒有每日漲跌幅限制。RSI 因此不套用單一的「台股漲跌停校正」，連續觸及價格限制時也不應將極端 RSI 當成反轉訊號。此處僅提供價格動能觀察，不構成投資建議。

參考資料：

- [Wilder RSI 計算、常見區間與趨勢限制（StockCharts）](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/relative-strength-index-rsi)
- [每日漲跌幅與價格跳動單位（TWSE）](https://www.twse.com.tw/en/products/system/trading.html)
- [興櫃交易規則：無每日價格漲跌幅限制（TPEx）](https://www.tpex.org.tw/en-us/esb/trading/rules/overview.html)

## 拉取每日收盤價

`scripts/fetch_stock_prices.py` 會讀取 `public/data/stocks.json`，預設每檔股票取得一筆最新的已完成交易日收盤價，並寫入 `public/data/{股票代號}.json`。每個 JSON 檔案是 object，股票基本資料放在外層，歷史價格放在 `data` array；每次交易日執行會追加一筆，同一交易日重複執行時會更新該筆資料，不會產生重複紀錄。週末或休市日會使用最近一個已完成交易日，避免寫入虛假的收盤價。

若要補齊一段歷史資料，可使用 `backfill` 模式：

```bash
python3 scripts/fetch_stock_prices.py \
  --mode backfill \
  --start-date 2026-01-01 \
  --end-date 2026-07-19
```

或使用 Makefile：

```bash
make backfill START_DATE=2026-01-01 END_DATE=2026-07-19
```

`backfill` 會抓取指定日期範圍內的每日收盤價，合併到既有 JSON object 的 `data` array，並依日期去重；整批成功後會更新 `stocks.json` 的 `last_updated_at`。

每次執行前，腳本也會同步檢查 `public/data/`：凡是股票代號不再存在於 `public/data/stocks.json` 的 `.json` 檔案都會被清除；非 JSON 檔案不會受到影響。為避免誤刪，空的關注清單會讓腳本直接停止。

```bash
make job-install
make fetch
```

輸出資料包含 `date`、`close` 與每筆資料的抓取時間；JSON 外層則包含 `market`、`code`、`name`、Yahoo symbol、幣別及 `data` 歷史價格陣列。資料會以 `public/data/{股票代號}.json` 儲存，前端從 `/data/{股票代號}.json` 讀取。這個工作適合在台灣收盤後透過 cron、GitHub Actions 或其他排程器執行。

## GitHub Actions 自動更新

`.github/workflows/update-stock-data.yml` 會每天台灣時間 16:00（UTC 08:00）執行 `latest` 模式。流程會：

1. 讀取 `public/data/stocks.json` 的觀察清單。
2. 透過 Yahoo Finance 取得每檔股票最近一個已完成交易日的收盤價。
3. 更新或新增 `public/data/{股票代號}.json`，並更新 `stocks.json` 的 `last_updated_at`。
4. 將資料變更自動 commit 並推送回 `main`。

也可以在 GitHub Actions 頁面使用 `workflow_dispatch` 手動執行。若要在本機模擬同一流程，可執行：

```bash
make job-install
make fetch
```

資料更新 workflow 只會處理 `stocks.json` 內的股票；若從清單移除某檔股票，下一次腳本執行時會清除對應的行情 JSON。GitHub Actions 會使用 `scripts/` 內的腳本，不需要在本機常駐服務。
