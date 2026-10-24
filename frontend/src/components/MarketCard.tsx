// SPDX-License-Identifier: MIT
import { Link } from 'react-router-dom'

import type { Market } from '../hooks/useMarkets'
import { formatMusd, formatPercent, timeLeft } from '../lib/format'

export function PriceBar({ priceYes, compact = false }: { priceYes: bigint; compact?: boolean }) {
  const yesPct = Number(formatPercent(priceYes, 4).replace('%', ''))
  const noPct = 100 - yesPct

  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-annex-panel-2">
        <div className="bg-annex-green transition-all" style={{ width: `${yesPct}%` }} />
        <div className="bg-annex-red transition-all" style={{ width: `${noPct}%` }} />
      </div>
      {!compact && (
        <div className="mt-1.5 flex justify-between text-xs font-medium">
          <span className="text-annex-green">YES {formatPercent(priceYes, 0)}</span>
          <span className="text-annex-red">NO {formatPercent((10n ** 18n) - priceYes, 0)}</span>
        </div>
      )}
    </div>
  )
}

export function MarketCard({ market, now }: { market: Market; now: bigint }) {
  const ended = now >= market.endTime

  return (
    <Link
      to={`/market/${market.id}`}
      className="panel block p-5 transition-colors hover:border-annex-orange/60"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md bg-annex-panel-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-annex-muted">
          {market.category || 'General'}
        </span>
        {market.resolved ? (
          <span className="rounded-md bg-annex-orange/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-annex-orange">
            Resolved {market.outcome === 1 ? 'YES' : 'NO'}
          </span>
        ) : ended ? (
          <span className="rounded-md bg-annex-panel-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-annex-muted">
            Ended
          </span>
        ) : (
          <span className="rounded-md bg-annex-panel-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-annex-muted">
            {timeLeft(market.endTime, now)} left
          </span>
        )}
      </div>

      <h3 className="mb-3 text-base font-semibold leading-snug text-white">{market.question}</h3>

      <PriceBar priceYes={market.priceYes} />

      <div className="mt-4 flex items-center justify-between text-xs text-annex-muted">
        <span>
          Pool <span className="font-semibold text-annex-orange">{formatMusd(market.collateral, 0)} MUSD</span>
        </span>
        <span>
          YES <span className="font-semibold text-annex-green">{formatPercent(market.priceYes, 0)}</span>
          {' · '}
          NO <span className="font-semibold text-annex-red">{formatPercent(market.priceNo, 0)}</span>
        </span>
      </div>
    </Link>
  )
}
