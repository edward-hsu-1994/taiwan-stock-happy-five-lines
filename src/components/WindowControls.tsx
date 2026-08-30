import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CalculationWindow } from '../data/stocks'

export type Range = keyof typeof ranges
export type CalculationPeriod = keyof typeof calculationPeriods | '自訂範圍'

export const ranges = { '近一個月': 22, '近三個月': 66, '近一年': 252, '近一年半': 378, '近三年': 756, '近五年': 1260 } as const
export const calculationPeriods = { '近一個月': 22, '近三個月': 66, '近一年': 252, '近一年半': 378, '近三年': 756 } as const
export const comparisonColors = ['#5778a4', '#8f63a9', '#2f9c95', '#c48a32', '#c45b72', '#687a3d']

export type WindowControlsProps = {
  dates: string[]
  windowStart: number
  windowEnd: number
  sliderMax: number
  calculationPeriod: CalculationPeriod
  setCalculationPeriod: (value: CalculationPeriod) => void
  setWindowStart: (value: number) => void
  setWindowEnd: (value: number) => void
  comparisonWindows: Array<CalculationWindow & { start: number; end: number }>
  onAddComparison: () => void
  onRemoveComparison: (id: number) => void
  currentWindowIsSaved: boolean
  isDraggingWindow: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLSpanElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLSpanElement>) => void
}

export function WindowControls({
  dates,
  windowStart,
  windowEnd,
  sliderMax,
  calculationPeriod,
  setCalculationPeriod,
  setWindowStart,
  setWindowEnd,
  comparisonWindows,
  onAddComparison,
  onRemoveComparison,
  currentWindowIsSaved,
  isDraggingWindow,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: WindowControlsProps) {
  const startPercent = (windowStart / sliderMax) * 100
  const endPercent = (windowEnd / sliderMax) * 100
  return (
    <div className="window-control">
      <div className="window-heading">
        <div>
          <b>標準差五線計算期間</b>
          <small>調整目前期間，並可加入多組期間同時比較</small>
        </div>
        <button className="add-comparison" disabled={currentWindowIsSaved} onClick={onAddComparison}>
          {currentWindowIsSaved ? '已加入目前期間' : '＋ 加入目前期間'}
        </button>
      </div>
      <div className="calculation-presets">
        {Object.entries(calculationPeriods).map(([label, count]) => (
          <button
            key={label}
            className={calculationPeriod === label ? 'active' : ''}
            onClick={() => {
              setCalculationPeriod(label as CalculationPeriod)
              setWindowStart(Math.max(0, dates.length - count))
              setWindowEnd(dates.length - 1)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {comparisonWindows.length > 0 && (
        <div className="comparison-windows">
          {comparisonWindows.map((item, index) => (
            <span
              key={item.id}
              style={{ '--comparison-color': comparisonColors[index % comparisonColors.length] } as CSSProperties}
            >
              <i />比較 {index + 1}：{dates[item.start]}～{dates[item.end]}
              <button aria-label={`移除比較期間 ${index + 1}`} onClick={() => onRemoveComparison(item.id)}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="window-slider">
        <div className="window-badges">
          <span className="window-badge start" style={{ left: `${startPercent}%` }}>
            <b>START</b>{dates[windowStart]}
          </span>
          <span className="window-badge end" style={{ left: `${endPercent}%` }}>
            <b>END</b>{dates[windowEnd]}
          </span>
        </div>
        <div className="window-track">
          <span
            className={`window-selected${isDraggingWindow ? ' dragging' : ''}`}
            aria-label="拖曳整個五線譜計算期間"
            role="slider"
            style={{ left: `${startPercent}%`, width: `${Math.max(0, endPercent - startPercent)}%` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
        <input
          className="slider-start"
          aria-label="調整五線譜開始日期"
          type="range"
          min="0"
          max={sliderMax}
          value={windowStart}
          onChange={(event) => {
            setCalculationPeriod('自訂範圍')
            setWindowStart(Math.min(Number(event.target.value), windowEnd - 2))
          }}
        />
        <input
          className="slider-end"
          aria-label="調整五線譜結束日期"
          type="range"
          min="0"
          max={sliderMax}
          value={windowEnd}
          onChange={(event) => {
            setCalculationPeriod('自訂範圍')
            setWindowEnd(Math.max(Number(event.target.value), windowStart + 2))
          }}
        />
      </div>
    </div>
  )
}