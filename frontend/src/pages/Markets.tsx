// SPDX-License-Identifier: MIT
import { useMemo, useState } from 'react'

import { MarketCard } from '../components/MarketCard'
import { SearchIcon } from '../components/icons'
import { useMarkets } from '../hooks/useMarkets'
import { useNow } from '../hooks/useNow'

const FILTERS = ['All', 'BTC Price', 'Mezo', 'Crypto', 'Other']

export function Markets() {
  const { markets, isLoading } = useMarkets()
  const now = useNow()
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    return markets.filter((market) => {
      const matchesFilter = filter === 'All' || market.category === filter
      const matchesSearch =
        search.trim() === '' || market.question.toLowerCase().includes(search.trim().toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [markets, filter, search])

  const liveCount = markets.filter((m) => !m.resolved && now < m.endTime).length
  const totalPool = markets.reduce((acc, m) => acc + m.collateral, 0n)
  const resolvedCount = markets.filter((m) => m.resolved).length

  return (
    <div className="shell pb-24 pt-32 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-2xl">
          <span className="label-caps">Markets</span>
          <h1 className="font-display mt-4 text-4xl leading-[1.02] font-bold tracking-[-0.035em] text-white sm:text-6xl">
            Trade the outcome
            <span className="text-gradient-brand"> of anything</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/50">
            Every market is a pool of YES and NO shares priced by an on-chain constant-product
            AMM. Settlement is 1:1 in MUSD, straight from the contract.
          </p>
        </div>
      </div>

      <div className="animate-fade-up mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Markets" value={String(markets.length)} hint="created" />
        <Stat label="Live now" value={String(liveCount)} hint="open for trading" accent />
        <Stat label="Total pool" value={`${formatCompact(totalPool)}`} hint="MUSD committed" />
        <Stat label="Resolved" value={String(resolvedCount)} hint="settled in MUSD" />
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
                filter === item
                  ? 'bg-annex-orange text-black shadow-[0_0_30px_-6px_rgba(247,147,26,0.9)]'
                  : 'border border-white/8 bg-white/4 text-white/50 hover:border-white/15 hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search markets…"
            className="input-field focus:input-field-focus pl-11"
          />
        </div>
      </div>

      {isLoading && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="shimmer-skeleton h-80 rounded-4xl border border-white/6" />
          ))}
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="panel mt-8 p-16 text-center">
          <p className="text-sm text-white/45">
            {markets.length === 0
              ? 'No markets yet. Create the first one.'
              : 'No markets match your filters.'}
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {visible.map((market) => (
          <MarketCard key={market.id} market={market} now={now} />
        ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: string
  hint: string
  accent?: boolean
}) {
  return (
    <div className="glass rounded-3xl px-5 py-5">
      <span className="label-caps">{label}</span>
      <div
        className={`font-display mt-2 text-3xl font-bold tracking-[-0.02em] tabular-nums ${
          accent ? 'text-gradient-brand' : 'text-white'
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-white/35">{hint}</div>
    </div>
  )
}

function formatCompact(value: bigint): string {
  const asNumber = Number(value) / 1e18
  if (asNumber >= 1_000_000) return `${(asNumber / 1_000_000).toFixed(1)}M`
  if (asNumber >= 1_000) return `${(asNumber / 1_000).toFixed(1)}K`
  return asNumber.toFixed(0)
}
