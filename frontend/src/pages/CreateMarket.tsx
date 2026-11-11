// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'

import { TroveFundingPanel } from '../components/TroveFundingPanel'
import { BitcoinIcon, PlusIcon } from '../components/icons'
import { useBtcPrice } from '../hooks/useTrove'
import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, CATEGORIES, MARKET_KIND, MUSD_ADDRESS } from '../lib/contracts'
import { formatMusd, formatUsdPrice, parseDecimalInput, parseMusdInput } from '../lib/format'

function endTimeFromHours(hours: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + Math.round(hours * 3600))
}

const MANUAL_CATEGORIES = CATEGORIES.filter((item) => item !== 'BTC Price')

export function CreateMarket() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const navigate = useNavigate()
  const { btcPrice } = useBtcPrice()

  const [marketKind, setMarketKind] = useState<number>(MARKET_KIND.PriceFeed)
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>(MANUAL_CATEGORIES[0])
  const [strikeInput, setStrikeInput] = useState('75000')
  const [resolveAbove, setResolveAbove] = useState(true)
  const [durationHours, setDurationHours] = useState('168') // 7 days default
  const [liquidity, setLiquidity] = useState('100')
  const [showTrove, setShowTrove] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const { data: musdBalance, refetch: refetchMusd } = useReadContract({
    address: MUSD_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })

  const approveWrite = useWriteContract()
  const createWrite = useWriteContract()

  const isPriceFeed = marketKind === MARKET_KIND.PriceFeed
  const strikeWei = parseDecimalInput(strikeInput)
  const liquidityAmount = parseMusdInput(liquidity)
  const hoursNumeric = Number(durationHours)
  const insufficientMusd = isConnected && liquidityAmount > 0n && (musdBalance ?? 0n) < liquidityAmount

  const suggestedQuestion = isPriceFeed
    ? `Will BTC trade ${resolveAbove ? '>=' : '<'} $${Number(strikeInput || '0').toLocaleString('en-US')} at expiry?`
    : ''
  const effectiveQuestion = question.trim() || suggestedQuestion
  const effectiveDescription =
    description.trim() ||
    (isPriceFeed
      ? `Objective oracle market settled via Mezo PriceFeed.fetchPrice(). Resolves YES if BTC/USD is ${resolveAbove ? 'at or above' : 'strictly below'} $${strikeInput} at or after expiry.`
      : '')

  const valid =
    effectiveQuestion.length > 0 &&
    liquidityAmount > 0n &&
    Number.isFinite(hoursNumeric) &&
    hoursNumeric >= 0.05 &&
    hoursNumeric <= 365 * 24 &&
    (!isPriceFeed || strikeWei > 0n)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!publicClient || !address) return
    setStatus(null)
    setPending(true)
    try {
      const allowance = await publicClient.readContract({
        address: MUSD_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, ANNEX_ADDRESS],
      })

      if (allowance < liquidityAmount) {
        const approveHash = await approveWrite.writeContractAsync({
          address: MUSD_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ANNEX_ADDRESS, liquidityAmount],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      const endTime = endTimeFromHours(hoursNumeric)
      const createHash = isPriceFeed
        ? await createWrite.writeContractAsync({
            address: ANNEX_ADDRESS,
            abi: annexMarketAbi,
            functionName: 'createPriceMarket',
            args: [
              effectiveQuestion,
              effectiveDescription,
              endTime,
              liquidityAmount,
              strikeWei,
              resolveAbove,
            ],
          })
        : await createWrite.writeContractAsync({
            address: ANNEX_ADDRESS,
            abi: annexMarketAbi,
            functionName: 'createMarket',
            args: [effectiveQuestion, effectiveDescription, category, endTime, liquidityAmount],
          })
      await publicClient.waitForTransactionReceipt({ hash: createHash })
      setPending(false)
      navigate('/markets')
    } catch (error) {
      setPending(false)
      setStatus(error instanceof Error ? error.message.split('\n')[0].slice(0, 160) : 'Failed')
    }
  }

  return (
    <div className="shell mx-auto max-w-3xl pb-24 pt-28 md:pt-40">
      <div className="animate-fade-up">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-annex-orange/25 bg-annex-orange/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-annex-orange-soft">
          <PlusIcon className="h-3 w-3" />
          Permissionless
        </span>
        <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl">
          Create a <span className="text-gradient">market</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45 sm:text-base">
          Launch an oracle-settled BTC/USD price market powered by Mezo PriceFeed, or create a
          custom event market with your own resolver.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass animate-fade-up mt-8 space-y-6 rounded-4xl p-6 [animation-delay:80ms] sm:p-8"
      >
        {/* Market Kind Selector */}
        <div>
          <span className="label-caps mb-2 block">Market Type</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMarketKind(MARKET_KIND.PriceFeed)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                isPriceFeed
                  ? 'border-annex-green/50 bg-annex-green/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="text-sm font-semibold text-white">BTC/USD PriceFeed</div>
              <div className="mt-1 text-xs text-white/50">
                Permissionless settlement via Mezo PriceFeed at expiry. No manual override.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMarketKind(MARKET_KIND.Manual)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                !isPriceFeed
                  ? 'border-annex-orange/50 bg-annex-orange/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="text-sm font-semibold text-white">Custom Event (Manual)</div>
              <div className="mt-1 text-xs text-white/50">
                Subjective milestones settled by you as creator/resolver after expiry.
              </div>
            </button>
          </div>
        </div>

        {isPriceFeed ? (
          <div className="space-y-4 rounded-2xl border border-annex-green/20 bg-annex-green/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-annex-green">Mezo PriceFeed Parameters</span>
              <span className="font-mono text-white/60">
                Live BTC/USD: <strong className="text-white">{formatUsdPrice(btcPrice, 0)}</strong>
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="label-caps mb-2 block">Condition (YES resolves if)</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolveAbove(true)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      resolveAbove
                        ? 'border-annex-green/50 bg-annex-green/15 text-annex-green'
                        : 'border-white/10 bg-white/5 text-white/50'
                    }`}
                  >
                    BTC ≥ Strike
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveAbove(false)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      !resolveAbove
                        ? 'border-annex-green/50 bg-annex-green/15 text-annex-green'
                        : 'border-white/10 bg-white/5 text-white/50'
                    }`}
                  >
                    BTC &lt; Strike
                  </button>
                </div>
              </div>

              <div>
                <label className="label-caps mb-2 block" htmlFor="strike">
                  Strike Price (USD)
                </label>
                <div className="relative">
                  <input
                    id="strike"
                    type="number"
                    min="1"
                    step="100"
                    value={strikeInput}
                    onChange={(event) => setStrikeInput(event.target.value)}
                    className="input-field focus:input-field-focus pl-8 font-mono tabular-nums"
                    required
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/45">
                    $
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <span className="label-caps mb-2 block">Category</span>
            <div className="flex flex-wrap gap-2">
              {MANUAL_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                    category === item
                      ? 'bg-annex-orange text-black shadow-[0_10px_26px_-12px_rgba(247,147,26,0.9)]'
                      : 'border border-white/8 bg-white/4 text-white/45 hover:border-white/15 hover:text-annex-ink'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label-caps mb-2 block" htmlFor="question">
            Question
          </label>
          <input
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={
              isPriceFeed
                ? suggestedQuestion
                : 'Will Mezo Testnet cross 5,000 active Troves this month?'
            }
            maxLength={140}
            className="input-field focus:input-field-focus"
            required={!isPriceFeed}
          />
        </div>

        <div>
          <label className="label-caps mb-2 block" htmlFor="description">
            Resolution criteria
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={
              isPriceFeed
                ? 'Automatically settled using Mezo PriceFeed.fetchPrice() at expiry.'
                : 'Resolves YES if the public explorer metric crosses the target before expiry.'
            }
            rows={3}
            className="input-field focus:input-field-focus resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-caps mb-2 block" htmlFor="duration">
              Expiry window (hours)
            </label>
            <input
              id="duration"
              type="number"
              min="1"
              max={365 * 24}
              step="1"
              value={durationHours}
              onChange={(event) => setDurationHours(event.target.value)}
              className="input-field focus:input-field-focus font-mono tabular-nums"
              required
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { label: '1h', value: '1' },
                { label: '24h', value: '24' },
                { label: '7d', value: '168' },
                { label: '30d', value: '720' },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDurationHours(preset.value)}
                  className="rounded-full border border-white/8 bg-white/4 px-2.5 py-0.5 font-mono text-[11px] text-white/50 hover:border-annex-orange/40 hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="label-caps" htmlFor="liquidity">
                Initial liquidity (MUSD)
              </label>
              {isConnected && (
                <span className="font-mono text-[11px] text-white/45">
                  Wallet {formatMusd(musdBalance, 0)} MUSD
                </span>
              )}
            </div>
            <input
              id="liquidity"
              type="number"
              min="1"
              step="1"
              value={liquidity}
              onChange={(event) => setLiquidity(event.target.value)}
              className="input-field focus:input-field-focus font-mono tabular-nums"
              required
            />
            {isConnected && (
              <button
                type="button"
                onClick={() => setShowTrove((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-annex-orange-soft hover:border-annex-orange/40"
              >
                <BitcoinIcon className="h-3 w-3" />
                {showTrove ? 'Hide Mezo Trove' : 'Mint MUSD via Mezo Trove'}
              </button>
            )}
          </div>
        </div>

        {showTrove && isConnected && (
          <TroveFundingPanel
            compact
            suggestedMusd={liquidity}
            onFunded={() => void refetchMusd()}
          />
        )}

        <div className="rounded-2xl border border-annex-orange/20 bg-annex-orange/[0.06] px-4 py-3.5 text-xs leading-relaxed text-annex-orange-soft">
          {isPriceFeed
            ? 'The pool starts balanced at 50 / 50. After expiry, anyone can call resolvePriceMarket() to pull the canonical BTC/USD price from Mezo PriceFeed — neither creators nor admins can override the outcome.'
            : 'The pool starts balanced at 50 / 50. You are the initial liquidity provider and resolver for this custom event market.'}
        </div>

        {status && (
          <div className="rounded-2xl border border-annex-red/40 bg-annex-red/10 px-3 py-2.5 text-xs text-annex-red">
            {status}
          </div>
        )}

        <button
          type="submit"
          disabled={!isConnected || !valid || insufficientMusd || pending}
          className="btn-primary btn-primary-hover w-full px-4 py-3 text-sm"
        >
          {!isConnected
            ? 'Connect wallet to create'
            : insufficientMusd
              ? 'Insufficient MUSD — fund via Mezo Trove above'
              : pending
                ? 'Creating market…'
                : isPriceFeed
                  ? `Create BTC PriceFeed market with ${formatMusd(liquidityAmount, 0)} MUSD`
                  : `Create market with ${formatMusd(liquidityAmount, 0)} MUSD`}
        </button>
      </form>
    </div>
  )
}
