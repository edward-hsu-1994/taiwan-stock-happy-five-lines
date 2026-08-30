import { lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { WatchlistPanel } from './components/WatchlistPanel'
import { WindowControls } from './components/WindowControls'
import { PositionSidebar } from './components/PositionSidebar'
import { calculationPeriods, comparisonColors, ranges, type CalculationPeriod, type Range } from './components/periods'
import {
  calculateFiveLines,
  calculateLohuoChannel,
  calculateLohuoChannelSeries,
  lineLabels,
  loadStock,
  loadWatchlist,
  resolveDateWindow,
  type CalculationWindow,
  type Stock,
  type WatchlistEntry,
} from './data/stocks'
import type * as EChartsCore from 'echarts/core'
import type { LineSeriesOption } from 'echarts/charts'
import type { GridComponentOption, MarkLineComponentOption, TooltipComponentOption } from 'echarts/components'

const StockChart = lazy(() => import('./components/StockChart'))
type EChartsOption = EChartsCore.ComposeOption<LineSeriesOption | GridComponentOption | MarkLineComponentOption | TooltipComponentOption>
const comparisonStorageKey = 'five-line-comparison-windows'

const loadComparisonWindows = (): CalculationWindow[] => {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(comparisonStorageKey) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is CalculationWindow =>
      typeof item?.id === 'number' && typeof item?.startDate === 'string' && typeof item?.endDate === 'string',
    )
  } catch {
    return []
  }
}

const money = (value: number) => value.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
const routeStock = () => {
  if (typeof window === 'undefined') return null
  const [, market, code] = window.location.pathname.split('/')
  return market && code ? { market, code } : null
}

