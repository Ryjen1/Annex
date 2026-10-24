// SPDX-License-Identifier: MIT
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { MarketCard } from '../components/MarketCard'
import { PlusIcon, SearchIcon } from '../components/icons'
import { useMarkets } from '../hooks/useMarkets'
import { useNow } from '../hooks/useNow'
import { isDeployed } from '../lib/contracts'

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
    <div className="pb-16">
      <section className="animate-fade-up relative pt-10 pb-10 sm:pt-16 sm:pb-14">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.14),transparent_68%)] blur-3xl" />

        <div className="relative max-w-3xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-annex-orange/25 bg-annex-orange/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-annex-orange-soft">
            <span className="animate-pulse-ring h-1.5 w-1.5 rounded-full bg-annex-orange" />
            Live on Mezo Testnet
          </span>

          <h1 className="font-display text-4xl font-bold leading-[1.02] tracking-tight text-annex-ink sm:text-6xl">
            Trade the outcome
            <span className="text-gradient"> of anything</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-annex-muted sm:text-lg">
            Permissionless binary prediction markets. Create a question, take YES or NO against
            an on-chain AMM, settle 1:1 in MUSD. No custody, no operator, no order book.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/create"
              className="btn-primary btn-primary-hover inline-flex items-center gap-2 px-5 py-3 text-sm"
            >
              <PlusIcon className="h-4 w-4" />
              Create a market
            </Link>
            <a
              href="https://github.com/Ryjen1/Annex"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[0.875rem] border border-white/10 bg-white/4 px-5 py-3 text-sm font-medium text-annex-ink transition-colors hover:border-annex-orange/40 hover:text-white"
            >
              Read the docs
            </a>
          </div>
        </div>
      </section>

      <div className="animate-fade-up grid grid-cols-2 gap-3 sm:grid-cols-4 [animation-delay:80ms]">
        <Stat label="Markets" value={String(markets.length)} hint="created" />
        <Stat label="Live now" value={String(liveCount)} hint="open for trading" accent />
        <Stat label="Total pool" value={`${formatCompact(totalPool)}`} hint="MUSD committed" />
        <Stat label="Resolved" value={String(resolvedCount)} hint="settled in MUSD" />
      </div>

      {!isDeployed && (
        <div className="mt-6 rounded-2xl border border-annex-orange/40 bg-annex-orange/10 px-4 py-3 text-sm text-annex-orange">
          No contract address configured. Set <code className="font-mono">VITE_ANNEX_ADDRESS</code>{' '}
          in <code className="font-mono">frontend/.env</code> and restart the dev server.
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                filter === item
                  ? 'bg-annex-orange text-black shadow-[0_10px_26px_-12px_rgba(247,147,26,0.9)]'
                  : 'border border-white/8 bg-white/4 text-annex-muted hover:border-white/15 hover:text-annex-ink'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-annex-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search markets…"
            className="input-field focus:input-field-focus pl-10"
          />
        </div>
      </div>

      {isLoading && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="shimmer-skeleton h-64 rounded-4xl border border-white/6" />
          ))}
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="panel mt-6 p-12 text-center">
          <p className="text-sm text-annex-muted">
            {markets.length === 0
              ? 'No markets yet. Create the first one.'
              : 'No markets match your filters.'}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
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
    <div className="glass rounded-2xl px-4 py-4">
      <span className="label-caps">{label}</span>
      <div
        className={`mt-1.5 font-display text-2xl font-semibold tabular-nums sm:text-3xl ${
          accent ? 'text-gradient' : 'text-annex-ink'
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-annex-muted">{hint}</div>
    </div>
  )
}

function formatCompact(value: bigint): string {
  const asNumber = Number(value) / 1e18
  if (asNumber >= 1_000_000) return `${(asNumber / 1_000_000).toFixed(1)}M`
  if (asNumber >= 1_000) return `${(asNumber / 1_000).toFixed(1)}K`
  return asNumber.toFixed(0)
}
