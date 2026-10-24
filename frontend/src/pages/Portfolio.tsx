// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, MUSD_ADDRESS } from '../lib/contracts'
import { formatMusd, formatShares } from '../lib/format'
import { useMarkets, useUserPositions } from '../hooks/useMarkets'
import { ArrowUpRight } from '../components/icons'

export function Portfolio() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { markets } = useMarkets()
  const { positions } = useUserPositions(address)

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const redeemWrite = useWriteContract()
  const claimWrite = useWriteContract()

  const { data: musdBalance } = useReadContract({
    address: MUSD_ADDRESS,
    abi: [
      {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
      },
    ],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })

  const rows = markets
    .map((market) => ({ market, position: positions[market.id.toString()] }))
    .filter(
      (row) =>
        row.position &&
        (row.position.yes > 0n || row.position.no > 0n || row.position.lp > 0n),
    )

  const totalValue = rows.reduce((acc, row) => {
    const { yes, no } = row.position!
    const value =
      row.market.outcome === 1
        ? yes + (row.market.resolved ? no * 0n : no)
        : no + (row.market.resolved ? yes * 0n : yes)
    return acc + value
  }, 0n)

  async function run(id: bigint, action: 'redeem' | 'claim') {
    if (!publicClient) return
    setBusy(`${id}-${action}`)
    setError(null)
    try {
      const hash =
        action === 'redeem'
          ? await redeemWrite.writeContractAsync({
              address: ANNEX_ADDRESS,
              abi: annexMarketAbi,
              functionName: 'redeem',
              args: [id],
            })
          : await claimWrite.writeContractAsync({
              address: ANNEX_ADDRESS,
              abi: annexMarketAbi,
              functionName: 'claimLp',
              args: [id],
            })
      await publicClient.waitForTransactionReceipt({ hash })
    } catch (err) {
      setError(err instanceof Error ? err.message.split('\n')[0].slice(0, 140) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="glass mt-10 rounded-4xl p-12 text-center">
        <h1 className="font-display mb-2 text-2xl font-semibold">Portfolio</h1>
        <p className="text-sm text-annex-muted">Connect your wallet to see your positions.</p>
      </div>
    )
  }

  return (
    <div className="pb-16">
      <div className="animate-fade-up pt-10 sm:pt-14">
        <h1 className="font-display text-3xl font-bold tracking-tight text-annex-ink sm:text-4xl">
          Your <span className="text-gradient">portfolio</span>
        </h1>
        <p className="mt-2 text-sm text-annex-muted">
          Positions read straight from the contract. Redeem winning shares for MUSD at any time.
        </p>
      </div>

      <div className="animate-fade-up mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 [animation-delay:60ms]">
        <Stat label="MUSD balance" value={formatMusd(musdBalance)} />
        <Stat label="Positions" value={String(rows.length)} />
        <Stat label="Shares held" value={formatShares(totalValue)} accent />
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-annex-red/40 bg-annex-red/10 px-3 py-2.5 text-xs text-annex-red">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="glass mt-6 rounded-4xl p-12 text-center text-sm text-annex-muted">
          No positions yet.{' '}
          <Link to="/" className="text-annex-orange underline">
            Browse markets
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map(({ market, position }) => {
            const winning = market.outcome === 1 ? position!.yes : position!.no
            return (
              <div
                key={market.id}
                className="glass group rounded-4xl p-5 transition-colors hover:border-annex-orange/25 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/market/${market.id}`}
                      className="font-display inline-flex items-start gap-1.5 text-base font-semibold text-annex-ink transition-colors hover:text-annex-orange sm:text-lg"
                    >
                      {market.question}
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip label="YES" value={formatShares(position!.yes)} tone="green" />
                      <Chip label="NO" value={formatShares(position!.no)} tone="red" />
                      <Chip label="LP" value={formatShares(position!.lp)} tone="orange" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {market.resolved ? (
                      <>
                        {winning > 0n && (
                          <button
                            onClick={() => run(market.id, 'redeem')}
                            disabled={busy !== null}
                            className="btn-primary btn-primary-hover px-4 py-2.5 text-sm"
                          >
                            {busy === `${market.id}-redeem` ? 'Redeeming…' : 'Redeem'}
                          </button>
                        )}
                        {position!.lp > 0n && (
                          <button
                            onClick={() => run(market.id, 'claim')}
                            disabled={busy !== null}
                            className="rounded-xl border border-annex-orange/50 px-4 py-2.5 text-sm font-semibold text-annex-orange transition-colors hover:bg-annex-orange/10 disabled:opacity-50"
                          >
                            {busy === `${market.id}-claim` ? 'Claiming…' : 'Claim LP'}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-[11px] uppercase tracking-widest text-annex-muted">
                        Open position
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="glass rounded-2xl px-4 py-4">
      <span className="label-caps">{label}</span>
      <div
        className={`font-display mt-1.5 text-2xl font-semibold tabular-nums ${
          accent ? 'text-gradient' : 'text-annex-ink'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function Chip({
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
      ? 'border-annex-green/25 bg-annex-green/10 text-annex-green'
      : tone === 'red'
        ? 'border-annex-red/25 bg-annex-red/10 text-annex-red'
        : 'border-annex-orange/25 bg-annex-orange/10 text-annex-orange'

  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] tabular-nums ${toneClass}`}
    >
      {label} {value}
    </span>
  )
}
