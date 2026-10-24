// SPDX-License-Identifier: MIT
import { Link } from 'react-router-dom'

import type { Market } from '../hooks/useMarkets'
import { formatMusd, formatPercent, timeLeft } from '../lib/format'
import { ArrowUpRight, ClockIcon } from './icons'

export function PriceBar({
  priceYes,
  compact = false,
}: {
  priceYes: bigint
  compact?: boolean
}) {
  const yesPct = Number(formatPercent(priceYes, 4).replace('%', ''))
  const noPct = 100 - yesPct

  return (
    <div>
      <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-white/6">
        <div
          className="h-full bg-gradient-to-r from-annex-green/70 to-annex-green transition-all duration-500"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-annex-red to-annex-red/70 transition-all duration-500"
          style={{ width: `${noPct}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-2.5 flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-annex-green">
            <span className="h-1.5 w-1.5 rounded-full bg-annex-green shadow-[0_0_8px_rgba(62,207,142,0.7)]" />
            YES {formatPercent(priceYes, 0)}
          </span>
          <span className="flex items-center gap-1.5 text-annex-red">
            NO {formatPercent((10n ** 18n) - priceYes, 0)}
            <span className="h-1.5 w-1.5 rounded-full bg-annex-red shadow-[0_0_8px_rgba(242,85,90,0.7)]" />
          </span>
        </div>
      )}
    </div>
  )
}

export function MarketCard({ market, now }: { market: Market; now: bigint }) {
  const ended = now >= market.endTime
  const yesPct = Number(formatPercent(market.priceYes, 2).replace('%', ''))

  return (
    <Link
      to={`/market/${market.id}`}
      className="group relative block overflow-hidden rounded-4xl border border-white/6 bg-[#0d0d0f]/80 p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-annex-orange/30 hover:shadow-[0_28px_60px_-30px_rgba(247,147,26,0.55)] sm:p-6"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.16),transparent_65%)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-annex-muted">
            {market.category || 'General'}
          </span>
          {market.resolved ? (
            <span className="rounded-full border border-annex-orange/30 bg-annex-orange/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-annex-orange">
              Resolved {market.outcome === 1 ? 'Yes' : 'No'}
            </span>
          ) : ended ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-annex-muted">
              Ended
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-annex-orange/25 bg-annex-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-annex-orange-soft">
              <ClockIcon className="h-3 w-3" />
              {timeLeft(market.endTime, now)} left
            </span>
          )}
        </div>

        <h3 className="font-display mb-5 text-lg font-semibold leading-snug text-annex-ink transition-colors duration-300 group-hover:text-white sm:text-xl">
          {market.question}
        </h3>

        <PriceBar priceYes={market.priceYes} />

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-white/5 bg-white/[0.025] px-3.5 py-3">
            <span className="label-caps block">Pool</span>
            <span className="mt-1 block font-mono text-sm font-medium tabular-nums text-annex-ink">
              {formatMusd(market.collateral, 0)} <span className="text-annex-muted">MUSD</span>
            </span>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.025] px-3.5 py-3">
            <span className="label-caps block">Implied YES</span>
            <span className="mt-1 block font-mono text-sm font-medium tabular-nums text-annex-ink">
              {yesPct.toFixed(1)}%{' '}
              <span className="text-annex-muted">@{formatPercent(market.priceYes, 2)}</span>
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/6 pt-4 text-xs text-annex-muted">
          <span>
            Market <span className="font-mono text-annex-ink/80">#{market.id.toString()}</span>
          </span>
          <span className="flex items-center gap-1 font-medium text-annex-orange transition-transform duration-300 group-hover:translate-x-0.5">
            Trade
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
