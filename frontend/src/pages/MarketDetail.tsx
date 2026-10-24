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
    return <div className="panel h-64 animate-pulse" />
  }

  if (!market) {
    return (
      <div className="panel p-10 text-center text-sm text-annex-muted">
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
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <Link to="/" className="mb-4 inline-block text-sm text-annex-muted hover:text-white">
          ← All markets
        </Link>

        <div className="panel p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-annex-panel-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-annex-muted">
              {market.category || 'General'}
            </span>
            {market.resolved ? (
              <span className="rounded-md bg-annex-orange/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-annex-orange">
                Resolved {market.outcome === OUTCOME.Yes ? 'YES' : 'NO'}
              </span>
            ) : (
              <span className="rounded-md bg-annex-panel-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-annex-muted">
                {ended ? 'Ended — awaiting resolution' : `${timeLeft(market.endTime, now)} left`}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold leading-snug">{market.question}</h1>
          {market.description && (
            <p className="mt-3 text-sm leading-relaxed text-annex-muted">{market.description}</p>
          )}

          <div className="mt-6">
            <PriceBar priceYes={market.priceYes} />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Detail label="Pool" value={`${formatMusd(market.collateral, 0)} MUSD`} />
            <Detail label="YES price" value={formatPercent(market.priceYes)} />
            <Detail label="NO price" value={formatPercent(market.priceNo)} />
            <Detail label="Closes" value={formatDate(market.endTime)} />
            <Detail
              label="Creator"
              value={
                <a
                  href={explorerAddress(market.creator)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-annex-orange hover:underline"
                >
                  {shortAddress(market.creator)}
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
                  className="text-annex-orange hover:underline"
                >
                  {shortAddress(market.resolver)}
                </a>
              }
            />
            <Detail label="YES shares" value={formatShares(market.totalYes)} />
            <Detail label="NO shares" value={formatShares(market.totalNo)} />
          </dl>

          {status && (
            <div className="mt-5 rounded-lg border border-annex-border bg-annex-panel-2 px-3 py-2 text-xs text-annex-muted">
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

        <div className="panel mt-6 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-annex-muted">
            Your position
          </h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Detail label="YES" value={formatShares(yesShares)} />
            <Detail label="NO" value={formatShares(noShares)} />
            <Detail label="LP" value={formatShares(lpShares)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {market.resolved && winningShares > 0n && (
              <button
                onClick={() => run('redeem')}
                disabled={status === 'pending'}
                className="rounded-lg bg-annex-orange px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                Redeem {formatShares(winningShares)} MUSD
              </button>
            )}
            {market.resolved && lpShares > 0n && (
              <button
                onClick={() => run('claim')}
                disabled={status === 'pending'}
                className="rounded-lg border border-annex-orange px-4 py-2 text-sm font-semibold text-annex-orange disabled:opacity-50"
              >
                Claim LP
              </button>
            )}
            {canResolve && (
              <>
                <button
                  onClick={() => run('resolve', OUTCOME.Yes)}
                  disabled={status === 'pending'}
                  className="rounded-lg border border-annex-green px-4 py-2 text-sm font-semibold text-annex-green disabled:opacity-50"
                >
                  Resolve YES
                </button>
                <button
                  onClick={() => run('resolve', OUTCOME.No)}
                  disabled={status === 'pending'}
                  className="rounded-lg border border-annex-red px-4 py-2 text-sm font-semibold text-annex-red disabled:opacity-50"
                >
                  Resolve NO
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        <TradePanel market={market} now={now} />
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-annex-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
