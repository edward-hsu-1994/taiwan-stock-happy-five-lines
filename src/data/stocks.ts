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
export type WatchlistPayload = { last_updated_at?: string | null; stocks: WatchlistEntry[] }

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

export type LohuoChannelResult = {
  middle: number
  upper: number
  lower: number
  bandwidth: number
  percentB: number
  period: number
}

/** Number of daily closing-price changes used by the standard RSI period. */
export const RSI_PERIOD = 14

/**
 * Calculates Wilder's relative strength index for chronological daily closes.
 *
 * @param prices - Finite closing prices ordered from oldest to newest.
 * @returns RSI values aligned with `prices`; the first 14 entries are `null`,
 * then values range from 0 to 100. A fully unchanged period returns 50.
 */
export function calculateRelativeStrengthIndex(prices: number[]): (number | null)[] {
  const values: (number | null)[] = new Array(prices.length).fill(null)
  if (prices.length <= RSI_PERIOD) return values

  let averageGain = 0
  let averageLoss = 0
  for (let index = 1; index < prices.length; index += 1) {
    const change = prices[index] - prices[index - 1]
    const gain = Math.max(change, 0)
    const loss = Math.max(-change, 0)

    if (index <= RSI_PERIOD) {
      averageGain += gain
      averageLoss += loss
      if (index === RSI_PERIOD) {
        averageGain /= RSI_PERIOD
        averageLoss /= RSI_PERIOD
      }
    } else {
      averageGain = (averageGain * (RSI_PERIOD - 1) + gain) / RSI_PERIOD
      averageLoss = (averageLoss * (RSI_PERIOD - 1) + loss) / RSI_PERIOD
    }

    if (index >= RSI_PERIOD) {
      values[index] = averageLoss === 0
        ? averageGain === 0 ? 50 : 100
        : 100 - 100 / (1 + averageGain / averageLoss)
    }
  }
  return values
}

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

export function calculateLohuoChannel(prices: number[], period = 100): LohuoChannelResult {
  const window = prices.slice(-period)
  const middle = window.reduce((sum, value) => sum + value, 0) / (window.length || 1)
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / (window.length || 1)
  const deviation = Math.sqrt(variance)
  const upper = middle + 2 * deviation
  const lower = Math.max(0, middle - 2 * deviation)
  const width = upper - lower
  const latest = prices.at(-1) ?? middle
  return {
    middle,
    upper,
    lower,
    bandwidth: middle ? width / middle : 0,
    percentB: width ? (latest - lower) / width : 0.5,
    period: window.length,
  }
}

export function calculateLohuoChannelSeries(prices: number[], period = 100): { middle: number[]; upper: number[]; lower: number[] } {
  return prices.map((_, index) => {
    const channel = calculateLohuoChannel(prices.slice(0, index + 1), period)
    return { middle: channel.middle, upper: channel.upper, lower: channel.lower }
  }).reduce((series, channel) => {
    series.middle.push(channel.middle)
    series.upper.push(channel.upper)
    series.lower.push(channel.lower)
    return series
  }, { middle: [], upper: [], lower: [] } as { middle: number[]; upper: number[]; lower: number[] })
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

export async function loadWatchlist(): Promise<WatchlistPayload> {
  const response = await fetch('/data/stocks.json')
  if (!response.ok) throw new Error('無法讀取股票清單')
  return await response.json() as WatchlistPayload
}

export async function loadStock(code: string): Promise<Stock> {
  const response = await fetch(`/data/${code}.json`)
  if (!response.ok) throw new Error(`無法讀取 ${code} 行情資料`)
  return normalizeStock(await response.json() as JobStock)
}

export async function loadStocks(): Promise<Stock[]> {
  const payload = await loadWatchlist()
  return Promise.all(payload.stocks.slice(0, 2).map((item) => loadStock(item.code)))
}

export const lineLabels = ['-2α', '-1α', 'TL', '+1α', '+2α']
