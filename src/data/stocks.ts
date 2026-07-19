export type PricePoint = { date: string; close: number }

export type JobStock = {
  market: string
  code: string
  name: string
  symbol: string
  currency: string
  source: string
  data: PricePoint[]
}

export type WatchlistEntry = Pick<JobStock, 'market' | 'code' | 'name'>

export type Stock = JobStock & {
  prices: number[]
  dates: string[]
  price: number
  change: number
  lines: number[]
  trendLines: number[][]
  rSquared: number
  cv: number
}

export type FiveLineResult = Pick<Stock, 'lines' | 'trendLines' | 'rSquared' | 'cv'>

export function calculateFiveLines(prices: number[]): FiveLineResult {
  const xs = prices.map((_, index) => index)
  const xMean = xs.reduce((sum, value) => sum + value, 0) / (xs.length || 1)
  const yMean = prices.reduce((sum, value) => sum + value, 0) / (prices.length || 1)
  const slope = prices.reduce((sum, value, index) => sum + (xs[index] - xMean) * (value - yMean), 0) / (xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0) || 1)
  const intercept = yMean - slope * xMean
  const fitted = prices.map((_, index) => intercept + slope * index)
  const residuals = prices.map((value, index) => value - fitted[index])
  const deviation = Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / (residuals.length || 1)) || yMean * 0.05
  const trendLines = [-2, -1, 0, 1, 2].map((offset) => fitted.map((value) => Math.max(0, value + offset * deviation)))
  const totalVariance = prices.reduce((sum, value) => sum + (value - yMean) ** 2, 0)
  return {
    trendLines,
    lines: trendLines.map((line) => line.at(-1) ?? 0),
    rSquared: totalVariance ? Math.max(0, 1 - residuals.reduce((sum, value) => sum + value ** 2, 0) / totalVariance) : 0,
    cv: yMean ? deviation / yMean : 0,
  }
}

function normalizeStock(payload: JobStock): Stock {
  const data = payload.data.filter((point) => Number.isFinite(point.close)).sort((a, b) => a.date.localeCompare(b.date))
  const prices = data.map((point) => point.close)
  const latestDate = new Date(`${data.at(-1)?.date}T00:00:00Z`).getTime()
  const cutoff = latestDate - 365.25 * 1.5 * 24 * 60 * 60 * 1000
  const analysisPrices = data.filter((point) => new Date(`${point.date}T00:00:00Z`).getTime() >= cutoff).map((point) => point.close)
  const initial = calculateFiveLines(analysisPrices.length > 2 ? analysisPrices : prices)
  const price = prices.at(-1) ?? 0
  const previous = prices.at(-2) ?? price
  return {
    ...payload,
    data,
    prices,
    dates: data.map((point) => point.date),
    price,
    change: previous ? ((price - previous) / previous) * 100 : 0,
    ...initial,
  }
}

export async function loadWatchlist(): Promise<WatchlistEntry[]> {
  const response = await fetch('/job/watchlist.yml')
  if (!response.ok) throw new Error('無法讀取股票清單')
  const text = await response.text()
  const entries: WatchlistEntry[] = []
  let current: Partial<WatchlistEntry> = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s+-?\s*(market|code|name):\s*["']?(.+?)["']?\s*$/)
    if (!match) continue
    const [, key, value] = match
    if (key === 'market' && current.code) {
      entries.push(current as WatchlistEntry)
      current = {}
    }
    current[key as keyof WatchlistEntry] = value
  }
  if (current.code) entries.push(current as WatchlistEntry)
  return entries
}

export async function loadStock(code: string): Promise<Stock> {
  const response = await fetch(`/job/data/${code}.json`)
  if (!response.ok) throw new Error(`無法讀取 ${code} 行情資料`)
  return normalizeStock(await response.json() as JobStock)
}

export async function loadStocks(): Promise<Stock[]> {
  const watchlist = await loadWatchlist()
  return Promise.all(watchlist.slice(0, 2).map((item) => loadStock(item.code)))
}

export const lineLabels = ['悲觀線', '相對悲觀線', '趨勢線', '相對樂觀線', '樂觀線']