function App() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [showDisclosure, setShowDisclosure] = useState(
    () => sessionStorage.getItem('research-disclosure-dismissed') !== 'true',
  )
  const [stock, setStock] = useState<Stock | null>(null)
  const [selectedId, setSelectedId] = useState(() => routeStock()?.code ?? '0050')
  const [range, setRange] = useState<Range>('近三年')
  const [calculationPeriod, setCalculationPeriod] = useState<CalculationPeriod>('近三年')
  const [windowStart, setWindowStart] = useState(0)
  const [windowEnd, setWindowEnd] = useState(0)
  const [savedComparisonWindows, setComparisonWindows] = useState<CalculationWindow[]>(loadComparisonWindows)
  const [isDraggingWindow, setIsDraggingWindow] = useState(false)
  const windowDrag = useRef({ active: false, pointerX: 0, start: 0, end: 0 })
  const nextWindowId = useRef(Math.max(0, ...savedComparisonWindows.map((item) => item.id)) + 1)
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [stockError, setStockError] = useState<string | null>(null)
  const [watchlistRetryToken, setWatchlistRetryToken] = useState(0)
  const [stockRetryToken, setStockRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setWatchlistError(null)
    loadWatchlist()
      .then((payload) => {
        if (cancelled) return
        setWatchlist(payload.stocks)
        setLastUpdatedAt(payload.last_updated_at ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setWatchlistError('股票清單載入失敗，請確認已執行清單同步。')
      })
    return () => {
      cancelled = true
    }
  }, [watchlistRetryToken])

  useEffect(() => {
    const handleHistoryChange = () => setSelectedId(routeStock()?.code ?? '0050')
    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setStock(null)
    setStockError(null)
    loadStock(selectedId)
      .then((nextStock) => {
        if (cancelled) return
        setStock(nextStock)
        setCalculationPeriod('近三年')
        setWindowStart(Math.max(0, nextStock.prices.length - calculationPeriods['近三年']))
        setWindowEnd(nextStock.prices.length - 1)
      })
      .catch(() => {
        if (cancelled) return
        setStockError(`找不到 ${selectedId} 的行情資料。`)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, stockRetryToken])

  useEffect(() => {
    sessionStorage.setItem(comparisonStorageKey, JSON.stringify(savedComparisonWindows))
  }, [savedComparisonWindows])

  useEffect(() => {
    if (!stock) return
    document.querySelector<HTMLButtonElement>('.watchlist-items button.active')?.scrollIntoView({ block: 'nearest' })
  }, [stock, watchlist])

  const analysis = useMemo(() => {
    if (!stock) return { dates: [], prices: [], trendLines: [], lines: [], rSquared: 0, cv: 0, startIndex: 0, endIndex: 0 }
    const start = Math.min(windowStart, Math.max(0, stock.prices.length - 2))
    const end = Math.max(start + 2, Math.min(windowEnd || stock.prices.length - 1, stock.prices.length - 1))
    const prices = stock.prices.slice(start, end + 1)
    return {
      ...calculateFiveLines(prices),
      dates: stock.dates.slice(start, end + 1),
      prices,
      startIndex: start,
      endIndex: end,
    }
  }, [stock, windowStart, windowEnd])

  const comparisonAnalyses = useMemo(() => {
    if (!stock) return []
    return savedComparisonWindows.flatMap((item) => {
      const resolved = resolveDateWindow(stock.dates, item)
      if (!resolved) return []
      const prices = stock.prices.slice(resolved.start, resolved.end + 1)
      return [{ ...item, ...resolved, analysis: calculateFiveLines(prices) }]
    })
  }, [stock, savedComparisonWindows])

  const visible = useMemo(() => {
    if (!stock) return { dates: [], prices: [], trendLines: [] }
    const start = Math.max(0, stock.dates.length - ranges[range])
    const dates = stock.dates.slice(start)
    const prices = stock.prices.slice(start)
    const trendLines = analysis.trendLines.map((line) => {
      const visibleLine: (number | null)[] = new Array(prices.length).fill(null)
      const lineStart = Math.max(analysis.startIndex, start)
      const lineEnd = Math.min(analysis.endIndex, stock.prices.length - 1)
      if (lineEnd >= lineStart) {
        for (let index = lineStart; index <= lineEnd; index += 1) {
          visibleLine[index - start] = line[index - analysis.startIndex]
        }
      }
      return visibleLine
    })
    return { dates, prices, trendLines }
  }, [range, stock, analysis])

  const currentLine = stock
    ? analysis.lines.reduce(
        (best, line) => (Math.abs(line - stock.price) < Math.abs(best - stock.price) ? line : best),
        analysis.lines[0],
      )
    : 0
  const priceChange = stock ? stock.price - (stock.prices.at(-2) ?? stock.price) : 0
  const zoneIndex = stock
    ? (() => {
        if (stock.price < analysis.lines[0]) return 0
        if (stock.price < analysis.lines[1]) return 1
        if (stock.price < analysis.lines[3]) return 2
        if (stock.price < analysis.lines[4]) return 3
        return 4
      })()
    : 2
  const zone = lineLabels[zoneIndex] ?? '合理'
  const distanceToTrend = stock ? (stock.price / analysis.lines[2] - 1) * 100 : 0
  const lohuoChannel = useMemo(() => calculateLohuoChannel(stock?.prices ?? []), [stock])
  const lohuoChannels = useMemo<{ middle: number[]; upper: number[]; lower: number[] }>(
    () =>
      stock
        ? calculateLohuoChannelSeries(stock.prices)
        : { middle: [], upper: [], lower: [] },
    [stock],
  )
  const lohuoSeries = useMemo(() => {
    if (!stock) return { dates: [], prices: [], middle: [], upper: [], lower: [] }
    const start = Math.max(0, stock.prices.length - ranges[range])
    return {
      dates: stock.dates.slice(start),
      prices: stock.prices.slice(start),
      middle: lohuoChannels.middle.slice(start),
      upper: lohuoChannels.upper.slice(start),
      lower: lohuoChannels.lower.slice(start),
    }
  }, [stock, range, lohuoChannels])

  const lohuoOption: EChartsOption = useMemo(
    () =>
      ({
        animationDuration: 500,
        grid: { left: 8, right: 18, top: 24, bottom: 8, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#17201d',
          borderWidth: 0,
          textStyle: { color: '#fff' },
          formatter: (items: { axisValue: string; seriesName: string; value: number }[]) =>
            `${items[0]?.axisValue ?? ''}<br/>${items.map((item) => `<b>${item.seriesName} ${money(item.value)}</b>`).join('<br/>')}`,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: lohuoSeries.dates,
          axisLine: { lineStyle: { color: '#dfe4da' } },
          axisLabel: { color: '#8b958b', hideOverlap: true, formatter: (value: string) => value.slice(5) },
        },
        yAxis: {
          type: 'value',
          scale: true,
          min: (value: { min: number }) => Math.floor(value.min * 0.96),
          max: (value: { max: number }) => Math.ceil(value.max * 1.04),
          splitLine: { lineStyle: { color: '#edf0e9' } },
          axisLabel: { color: '#8b958b', formatter: (value: number) => money(value) },
        },
        series: [
          { name: '收盤價', type: 'line', smooth: 0.2, showSymbol: false, data: lohuoSeries.prices, lineStyle: { width: 3, color: '#e8895b' }, itemStyle: { color: '#e8895b' } },
          { name: '上軌 +2σ', type: 'line', showSymbol: false, data: lohuoSeries.upper, lineStyle: { width: 1.5, type: 'dashed', color: '#6d9b78' } },
          { name: '中軌 20週均線', type: 'line', showSymbol: false, data: lohuoSeries.middle, lineStyle: { width: 2, color: '#d4774d' } },
          { name: '下軌 -2σ', type: 'line', showSymbol: false, data: lohuoSeries.lower, lineStyle: { width: 1.5, type: 'dashed', color: '#b99a65' } },
        ],
      }) as unknown as EChartsOption,
    [lohuoSeries],
  )

  const option: EChartsOption = useMemo(() => {
    if (!stock) return {} as EChartsOption
    const lineSeries = analysis.lines.map((line, index) => ({
      name: lineLabels[index],
      type: 'line',
      data: visible.trendLines[index],
      symbol: 'none',
      lineStyle: {
        color: index === 2 ? '#d4774d' : index < 2 ? '#6d9b78' : '#b99a65',
        width: index === 2 ? 2.5 : 1.5,
        type: index === 2 ? 'solid' : 'dashed',
        opacity: index === 2 ? 1 : 0.75,
      },
      label: {
        show: true,
        formatter: `${lineLabels[index]} ${money(line)}`,
        color: index === 2 ? '#d4774d' : '#788677',
        fontSize: 10,
        fontWeight: index === 2 ? 700 : 400,
        position: 'insideEndTop',
      },
      tooltip: { show: false },
    }))
    const visibleStart = Math.max(0, stock.prices.length - ranges[range])
    const visibleLength = stock.prices.length - visibleStart
    const comparisonSeries = comparisonAnalyses.flatMap((item, comparisonIndex) => {
      const color = comparisonColors[comparisonIndex % comparisonColors.length]
      const periodLabel = `${stock.dates[item.start]}～${stock.dates[item.end]}`
      return item.analysis.trendLines.map((line, lineIndex) => {
        const lineStart = Math.max(item.start, visibleStart)
        const lineEnd = Math.min(item.end, stock.prices.length - 1)
        const data: (number | null)[] = new Array(visibleLength).fill(null)
        if (lineEnd >= lineStart) {
          for (let index = lineStart; index <= lineEnd; index += 1) {
            data[index - visibleStart] = line[index - item.start]
          }
        }
        return {
          name: `比較 ${comparisonIndex + 1} ${periodLabel} ${lineLabels[lineIndex]}`,
          type: 'line',
          data,
          symbol: 'none',
          lineStyle: { color, width: lineIndex === 2 ? 2.5 : 1.25, type: lineIndex === 2 ? 'solid' : 'dashed', opacity: lineIndex === 2 ? 0.95 : 0.55 },
          label: { show: false },
          tooltip: { show: false },
        }
      })
    })
    return {
      animationDuration: 500,
      grid: { left: 8, right: 18, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#17201d',
        borderWidth: 0,
        textStyle: { color: '#fff' },
        formatter: (items: { axisValue: string; seriesName: string; value: number }[]) =>
          `${items[0]?.axisValue ?? ''}<br/><b>收盤價 ${money(items.find((item) => item.seriesName === '收盤價')?.value ?? 0)}</b>`,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: visible.dates,
        axisLine: { lineStyle: { color: '#dfe4da' } },
        axisLabel: { color: '#8b958b', hideOverlap: true, formatter: (value: string) => value.slice(5) },
      },
      yAxis: {
        type: 'value',
        scale: true,
        min: (value: { min: number }) => Math.floor(value.min * 0.96),
        max: (value: { max: number }) => Math.ceil(value.max * 1.04),
        splitLine: { lineStyle: { color: '#edf0e9' } },
        axisLabel: { color: '#8b958b', formatter: (value: number) => money(value) },
      },
      series: [
        {
          name: '收盤價',
          type: 'line',
          smooth: 0.2,
          showSymbol: false,
          data: visible.prices,
          lineStyle: { width: 3, color: '#e8895b' },
          itemStyle: { color: '#e8895b' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(232,137,91,.25)' },
                { offset: 1, color: 'rgba(232,137,91,0)' },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                yAxis: stock.price,
                lineStyle: { color: '#17201d', width: 1, type: 'dotted' },
                label: { formatter: `目前 ${money(stock.price)}`, color: '#17201d', position: 'insideStartTop' },
              },
            ],
          },
        },
        ...comparisonSeries,
        ...lineSeries,
      ],
    } as unknown as EChartsOption
  }, [stock, visible, analysis, range, comparisonAnalyses])

  const chooseStock = (item: WatchlistEntry) => {
    window.history.pushState({}, '', `/${item.market}/${item.code}`)
    setSelectedId(item.code)
  }

  const dismissDisclosure = () => {
    sessionStorage.setItem('research-disclosure-dismissed', 'true')
    setShowDisclosure(false)
  }

  const startWindowDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    windowDrag.current = { active: true, pointerX: event.clientX, start: windowStart, end: windowEnd }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDraggingWindow(true)
  }
  const moveWindowDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!windowDrag.current.active || !stock) return
    const trackWidth = event.currentTarget.parentElement?.clientWidth ?? 0
    if (!trackWidth) return
    const drag = windowDrag.current
    const sliderMax = Math.max(1, stock.prices.length - 1)
    const requestedDelta = Math.round(((event.clientX - drag.pointerX) / trackWidth) * sliderMax)
    const delta = Math.max(-drag.start, Math.min(sliderMax - drag.end, requestedDelta))
    setCalculationPeriod('自訂範圍')
    setWindowStart(drag.start + delta)
    setWindowEnd(drag.end + delta)
  }
  const stopWindowDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    windowDrag.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setIsDraggingWindow(false)
  }

  const addComparisonWindow = () => {
    if (!stock) return
    const startDate = stock.dates[windowStart]
    const endDate = stock.dates[windowEnd]
    if (savedComparisonWindows.some((item) => item.startDate === startDate && item.endDate === endDate)) return
    setComparisonWindows((items) => [...items, { id: nextWindowId.current++, startDate, endDate }])
  }
  const removeComparisonWindow = (id: number) => {
    setComparisonWindows((items) => items.filter((item) => item.id !== id))
  }

  const sliderMax = stock ? Math.max(1, stock.prices.length - 1) : 0
  const comparisonWindows = stock
    ? savedComparisonWindows.flatMap((item) => {
        const resolved = resolveDateWindow(stock.dates, item)
        return resolved ? [{ ...item, ...resolved }] : []
      })
    : []
  const currentWindowIsSaved = stock
    ? savedComparisonWindows.some((item) => item.startDate === stock.dates[windowStart] && item.endDate === stock.dates[windowEnd])
    : false
  const formattedLastUpdatedAt = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '—'

  return (
    <main className="page-shell">
      <nav className="topbar">
        <div className="brand">
          <span className="brand-mark">EH</span>
          <span className="font-display">均值回歸的標準差五線分析</span>
          <span className="nav-tagline">把每日收盤價整理成一張有節奏的價格地圖。先看位置，再決定自己的投資步調。</span>
        </div>
        <span className="status-pill"><span /> UPDATED DAILY · {stock?.source ?? '—'}</span>
      </nav>
      <div className="content-layout">
        <WatchlistPanel
          watchlist={watchlist}
          activeCode={stock?.code ?? selectedId}
          onChoose={chooseStock}
          onRetry={() => setWatchlistRetryToken((token) => token + 1)}
          error={watchlistError}
        />
        <section className="dashboard">
          {showDisclosure && (
            <div className="research-disclosure">
              <div>
                <b>個人研究練習</b>
                <span>本工具基於統計學的線性趨勢與標準差理論整理股價位置，僅供學習與研究參考。</span>
                <small>免責聲明：不構成投資建議、買賣邀約或報酬保證；投資前請自行判斷並承擔風險。</small>
              </div>
              <button aria-label="關閉研究聲明" onClick={dismissDisclosure}>×</button>
            </div>
          )}
          {stockError ? (
            <div className="main-card">
              <div className="error-card main-error">
                {stockError}
                <button type="button" onClick={() => setStockRetryToken((token) => token + 1)}>重試</button>
              </div>
            </div>
          ) : !stock ? (
            <div className="loading-card"><span className="pulse-dot" />正在讀取靜態行情資料…</div>
          ) : (
            <div className="main-card">
              <div className="card-heading">
                <div>
                  <div className="title-row">
                    <h2>{stock.name}</h2>
                    <span>{stock.code}</span>
                  </div>
                  <p>{stock.market} · {stock.symbol} · {stock.data.at(-1)?.date} 收盤</p>
                </div>
                <div className="price-block">
                  <strong>{money(stock.price)}</strong>
                  <b className={stock.change >= 0 ? 'up' : 'down'}>
                    {stock.change >= 0 ? '▲' : '▼'} {priceChange >= 0 ? '+' : ''}{money(priceChange)}（{stock.change >= 0 ? '+' : '-'}{Math.abs(stock.change).toFixed(2)}%）
                  </b>
                </div>
              </div>
                  <WindowControls
                    dates={stock.dates}
                    windowStart={windowStart}
                    windowEnd={windowEnd}
                    sliderMax={sliderMax}
                    calculationPeriod={calculationPeriod}
                    setCalculationPeriod={setCalculationPeriod}
                    setWindowStart={setWindowStart}
                    setWindowEnd={setWindowEnd}
                    comparisonWindows={comparisonWindows}
                    onAddComparison={addComparisonWindow}
                    onRemoveComparison={removeComparisonWindow}
                    currentWindowIsSaved={currentWindowIsSaved}
                    isDraggingWindow={isDraggingWindow}
                    onPointerDown={startWindowDrag}
                    onPointerMove={moveWindowDrag}
                    onPointerUp={stopWindowDrag}
                  />
                  <div className="chart-toolbar">
                    <div>
                      <b>價格與長期標準差五線</b>
                      <small>五條通道線沿選定期間的趨勢延伸</small>
                    </div>
                    <div className="range-tabs">
                      {(Object.keys(ranges) as Range[]).map((item) => (
                        <button key={item} onClick={() => setRange(item)} className={range === item ? 'active' : ''}>{item}</button>
                      ))}
                    </div>
                  </div>
                  <Suspense fallback={<div className="chart-fallback" style={{ height: 360 }} />}>
                    <StockChart option={option} notMerge={true} style={{ height: 360 }} />
                  </Suspense>
                  <div className="chart-toolbar secondary-chart-toolbar">
                    <div>
                      <b>價格與20週標準差通道</b>
                      <small>20 週均線與上下 2σ 通道</small>
                    </div>
                  </div>
                  <Suspense fallback={<div className="chart-fallback" style={{ height: 320 }} />}>
                    <StockChart option={lohuoOption} style={{ height: 320 }} />
                  </Suspense>
            </div>
          )}
          {stock && (
            <PositionSidebar
              stock={stock}
              analysis={analysis}
              currentLine={currentLine}
              zone={zone}
              distanceToTrend={distanceToTrend}
              lohuoChannel={lohuoChannel}
              money={money}
            />
          )}
          <p className="data-note dashboard-note">
            資料來源：{stock?.source ?? '—'} · {(stock?.data.length ?? 0).toLocaleString()} 筆日收盤價。
            <br />最後更新時間：{formattedLastUpdatedAt}
            <br />標準差五線以最近一年半歷史價格的線性趨勢與波動推導為初始基準，可拖曳調整計算期間，不代表投資建議。
          </p>
        </section>
      </div>
    </main>
  )
}

export default App