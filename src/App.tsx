import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { AnimatedContent } from './components/reactbits/AnimatedContent'
import { stocks } from './data/stocks'

function App() {
  const [query, setQuery] = useState('2330')
  const [selectedId, setSelectedId] = useState('2330')
  const [range, setRange] = useState('近 3 個月')
  const stock = stocks.find((item) => item.id === selectedId) ?? stocks[0]
  const isPositive = stock.change >= 0

  const option = useMemo(() => ({
    animationDuration: 700,
    grid: { left: 8, right: 14, top: 28, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: '#17201d', borderWidth: 0, textStyle: { color: '#fff' } },
    xAxis: { type: 'category', boundaryGap: false, data: stock.dates, axisLine: { lineStyle: { color: '#dfe4da' } }, axisLabel: { color: '#8b958b' } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#edf0e9' } }, axisLabel: { color: '#8b958b' } },
    series: [{ name: '收盤價', type: 'line', smooth: true, showSymbol: false, data: stock.prices, lineStyle: { width: 3, color: '#e8895b' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(232,137,91,.27)' }, { offset: 1, color: 'rgba(232,137,91,0)' }] } } }],
  }), [stock])

  function search() {
    const found = stocks.find((item) => item.id === query.trim() || item.name.includes(query.trim()))
    if (found) setSelectedId(found.id)
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#17201d]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#17201d] text-lg text-[#f6c866]">₿</span><span className="font-display text-lg font-bold tracking-tight">樂活五線譜</span></div>
        <span className="rounded-full bg-[#e8eee3] px-4 py-2 text-xs font-semibold text-[#61705f]">台股研究工具 · Beta</span>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pb-10 pt-8 lg:px-10 lg:pt-14">
        <AnimatedContent>
          <div className="max-w-3xl"><p className="mb-4 text-sm font-bold uppercase tracking-[.2em] text-[#d4774d]">Calm investing, clear decisions</p><h1 className="font-display text-5xl font-bold leading-[1.05] tracking-[-.04em] sm:text-7xl">用五條線，<br /><em className="text-[#d4774d]">看懂一檔股票。</em></h1><p className="mt-6 max-w-xl text-base leading-8 text-[#718071]">把複雜的財務數字，整理成一張簡單的樂活五線譜。找到自己的買進節奏，長期做出舒服的投資決定。</p></div>
        </AnimatedContent>
        <div className="mt-10 flex max-w-xl gap-3"><div className="relative flex-1"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8b958b]">⌕</span><input aria-label="搜尋股票代號或名稱" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search()} className="h-14 w-full rounded-2xl border border-[#e0e5db] bg-white pl-11 pr-4 outline-none transition focus:border-[#d4774d]" placeholder="輸入股票代號或名稱，例如 2330" /></div><button onClick={search} className="h-14 rounded-2xl bg-[#d4774d] px-6 font-bold text-white transition hover:bg-[#bb613b]">開始查看</button></div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-10"><div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <AnimatedContent className="rounded-[2rem] border border-[#e2e7df] bg-white p-5 shadow-[0_20px_60px_rgba(37,52,38,.06)] sm:p-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><h2 className="font-display text-3xl font-bold">{stock.name}</h2><span className="rounded-md bg-[#eef2eb] px-2 py-1 text-xs font-bold text-[#788677]">{stock.id}</span></div><p className="mt-2 text-sm text-[#8b958b]">{stock.market} · 收盤價</p></div><div className="text-right"><p className="font-display text-4xl font-bold">{stock.price.toLocaleString()}</p><p className={`mt-1 text-sm font-bold ${isPositive ? 'text-[#3a9569]' : 'text-[#d4774d]'}`}>{isPositive ? '▲' : '▼'} {Math.abs(stock.change).toFixed(2)}%</p></div></div><div className="mb-4 flex items-center justify-between"><p className="text-sm font-bold text-[#61705f]">股價走勢</p><div className="flex gap-1 rounded-xl bg-[#f5f6f1] p-1">{['近 1 個月', '近 3 個月', '近 1 年'].map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${range === item ? 'bg-white text-[#17201d] shadow-sm' : 'text-[#8b958b]'}`}>{item}</button>)}</div></div><ReactECharts option={option} style={{ height: 330 }} /></AnimatedContent>

        <div className="space-y-5"><AnimatedContent className="rounded-[2rem] bg-[#17201d] p-7 text-white"><p className="text-sm font-bold text-[#aebbaa]">目前五線譜位置</p><div className="mt-4 flex items-end justify-between"><div><p className="font-display text-4xl font-bold text-[#f6c866]">{stock.zone}</p><p className="mt-2 text-sm leading-6 text-[#aebbaa]">距離估算合理價<br />還有 {((stock.fairValue / stock.price - 1) * 100).toFixed(1)}% 空間</p></div><span className="text-5xl">⌁</span></div><div className="mt-8 h-2 rounded-full bg-[#35433b]"><div className="h-2 w-[68%] rounded-full bg-[#f6c866]" /></div><div className="mt-3 flex justify-between text-xs text-[#aebbaa]"><span>便宜價</span><span>合理價</span><span>昂貴價</span></div></AnimatedContent><AnimatedContent className="rounded-[2rem] border border-[#e2e7df] bg-white p-7"><div className="flex items-center justify-between"><h3 className="font-display text-xl font-bold">快速摘要</h3><span className="text-[#d4774d]">✦</span></div><div className="mt-6 grid grid-cols-2 gap-y-6"><div><p className="text-xs text-[#8b958b]">本益比</p><p className="mt-1 text-xl font-bold">{stock.pe} <small className="text-xs font-normal text-[#8b958b]">倍</small></p></div><div><p className="text-xs text-[#8b958b]">殖利率</p><p className="mt-1 text-xl font-bold">{stock.dividend}%</p></div><div><p className="text-xs text-[#8b958b]">估算合理價</p><p className="mt-1 text-xl font-bold">{stock.fairValue.toLocaleString()}</p></div><div><p className="text-xs text-[#8b958b]">資料狀態</p><p className="mt-1 text-xl font-bold text-[#3a9569]">已更新</p></div></div></AnimatedContent></div>
      </div><p className="mt-6 text-center text-xs leading-6 text-[#9aa398]">資料為示意用途，非投資建議。實際五線譜計算需串接公開財報與市場行情資料。</p></section>
    </main>
  )
}

export default App
