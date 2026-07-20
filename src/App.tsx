import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { AnimatedContent } from './components/reactbits/AnimatedContent'
import { calculateFiveLines, calculateLohuoChannel, calculateLohuoChannelSeries, lineLabels, loadStock, loadWatchlist, type Stock, type WatchlistEntry } from './data/stocks'

const ranges = { '近一個月': 22, '近三個月': 66, '近一年': 252, '近一年半': 378, '近三年': 756, '近五年': 1260 } as const
type Range = keyof typeof ranges
const calculationPeriods = { '近一個月': 22, '近三個月': 66, '近一年': 252, '近一年半': 378, '近三年': 756 } as const
type CalculationPeriod = keyof typeof calculationPeriods | '自訂範圍'

const money = (value: number) => value.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
const routeStock = () => {
  if (typeof window === 'undefined') return null
  const [, market, code] = window.location.pathname.split('/')
  return market && code ? { market, code } : null
}

function App() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [showDisclosure, setShowDisclosure] = useState(() => sessionStorage.getItem('research-disclosure-dismissed') !== 'true')
  const [stock, setStock] = useState<Stock | null>(null)
  const [selectedId, setSelectedId] = useState(() => routeStock()?.code ?? '0050')
  const [range, setRange] = useState<Range>('近三年')
  const [calculationPeriod, setCalculationPeriod] = useState<CalculationPeriod>('近三年')
  const [windowStart, setWindowStart] = useState(0)
  const [windowEnd, setWindowEnd] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    loadWatchlist().then((payload) => { setWatchlist(payload.stocks); setLastUpdatedAt(payload.last_updated_at ?? null) }).catch(() => setError('股票清單載入失敗，請確認已執行清單同步。'))
  }, [])

  useEffect(() => {
    const handleHistoryChange = () => setSelectedId(routeStock()?.code ?? '0050')
    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setStock(null)
    loadStock(selectedId).then((nextStock) => {
      setStock(nextStock)
      setCalculationPeriod('近三年')
      setWindowStart(Math.max(0, nextStock.prices.length - calculationPeriods['近三年']))
      setWindowEnd(nextStock.prices.length - 1)
    }).catch(() => setError(`找不到 ${selectedId} 的行情資料。`))
  }, [selectedId])

  useEffect(() => {
    if (!stock) return
    document.querySelector<HTMLButtonElement>('.watchlist-items button.active')?.scrollIntoView({ block: 'nearest' })
  }, [stock, watchlist])
  const analysis = useMemo(() => {
    if (!stock) return { dates: [], prices: [], trendLines: [], lines: [], rSquared: 0, cv: 0, startIndex: 0, endIndex: 0 }
    const start = Math.min(windowStart, Math.max(0, stock.prices.length - 2))
    const end = Math.max(start + 2, Math.min(windowEnd || stock.prices.length - 1, stock.prices.length - 1))
    const prices = stock.prices.slice(start, end + 1)
    return { ...calculateFiveLines(prices), dates: stock.dates.slice(start, end + 1), prices, startIndex: start, endIndex: end }
  }, [stock, windowStart, windowEnd])

  const visible = useMemo(() => {
    if (!stock) return { dates: [], prices: [], trendLines: [] }
    const count = ranges[range]
    const start = Math.max(0, stock.dates.length - count)
    const trendLines = analysis.trendLines.map((line) => stock.prices.map((_, index) => index >= analysis.startIndex && index <= analysis.endIndex ? line[index - analysis.startIndex] : null))
    return { dates: stock.dates.slice(start), prices: stock.prices.slice(start), trendLines: trendLines.map((line) => line.slice(start)) }
  }, [range, stock, analysis])

  const currentLine = stock ? analysis.lines.reduce((best, line) => Math.abs(line - stock.price) < Math.abs(best - stock.price) ? line : best, analysis.lines[0]) : 0
  const priceChange = stock ? stock.price - (stock.prices.at(-2) ?? stock.price) : 0
  const zoneIndex = stock ? Math.max(0, Math.min(4, (() => { const index = analysis.lines.findIndex((line, lineIndex) => stock.price <= line && (lineIndex === 0 || stock.price > analysis.lines[lineIndex - 1])); return index === -1 ? 4 : index })())) : 2
  const zone = lineLabels[zoneIndex] ?? '合理'
  const distanceToTrend = stock ? ((stock.price / analysis.lines[2] - 1) * 100) : 0
  const lohuoChannel = useMemo(() => calculateLohuoChannel(stock?.prices ?? []), [stock])
  const lohuoSeries = useMemo(() => {
    if (!stock) return { dates: [], prices: [], middle: [], upper: [], lower: [] }
    const channel = calculateLohuoChannelSeries(stock.prices)
    const start = Math.max(0, stock.prices.length - ranges[range])
    return {
      dates: stock.dates.slice(start),
      prices: stock.prices.slice(start),
      middle: channel.middle.slice(start),
      upper: channel.upper.slice(start),
      lower: channel.lower.slice(start),
    }
  }, [stock, range])

  const lohuoOption = useMemo(() => ({
    animationDuration: 500,
    grid: { left: 8, right: 18, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: '#17201d', borderWidth: 0, textStyle: { color: '#fff' }, formatter: (items: { axisValue: string; seriesName: string; value: number }[]) => `${items[0]?.axisValue ?? ''}<br/>${items.map((item) => `<b>${item.seriesName} ${money(item.value)}</b>`).join('<br/>')}` },
    xAxis: { type: 'category', boundaryGap: false, data: lohuoSeries.dates, axisLine: { lineStyle: { color: '#dfe4da' } }, axisLabel: { color: '#8b958b', hideOverlap: true, formatter: (value: string) => value.slice(5) } },
    yAxis: { type: 'value', scale: true, min: (value: { min: number }) => Math.floor(value.min * .96), max: (value: { max: number }) => Math.ceil(value.max * 1.04), splitLine: { lineStyle: { color: '#edf0e9' } }, axisLabel: { color: '#8b958b', formatter: (value: number) => money(value) } },
    series: [
      { name: '收盤價', type: 'line', smooth: .2, showSymbol: false, data: lohuoSeries.prices, lineStyle: { width: 3, color: '#e8895b' }, itemStyle: { color: '#e8895b' } },
      { name: '上軌 +2σ', type: 'line', showSymbol: false, data: lohuoSeries.upper, lineStyle: { width: 1.5, type: 'dashed', color: '#6d9b78' } },
      { name: '中軌 20週均線', type: 'line', showSymbol: false, data: lohuoSeries.middle, lineStyle: { width: 2, color: '#d4774d' } },
      { name: '下軌 -2σ', type: 'line', showSymbol: false, data: lohuoSeries.lower, lineStyle: { width: 1.5, type: 'dashed', color: '#b99a65' } },
    ],
  }), [lohuoSeries])

  const option = useMemo(() => {
    if (!stock) return {}
    const lineSeries = analysis.lines.map((line, index) => ({
      name: lineLabels[index],
      type: 'line',
      data: visible.trendLines[index],
      symbol: 'none',
      lineStyle: { color: index === 2 ? '#d4774d' : index < 2 ? '#6d9b78' : '#b99a65', width: index === 2 ? 2.5 : 1.5, type: index === 2 ? 'solid' : 'dashed', opacity: index === 2 ? 1 : .75 },
      label: { show: true, formatter: `${lineLabels[index]} ${money(line)}`, color: index === 2 ? '#d4774d' : '#788677', fontSize: 10, fontWeight: index === 2 ? 700 : 400, position: 'insideEndTop' },
      tooltip: { show: false },
    }))
    return {
      animationDuration: 500,
      grid: { left: 8, right: 18, top: 24, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', backgroundColor: '#17201d', borderWidth: 0, textStyle: { color: '#fff' }, formatter: (items: { axisValue: string; seriesName: string; value: number }[]) => `${items[0]?.axisValue ?? ''}<br/><b>收盤價 ${money(items.find((item) => item.seriesName === '收盤價')?.value ?? 0)}</b>` },
      xAxis: { type: 'category', boundaryGap: false, data: visible.dates, axisLine: { lineStyle: { color: '#dfe4da' } }, axisLabel: { color: '#8b958b', hideOverlap: true, formatter: (value: string) => value.slice(5) } },
      yAxis: { type: 'value', scale: true, min: (value: { min: number }) => Math.floor(value.min * .96), max: (value: { max: number }) => Math.ceil(value.max * 1.04), splitLine: { lineStyle: { color: '#edf0e9' } }, axisLabel: { color: '#8b958b', formatter: (value: number) => money(value) } },
      series: [{ name: '收盤價', type: 'line', smooth: .2, showSymbol: false, data: visible.prices, lineStyle: { width: 3, color: '#e8895b' }, itemStyle: { color: '#e8895b' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(232,137,91,.25)' }, { offset: 1, color: 'rgba(232,137,91,0)' }] } }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: stock.price, lineStyle: { color: '#17201d', width: 1, type: 'dotted' }, label: { formatter: `目前 ${money(stock.price)}`, color: '#17201d', position: 'insideStartTop' } }] }, }, ...lineSeries],
    }
  }, [stock, visible, analysis])

  function chooseStock(item: WatchlistEntry) {
    window.history.pushState({}, '', `/${item.market}/${item.code}`)
    setSelectedId(item.code)
  }

  function dismissDisclosure() {
    sessionStorage.setItem('research-disclosure-dismissed', 'true')
    setShowDisclosure(false)
  }

  if (error) return <main className="page-shell"><div className="error-card">{error}</div></main>
  if (!stock) return <main className="page-shell"><div className="loading-card"><span className="pulse-dot" />正在讀取靜態行情資料…</div></main>
  const sliderMax = Math.max(1, stock.prices.length - 1)
  const startPercent = (windowStart / sliderMax) * 100
  const endPercent = (windowEnd / sliderMax) * 100
  const formattedLastUpdatedAt = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'

  return <main className="page-shell">
    <nav className="topbar"><div className="brand"><span className="brand-mark">EH</span><span className="font-display">均值回歸的標準差五線分析</span><span className="nav-tagline">把每日收盤價整理成一張有節奏的價格地圖。先看位置，再決定自己的投資步調。</span></div><span className="status-pill"><span /> LIVE DATA · {stock.source}</span></nav>
    <div className="content-layout"><aside className="watchlist-panel"><div className="watchlist-heading"><span>WATCHLIST</span><b>股票清單</b></div><div className="watchlist-items">{watchlist.map((item) => <button key={`${item.market}-${item.code}`} className={item.code === stock.code ? 'active' : ''} onClick={() => chooseStock(item)}><span><b>{item.code}</b><em>{item.name}</em></span><small>{item.market}</small></button>)}</div></aside><section className="dashboard">{showDisclosure && <div className="research-disclosure"><div><b>個人研究練習</b><span>本工具基於統計學的線性趨勢與標準差理論整理股價位置，僅供學習與研究參考。</span><small>免責聲明：不構成投資建議、買賣邀約或報酬保證；投資前請自行判斷並承擔風險。</small></div><button aria-label="關閉研究聲明" onClick={dismissDisclosure}>×</button></div>}<div className="main-card"><div className="card-heading"><div><div className="title-row"><h2>{stock.name}</h2><span>{stock.code}</span></div><p>{stock.market} · {stock.symbol} · {stock.data.at(-1)?.date} 收盤</p></div><div className="price-block"><strong>{money(stock.price)}</strong><b className={stock.change >= 0 ? 'up' : 'down'}>{stock.change >= 0 ? '▲' : '▼'} {priceChange >= 0 ? '+' : ''}{money(priceChange)}（{stock.change >= 0 ? '+' : '-'}{Math.abs(stock.change).toFixed(2)}%）</b></div></div><div className="window-control"><div className="window-heading"><div><b>標準差五線計算期間</b><small>選擇預設期間，或拖曳兩端把手自訂</small></div></div><div className="calculation-presets">{Object.entries(calculationPeriods).map(([label, count]) => <button key={label} className={calculationPeriod === label ? 'active' : ''} onClick={() => { setCalculationPeriod(label as CalculationPeriod); setWindowStart(Math.max(0, stock.prices.length - count)); setWindowEnd(stock.prices.length - 1) }}>{label}</button>)}</div><div className="window-slider"><div className="window-badges"><span className="window-badge start" style={{ left: `${startPercent}%` }}><b>START</b>{stock.dates[windowStart]}</span><span className="window-badge end" style={{ left: `${endPercent}%` }}><b>END</b>{stock.dates[windowEnd]}</span></div><div className="window-track"><span className="window-selected" style={{ left: `${startPercent}%`, width: `${Math.max(0, endPercent - startPercent)}%` }} /></div><input className="slider-start" aria-label="調整五線譜開始日期" type="range" min="0" max={sliderMax} value={windowStart} onChange={(event) => { setCalculationPeriod('自訂範圍'); setWindowStart(Math.min(Number(event.target.value), windowEnd - 2)) }} /><input className="slider-end" aria-label="調整五線譜結束日期" type="range" min="0" max={sliderMax} value={windowEnd} onChange={(event) => { setCalculationPeriod('自訂範圍'); setWindowEnd(Math.max(Number(event.target.value), windowStart + 2)) }} /></div></div><div className="chart-toolbar"><div><b>價格與長期標準差五線</b><small>五條通道線沿選定期間的趨勢延伸</small></div><div className="range-tabs">{Object.keys(ranges).map((item) => <button key={item} onClick={() => setRange(item as Range)} className={range === item ? 'active' : ''}>{item}</button>)}</div></div><ReactECharts option={option} style={{ height: 360 }} /><div className="chart-toolbar secondary-chart-toolbar"><div><b>價格與20週標準差通道</b><small>20 週均線與上下 2σ 通道</small></div></div><ReactECharts option={lohuoOption} style={{ height: 320 }} /></div>

      <aside className="sidebar"><AnimatedContent className="position-card"><div className="position-top"><div><small>目前價格位置</small><h3>{zone}</h3></div><span className="compass">⌁</span></div><div className="five-meter">{analysis.lines.map((line, index) => <div key={line} className={analysis.lines[index] === currentLine ? 'selected' : ''} style={{ left: `${index * 25}%` }}><i /><small>{lineLabels[index]}</small></div>)}<span className="current-pin" style={{ left: `${Math.max(0, Math.min(100, (stock.price - analysis.lines[0]) / (analysis.lines[4] - analysis.lines[0]) * 100))}%` }} /></div><div className="position-foot"><span>低估</span><span>合理</span><span>高估</span></div><p className="position-note">距離中線 <b>{distanceToTrend >= 0 ? '+' : ''}{distanceToTrend.toFixed(1)}%</b></p></AnimatedContent><AnimatedContent className="line-card"><div className="section-title"><h3>標準差五線</h3><span>R² {(analysis.rSquared * 100).toFixed(0)}% · CV {(analysis.cv * 100).toFixed(1)}%</span></div>{analysis.lines.map((line, index) => <div className={`line-item ${index === 2 ? 'fair' : ''}`} key={line}><span className="line-dot" /><span>{lineLabels[index]}</span><strong>{money(line)}</strong></div>)}<p className="method-note">依目前拖曳選定的期間做線性回歸：趨勢線 TL 上下各加減 1SD、2SD。R² 越高，趨勢參考性越強。</p></AnimatedContent><AnimatedContent className="line-card lohuo-card"><div className="section-title"><h3>20週標準差通道</h3><span>20 週均線 · {lohuoChannel.period} 日</span></div><div className="line-item"><span className="line-dot" /><span>上軌（+2σ）</span><strong>{money(lohuoChannel.upper)}</strong></div><div className="line-item fair"><span className="line-dot" /><span>中軌（20週均線）</span><strong>{money(lohuoChannel.middle)}</strong></div><div className="line-item"><span className="line-dot" /><span>下軌（-2σ）</span><strong>{money(lohuoChannel.lower)}</strong></div><div className="channel-metrics"><span>Bandwidth <b>{(lohuoChannel.bandwidth * 100).toFixed(1)}%</b></span><span>%b <b>{lohuoChannel.percentB.toFixed(2)}</b></span></div><p className="method-note">以最近 20 週收盤價計算中軌與上下 2 倍標準差。%b 越接近 1 越靠近上軌，越接近 0 越靠近下軌。</p></AnimatedContent></aside>
    <p className="data-note dashboard-note">資料來源：{stock.source} · {stock.data.length.toLocaleString()} 筆日收盤價。<br />最後更新時間：{formattedLastUpdatedAt}<br />標準差五線以完整歷史價格的長期趨勢與波動推導，不代表投資建議。</p></section></div>
  </main>
}

export default App
