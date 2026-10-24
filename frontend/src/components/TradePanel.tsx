// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, MUSD_ADDRESS, OUTCOME } from '../lib/contracts'
import { formatMusd, formatShares, parseMusdInput } from '../lib/format'
import type { Market } from '../hooks/useMarkets'

type Side = typeof OUTCOME.Yes | typeof OUTCOME.No

export function TradePanel({ market, now }: { market: Market; now: bigint }) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const [side, setSide] = useState<Side>(OUTCOME.Yes)
  const [amount, setAmount] = useState('10')
  const [status, setStatus] = useState<'idle' | 'approving' | 'buying'>('idle')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const parsed = parseMusdInput(amount)

  const { data: allowance } = useReadContract({
    address: MUSD_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, ANNEX_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  })

  const { data: quote, isFetching: quoteLoading } = useReadContract({
    address: ANNEX_ADDRESS,
    abi: annexMarketAbi,
    functionName: 'getBuyQuote',
    args: [market.id, side, parsed],
    query: { enabled: parsed > 0n && ANNEX_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  const approveWrite = useWriteContract()
  const buyWrite = useWriteContract()

  const closed = market.resolved || now >= market.endTime
  const needsApproval = (allowance ?? 0n) < parsed
  const busy = status !== 'idle'

  async function handleBuy() {
    if (!address || !publicClient) return
    setMessage(null)
    try {
      if (needsApproval) {
        setStatus('approving')
        const approveHash = await approveWrite.writeContractAsync({
          address: MUSD_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ANNEX_ADDRESS, parsed],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      setStatus('buying')
      const buyHash = await buyWrite.writeContractAsync({
        address: ANNEX_ADDRESS,
        abi: annexMarketAbi,
        functionName: 'buyShares',
        args: [market.id, side, parsed],
      })
      await publicClient.waitForTransactionReceipt({ hash: buyHash })
      setStatus('idle')
      setMessage({
        tone: 'ok',
        text: `Bought ${formatShares(quote)} ${side === OUTCOME.Yes ? 'YES' : 'NO'} shares`,
      })
    } catch (error) {
      setStatus('idle')
      setMessage({ tone: 'error', text: shortenError(error) })
    }
  }

  const yesPrice = Number(market.priceYes) / 1e18 * 100
  const noPrice = Number(market.priceNo) / 1e18 * 100

  return (
    <div className="panel p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-annex-muted">
        Trade
      </h2>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide(OUTCOME.Yes)}
          disabled={closed}
          className={`rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            side === OUTCOME.Yes
              ? 'border-annex-green bg-annex-green/10'
              : 'border-annex-border bg-annex-panel-2 hover:border-annex-green/50'
          }`}
        >
          <div className="text-sm font-semibold text-annex-green">YES</div>
          <div className="text-xl font-bold tabular-nums">{yesPrice.toFixed(1)}%</div>
        </button>
        <button
          onClick={() => setSide(OUTCOME.No)}
          disabled={closed}
          className={`rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            side === OUTCOME.No
              ? 'border-annex-red bg-annex-red/10'
              : 'border-annex-border bg-annex-panel-2 hover:border-annex-red/50'
          }`}
        >
          <div className="text-sm font-semibold text-annex-red">NO</div>
          <div className="text-xl font-bold tabular-nums">{noPrice.toFixed(1)}%</div>
        </button>
      </div>

      <label className="mb-1 block text-xs font-medium text-annex-muted" htmlFor="amount">
        Amount (MUSD)
      </label>
      <div className="relative">
        <input
          id="amount"
          type="number"
          min="0"
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={closed}
          className="input-field pr-16 tabular-nums disabled:opacity-50"
          placeholder="0.0"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-annex-muted">
          MUSD
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-annex-muted">
          <span>You receive</span>
          <span className="font-medium text-white tabular-nums">
            {quoteLoading ? '…' : `${formatShares(quote)} ${side === OUTCOME.Yes ? 'YES' : 'NO'}`}
          </span>
        </div>
        <div className="flex justify-between text-annex-muted">
          <span>Average price</span>
          <span className="font-medium text-white tabular-nums">
            {quote && quote > 0n
              ? `${((Number(parsed) / Number(quote)) * 100).toFixed(2)}¢`
              : '—'}
          </span>
        </div>
        <div className="flex justify-between text-annex-muted">
          <span>Max payout</span>
          <span className="font-medium text-white tabular-nums">
            {formatMusd(quote)} MUSD
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            message.tone === 'ok'
              ? 'border-annex-green/40 bg-annex-green/10 text-annex-green'
              : 'border-annex-red/40 bg-annex-red/10 text-annex-red'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleBuy}
        disabled={!isConnected || closed || parsed <= 0n || busy}
        className="mt-4 w-full rounded-xl bg-annex-orange px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {!isConnected
          ? 'Connect wallet to trade'
          : closed
            ? 'Market closed'
            : busy
              ? status === 'approving'
                ? 'Approving MUSD…'
                : 'Buying…'
              : `Buy ${side === OUTCOME.Yes ? 'YES' : 'NO'} for ${formatMusd(parsed)} MUSD`}
      </button>

      {needsApproval && parsed > 0n && isConnected && !closed && (
        <p className="mt-2 text-center text-[11px] text-annex-muted">
          First transaction approves MUSD for the Annex contract.
        </p>
      )}
    </div>
  )
}

function shortenError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('User rejected')) return 'Transaction rejected'
  if (message.includes('insufficient allowance')) return 'MUSD approval failed'
  if (message.includes('insufficient balance')) return 'Not enough MUSD'
  if (message.includes('MarketEnded')) return 'Market already ended'
  if (message.includes('AlreadyResolved')) return 'Market already resolved'
  return message.split('\n')[0].slice(0, 140)
}
