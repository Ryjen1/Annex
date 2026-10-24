// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'

import { PriceBar } from '../components/MarketCard'
import { TradePanel } from '../components/TradePanel'
import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, OUTCOME } from '../lib/contracts'
import { explorerAddress } from '../lib/chains'
import { formatDate, formatMusd, formatPercent, formatShares, shortAddress, timeLeft } from '../lib/format'
import { useMarket } from '../hooks/useMarkets'
import { useNow } from '../hooks/useNow'
import { ArrowLeft, ClockIcon, ExternalIcon, ShieldIcon } from '../components/icons'

export function MarketDetail() {
  const { id } = useParams()
  const marketId = id !== undefined ? BigInt(id) : undefined
  const { market, isLoading } = useMarket(marketId)
  const now = useNow()
  const { address } = useAccount()
  const publicClient = usePublicClient()

  const [status, setStatus] = useState<string | null>(null)
  const resolveWrite = useWriteContract()
  const claimWrite = useWriteContract()
  const redeemWrite = useWriteContract()

  const { data: owner } = useReadContract({
    address: ANNEX_ADDRESS,
    abi: annexMarketAbi,
    functionName: 'owner',
  })

  const { data: position } = useReadContract({
    address: ANNEX_ADDRESS,
    abi: annexMarketAbi,
    functionName: 'getUserPosition',
    args: marketId !== undefined ? [marketId, address ?? '0x0'] : undefined,
    query: { enabled: marketId !== undefined && Boolean(address) },
  })

  if (isLoading) {
    return <div className="shimmer-skeleton h-96 rounded-4xl border border-white/6" />
  }

  if (!market) {
    return (
      <div className="glass rounded-4xl p-12 text-center text-sm text-annex-muted">
        Market not found.{' '}
        <Link to="/" className="text-annex-orange underline">
          Back to markets
        </Link>
      </div>
    )
  }

  const yesShares = position?.[0] ?? 0n
  const noShares = position?.[1] ?? 0n
  const lpShares = position?.[2] ?? 0n

  const isResolver =
    Boolean(address) &&
    (address?.toLowerCase() === market.resolver.toLowerCase() ||
      address?.toLowerCase() === market.creator.toLowerCase() ||
      (owner && address?.toLowerCase() === owner.toLowerCase()))

  const ended = now >= market.endTime
  const canResolve = isResolver && !market.resolved && (ended || (owner && address?.toLowerCase() === owner.toLowerCase()))

  async function run(action: 'resolve' | 'redeem' | 'claim', outcome?: number) {
    if (!publicClient) return
    setStatus('pending')
    try {
      const hash =
        action === 'resolve'
          ? await resolveWrite.writeContractAsync({
              address: ANNEX_ADDRESS,
              abi: annexMarketAbi,
              functionName: 'resolve',
              args: [market!.id, outcome ?? OUTCOME.Yes],
            })
          : action === 'redeem'
            ? await redeemWrite.writeContractAsync({
                address: ANNEX_ADDRESS,
                abi: annexMarketAbi,
                functionName: 'redeem',
                args: [market!.id],
              })
            : await claimWrite.writeContractAsync({
                address: ANNEX_ADDRESS,
                abi: annexMarketAbi,
                functionName: 'claimLp',
                args: [market!.id],
              })
      await publicClient.waitForTransactionReceipt({ hash })
      setStatus(action === 'resolve' ? 'resolved' : 'done')
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split('\n')[0].slice(0, 120) : 'failed')
    }
  }

  const winningShares = market.outcome === OUTCOME.Yes ? yesShares : noShares

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-annex-muted transition-colors hover:text-annex-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          All markets
        </Link>

        <div className="glass animate-fade-up rounded-4xl p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-annex-muted">
              {market.category || 'General'}
            </span>
            {market.resolved ? (
              <span className="rounded-full border border-annex-orange/30 bg-annex-orange/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-annex-orange">
                Resolved {market.outcome === OUTCOME.Yes ? 'Yes' : 'No'}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-annex-orange/25 bg-annex-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-annex-orange-soft">
                <ClockIcon className="h-3 w-3" />
                {ended ? 'Ended — awaiting resolution' : `${timeLeft(market.endTime, now)} left`}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-semibold leading-snug text-annex-ink sm:text-3xl">
            {market.question}
          </h1>
          {market.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-annex-muted">
              {market.description}
            </p>
          )}

          <div className="mt-7">
            <PriceBar priceYes={market.priceYes} />
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail label="Pool" value={`${formatMusd(market.collateral, 0)} MUSD`} />
            <Detail label="YES price" value={formatPercent(market.priceYes)} tone="green" />
            <Detail label="NO price" value={formatPercent(market.priceNo)} tone="red" />
            <Detail label="Closes" value={formatDate(market.endTime)} />
            <Detail
              label="Creator"
              value={
                <a
                  href={explorerAddress(market.creator)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-annex-orange hover:underline"
                >
                  {shortAddress(market.creator)}
                  <ExternalIcon className="h-3 w-3" />
                </a>
              }
            />
            <Detail
              label="Resolver"
              value={
                <a
                  href={explorerAddress(market.resolver)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-annex-orange hover:underline"
                >
                  {shortAddress(market.resolver)}
                  <ExternalIcon className="h-3 w-3" />
                </a>
              }
            />
            <Detail label="YES shares" value={formatShares(market.totalYes)} />
            <Detail label="NO shares" value={formatShares(market.totalNo)} />
          </dl>

          {status && (
            <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs text-annex-muted">
              {status === 'pending'
                ? 'Waiting for confirmation…'
                : status === 'resolved'
                  ? 'Market resolved.'
                  : status === 'done'
                    ? 'Transaction confirmed.'
                    : status}
            </div>
          )}
        </div>

        <div className="glass animate-fade-up rounded-4xl p-6 [animation-delay:80ms] sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-annex-muted">
              Your position
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] text-annex-muted">
              <ShieldIcon className="h-3.5 w-3.5 text-annex-orange" />
              On-chain
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Pos label="YES" value={formatShares(yesShares)} tone="green" />
            <Pos label="NO" value={formatShares(noShares)} tone="red" />
            <Pos label="LP" value={formatShares(lpShares)} tone="orange" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {market.resolved && winningShares > 0n && (
              <button
                onClick={() => run('redeem')}
                disabled={status === 'pending'}
                className="btn-primary btn-primary-hover px-4 py-2.5 text-sm"
              >
                Redeem {formatShares(winningShares)} MUSD
              </button>
            )}
            {market.resolved && lpShares > 0n && (
              <button
                onClick={() => run('claim')}
                disabled={status === 'pending'}
                className="rounded-xl border border-annex-orange/50 px-4 py-2.5 text-sm font-semibold text-annex-orange transition-colors hover:bg-annex-orange/10 disabled:opacity-50"
              >
                Claim LP
              </button>
            )}
            {canResolve && (
              <>
                <button
                  onClick={() => run('resolve', OUTCOME.Yes)}
                  disabled={status === 'pending'}
                  className="rounded-xl border border-annex-green/50 px-4 py-2.5 text-sm font-semibold text-annex-green transition-colors hover:bg-annex-green/10 disabled:opacity-50"
                >
                  Resolve YES
                </button>
                <button
                  onClick={() => run('resolve', OUTCOME.No)}
                  disabled={status === 'pending'}
                  className="rounded-xl border border-annex-red/50 px-4 py-2.5 text-sm font-semibold text-annex-red transition-colors hover:bg-annex-red/10 disabled:opacity-50"
                >
                  Resolve NO
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <TradePanel market={market} now={now} />
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string
  value: React.ReactNode
  tone?: 'green' | 'red' | 'orange'
}) {
  const toneClass =
    tone === 'green'
      ? 'text-annex-green'
      : tone === 'red'
        ? 'text-annex-red'
        : tone === 'orange'
          ? 'text-annex-orange'
          : 'text-annex-ink'

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.025] px-3.5 py-3">
      <dt className="label-caps">{label}</dt>
      <dd className={`mt-1 font-mono text-sm font-medium tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  )
}

function Pos({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'green' | 'red' | 'orange'
}) {
  const toneClass =
    tone === 'green'
      ? 'text-annex-green'
      : tone === 'red'
        ? 'text-annex-red'
        : 'text-annex-orange'

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.025] px-3.5 py-3">
      <span className="label-caps">{label}</span>
      <div className={`mt-1 font-mono text-base font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}
