// SPDX-License-Identifier: MIT
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { MarketCard } from '../components/MarketCard'
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
        search.trim() === '' || market.question.toLowerCase().includes(search.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [markets, filter, search])

  const liveCount = markets.filter((m) => !m.resolved && now < m.endTime).length
  const totalPool = markets.reduce((acc, m) => acc + m.collateral, 0n)

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
          <p className="mt-1 text-sm text-annex-muted">
            Trade the outcome of anything. Settlement in MUSD, non-custodial.
          </p>
        </div>
        <Link
          to="/create"
          className="rounded-lg bg-annex-orange px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          Create market
        </Link>
      </div>

      {!isDeployed && (
        <div className="mb-6 rounded-xl border border-annex-orange/40 bg-annex-orange/10 px-4 py-3 text-sm text-annex-orange">
          No contract address configured. Set <code className="font-mono">VITE_ANNEX_ADDRESS</code>{' '}
          in <code className="font-mono">frontend/.env</code> and restart the dev server.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === item
                  ? 'bg-annex-orange text-black'
                  : 'bg-annex-panel text-annex-muted hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search markets…"
          className="input-field ml-auto max-w-xs"
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Markets" value={String(markets.length)} />
        <Stat label="Live" value={String(liveCount)} />
        <Stat label="Total pool" value={`${formatCompact(totalPool)} MUSD`} />
        <Stat label="Settlement" value="MUSD" />
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="panel h-44 animate-pulse bg-annex-panel/60" />
          ))}
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-annex-muted">
            {markets.length === 0
              ? 'No markets yet. Create the first one.'
              : 'No markets match your filters.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((market) => (
          <MarketCard key={market.id} market={market} now={now} />
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-annex-muted">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  )
}

function formatCompact(value: bigint): string {
  const asNumber = Number(value) / 1e18
  if (asNumber >= 1_000_000) return `${(asNumber / 1_000_000).toFixed(1)}M`
  if (asNumber >= 1_000) return `${(asNumber / 1_000).toFixed(1)}K`
  return asNumber.toFixed(0)
}
