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
      <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full bg-gradient-to-r from-annex-green/60 to-annex-green transition-all duration-500"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-annex-red to-annex-red/60 transition-all duration-500"
          style={{ width: `${noPct}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-3 flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-annex-green">
            <span className="h-2 w-2 rounded-full bg-annex-green shadow-[0_0_10px_rgba(62,207,142,0.8)]" />
            YES {formatPercent(priceYes, 0)}
          </span>
          <span className="flex items-center gap-2 text-annex-red">
            NO {formatPercent((10n ** 18n) - priceYes, 0)}
            <span className="h-2 w-2 rounded-full bg-annex-red shadow-[0_0_10px_rgba(242,85,90,0.8)]" />
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
      className="group relative block overflow-hidden rounded-4xl border border-white/6 bg-[#0a0b1c]/80 p-7 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1.5 hover:border-annex-orange/25 hover:shadow-[0_30px_70px_-35px_rgba(247,147,26,0.6)] sm:p-8"
    >
      <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.16),transparent_65%)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/60 uppercase">
            {market.category || 'General'}
          </span>
          {market.resolved ? (
            <span className="rounded-full border border-annex-orange/30 bg-annex-orange/12 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-annex-orange uppercase">
              Resolved {market.outcome === 1 ? 'Yes' : 'No'}
            </span>
          ) : ended ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/50 uppercase">
              Ended
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-annex-orange/25 bg-annex-orange/10 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-annex-orange-soft uppercase">
              <ClockIcon className="h-3 w-3" />
              {timeLeft(market.endTime, now)} left
            </span>
          )}
        </div>

        <h3 className="font-display mb-6 text-xl leading-snug font-semibold tracking-[-0.02em] text-white transition-colors duration-300 group-hover:text-annex-orange-soft sm:text-2xl">
          {market.question}
        </h3>

        <PriceBar priceYes={market.priceYes} />

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5">
            <span className="label-caps block">Pool</span>
            <span className="font-mono mt-1 block text-sm font-medium tabular-nums">
              {formatMusd(market.collateral, 0)} <span className="text-white/35">MUSD</span>
            </span>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5">
            <span className="label-caps block">Implied YES</span>
            <span className="font-mono mt-1 block text-sm font-medium tabular-nums">
              {yesPct.toFixed(1)}% <span className="text-white/35">@{formatPercent(market.priceYes, 2)}</span>
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/6 pt-5 text-xs text-white/40">
          <span>
            Market <span className="font-mono text-white/70">#{market.id.toString()}</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-annex-orange transition-transform duration-300 group-hover:translate-x-0.5">
            Trade
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
