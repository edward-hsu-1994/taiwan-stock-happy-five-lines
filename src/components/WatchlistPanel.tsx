import type { WatchlistEntry } from '../data/stocks'

export type WatchlistPanelProps = {
  watchlist: WatchlistEntry[]
  activeCode: string | undefined
  onChoose: (item: WatchlistEntry) => void
  onRetry?: () => void
  error?: string | null
}

export function WatchlistPanel({ watchlist, activeCode, onChoose, onRetry, error }: WatchlistPanelProps) {
  return (
    <aside className="watchlist-panel">
      <div className="watchlist-heading">
        <span>WATCHLIST</span>
        <b>股票清單</b>
      </div>
      {error ? (
        <div className="error-card watchlist-error">
          {error}
          {onRetry && (
            <button type="button" onClick={onRetry}>重試</button>
          )}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="loading-card watchlist-loading">
          <span className="pulse-dot" />股票清單載入中…
        </div>
      ) : (
        <div className="watchlist-items">
          {watchlist.map((item) => (
            <button
              key={`${item.market}-${item.code}`}
              className={item.code === activeCode ? 'active' : ''}
              onClick={() => onChoose(item)}
            >
              <span><b>{item.code}</b><em>{item.name}</em></span>
              <small>{item.market}</small>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}