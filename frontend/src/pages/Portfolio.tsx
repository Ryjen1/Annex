// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, MUSD_ADDRESS } from '../lib/contracts'
import { formatMusd, formatShares } from '../lib/format'
import { useMarkets, useUserPositions } from '../hooks/useMarkets'

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
      <div className="panel p-10 text-center">
        <h1 className="mb-2 text-lg font-semibold">Portfolio</h1>
        <p className="text-sm text-annex-muted">Connect your wallet to see your positions.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="panel px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-annex-muted">MUSD balance</div>
          <div className="mt-1 text-lg font-bold tabular-nums">{formatMusd(musdBalance)}</div>
        </div>
        <div className="panel px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-annex-muted">Positions</div>
          <div className="mt-1 text-lg font-bold tabular-nums">{rows.length}</div>
        </div>
        <div className="panel px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-annex-muted">Shares held</div>
          <div className="mt-1 text-lg font-bold tabular-nums">{formatShares(totalValue)}</div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-annex-red/40 bg-annex-red/10 px-3 py-2 text-xs text-annex-red">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel mt-6 p-10 text-center text-sm text-annex-muted">
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
              <div key={market.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/market/${market.id}`}
                      className="text-base font-semibold hover:text-annex-orange"
                    >
                      {market.question}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-annex-muted">
                      <span>
                        YES{' '}
                        <span className="font-semibold text-annex-green">
                          {formatShares(position!.yes)}
                        </span>
                      </span>
                      <span>
                        NO{' '}
                        <span className="font-semibold text-annex-red">
                          {formatShares(position!.no)}
                        </span>
                      </span>
                      <span>
                        LP{' '}
                        <span className="font-semibold text-annex-orange">
                          {formatShares(position!.lp)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {market.resolved ? (
                      <>
                        {winning > 0n && (
                          <button
                            onClick={() => run(market.id, 'redeem')}
                            disabled={busy !== null}
                            className="rounded-lg bg-annex-orange px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                          >
                            {busy === `${market.id}-redeem` ? 'Redeeming…' : 'Redeem'}
                          </button>
                        )}
                        {position!.lp > 0n && (
                          <button
                            onClick={() => run(market.id, 'claim')}
                            disabled={busy !== null}
                            className="rounded-lg border border-annex-orange px-4 py-2 text-sm font-semibold text-annex-orange disabled:opacity-50"
                          >
                            {busy === `${market.id}-claim` ? 'Claiming…' : 'Claim LP'}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-annex-muted">
                        {market.collateral > 0n ? 'Open position' : ''}
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
