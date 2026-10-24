// SPDX-License-Identifier: MIT
import { useMemo, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, MUSD_ADDRESS, OUTCOME } from '../lib/contracts'
import { formatMusd, formatShares, parseMusdInput } from '../lib/format'
import { postTrade } from '../lib/amm'
import type { Market } from '../hooks/useMarkets'
import { usePriceCurve } from '../hooks/usePriceCurve'
import { PriceCurve } from './PriceCurve'
import { CheckIcon } from './icons'

type Side = typeof OUTCOME.Yes | typeof OUTCOME.No

const QUICK_AMOUNTS = ['10', '50', '250', '1000']

export function TradePanel({ market, now }: { market: Market; now: bigint }) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const [side, setSide] = useState<Side>(OUTCOME.Yes)
  const [amount, setAmount] = useState('25')
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

  const curveSide = side === OUTCOME.Yes ? 'yes' : 'no'
  const curve = usePriceCurve(market, curveSide)

  const state = useMemo(
    () =>
      quote !== undefined
        ? postTrade(
            curveSide,
            { reserveYes: market.reserveYes, reserveNo: market.reserveNo },
            parsed,
            quote,
          )
        : null,
    [curveSide, market.reserveNo, market.reserveYes, parsed, quote],
  )

  const impactPct = (state?.priceImpact ?? 0) * 100
  const markerCents = state
    ? (curveSide === 'yes' ? state.priceYes : state.priceNo) * 100
    : null

  return (
    <div className="glass overflow-hidden rounded-4xl">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-annex-muted">
          Trade
        </h2>
        <span className="rounded-full border border-white/8 bg-white/4 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-annex-muted">
          MUSD
        </span>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-2.5">
          <SideButton
            active={side === OUTCOME.Yes}
            disabled={closed}
            label="YES"
            price={yesPrice}
            onClick={() => setSide(OUTCOME.Yes)}
            tone="green"
          />
          <SideButton
            active={side === OUTCOME.No}
            disabled={closed}
            label="NO"
            price={noPrice}
            onClick={() => setSide(OUTCOME.No)}
            tone="red"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label-caps" htmlFor="amount">
              Amount
            </label>
            <span className="font-mono text-[11px] text-annex-muted">
              Balance {formatMusd(market.collateral, 0)} MUSD in pool
            </span>
          </div>
          <div className="relative">
            <input
              id="amount"
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={closed}
              className="input-field focus:input-field-focus pr-16 font-mono tabular-nums disabled:opacity-50"
              placeholder="0.0"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-annex-muted">
              MUSD
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                disabled={closed}
                className="rounded-full border border-white/8 bg-white/4 px-2.5 py-1 font-mono text-[11px] text-annex-muted transition-colors hover:border-annex-orange/40 hover:text-annex-ink disabled:opacity-40"
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-caps">Price impact</span>
            <span
              className={`font-mono text-xs tabular-nums ${
                impactPct > 3 ? 'text-annex-red' : impactPct > 1 ? 'text-annex-orange-soft' : 'text-annex-green'
              }`}
            >
              {impactPct.toFixed(2)}%
            </span>
          </div>
          <PriceCurve
            points={curve}
            markerAmount={Number(parsed) / 1e18}
            markerCents={markerCents}
          />
        </div>

        <dl className="space-y-2.5 text-sm">
          <Row
            label="You receive"
            value={
              quoteLoading
                ? '…'
                : `${formatShares(quote)} ${side === OUTCOME.Yes ? 'YES' : 'NO'}`
            }
            highlight
          />
          <Row
            label="Average price"
            value={
              quote && quote > 0n
                ? `${((Number(parsed) / Number(quote)) * 100).toFixed(2)}¢`
                : '—'
            }
          />
          <Row label="Max payout" value={`${formatMusd(quote)} MUSD`} />
        </dl>

        {message && (
          <div
            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
              message.tone === 'ok'
                ? 'border-annex-green/35 bg-annex-green/10 text-annex-green'
                : 'border-annex-red/35 bg-annex-red/10 text-annex-red'
            }`}
          >
            {message.tone === 'ok' && <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <button
          onClick={handleBuy}
          disabled={!isConnected || closed || parsed <= 0n || busy}
          className="btn-primary btn-primary-hover w-full px-4 py-3 text-sm"
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
          <p className="text-center text-[11px] text-annex-muted">
            First transaction approves MUSD for the Annex contract.
          </p>
        )}
      </div>
    </div>
  )
}

function SideButton({
  active,
  disabled,
  label,
  price,
  onClick,
  tone,
}: {
  active: boolean
  disabled: boolean
  label: string
  price: number
  onClick: () => void
  tone: 'green' | 'red'
}) {
  const accent = tone === 'green' ? 'text-annex-green' : 'text-annex-red'
  const ring =
    tone === 'green'
      ? 'border-annex-green/45 bg-annex-green/10 shadow-[0_0_28px_-12px_rgba(62,207,142,0.8)]'
      : 'border-annex-red/45 bg-annex-red/10 shadow-[0_0_28px_-12px_rgba(242,85,90,0.8)]'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? ring : 'border-white/8 bg-white/[0.03] hover:border-white/15'
      }`}
    >
      <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${accent}`}>{label}</div>
      <div className="font-display mt-1 text-xl font-semibold tabular-nums">
        {price.toFixed(1)}%
      </div>
    </button>
  )
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-annex-muted">{label}</dt>
      <dd
        className={`font-mono tabular-nums ${
          highlight ? 'font-semibold text-annex-orange-soft' : 'text-annex-ink'
        }`}
      >
        {value}
      </dd>
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
