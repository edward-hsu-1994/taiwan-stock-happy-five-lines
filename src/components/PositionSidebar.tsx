import { AnimatedContent } from './reactbits/AnimatedContent'
import type { FiveLineResult, LohuoChannelResult, Stock } from '../data/stocks'
import { lineLabels } from '../data/stocks'

export type PositionSidebarProps = {
  stock: Stock
  analysis: FiveLineResult
  currentLine: number
  zone: string
  distanceToTrend: number
  lohuoChannel: LohuoChannelResult
  money: (value: number) => string
}

export function PositionSidebar({ stock, analysis, currentLine, zone, distanceToTrend, lohuoChannel, money }: PositionSidebarProps) {
  return (
    <aside className="sidebar">
      <AnimatedContent className="position-card">
        <div className="position-top">
          <div>
            <small>目前價格位置</small>
            <h3>{zone}</h3>
          </div>
          <span className="compass">⌁</span>
        </div>
        <div className="five-meter">
          {analysis.lines.map((line, index) => (
            <div
              key={line}
              className={analysis.lines[index] === currentLine ? 'selected' : ''}
              style={{ left: `${index * 25}%` }}
            >
              <i />
              <small>{lineLabels[index]}</small>
            </div>
          ))}
          <span
            className="current-pin"
            style={{
              left: `${Math.max(
                0,
                Math.min(
                  100,
                  ((stock.price - analysis.lines[0]) / (analysis.lines[4] - analysis.lines[0])) * 100,
                ),
              )}%`,
            }}
          />
        </div>
        <div className="position-foot">
          <span>低估</span>
          <span>合理</span>
          <span>高估</span>
        </div>
        <p className="position-note">
          距離中線 <b>{distanceToTrend >= 0 ? '+' : ''}{distanceToTrend.toFixed(1)}%</b>
        </p>
      </AnimatedContent>
      <AnimatedContent className="line-card">
        <div className="section-title">
          <h3>標準差五線</h3>
          <span>R² {(analysis.rSquared * 100).toFixed(0)}% · CV {(analysis.cv * 100).toFixed(1)}%</span>
        </div>
        {analysis.lines.map((line, index) => (
          <div className={`line-item ${index === 2 ? 'fair' : ''}`} key={line}>
            <span className="line-dot" />
            <span>{lineLabels[index]}</span>
            <strong>{money(line)}</strong>
          </div>
        ))}
        <p className="method-note">依目前拖曳選定的期間做線性回歸：趨勢線 TL 上下各加減 1SD、2SD。R² 越高，趨勢參考性越強。</p>
      </AnimatedContent>
      <AnimatedContent className="line-card lohuo-card">
        <div className="section-title">
          <h3>20週標準差通道</h3>
          <span>20 週均線 · {lohuoChannel.period} 日</span>
        </div>
        <div className="line-item">
          <span className="line-dot" />
          <span>+2σ</span>
          <strong>{money(lohuoChannel.upper)}</strong>
        </div>
        <div className="line-item fair">
          <span className="line-dot" />
          <span>20週均線</span>
          <strong>{money(lohuoChannel.middle)}</strong>
        </div>
        <div className="line-item">
          <span className="line-dot" />
          <span>-2σ</span>
          <strong>{money(lohuoChannel.lower)}</strong>
        </div>
        <div className="channel-metrics">
          <span>Bandwidth <b>{(lohuoChannel.bandwidth * 100).toFixed(1)}%</b></span>
          <span>%b <b>{lohuoChannel.percentB.toFixed(2)}</b></span>
        </div>
        <p className="method-note">以最近 20 週收盤價計算中軌與上下 2 倍標準差。%b 越接近 1 越靠近上軌，越接近 0 越靠近下軌。</p>
      </AnimatedContent>
    </aside>
  )
}