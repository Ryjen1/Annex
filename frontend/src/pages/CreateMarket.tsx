// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, CATEGORIES, MUSD_ADDRESS } from '../lib/contracts'
import { formatMusd, parseMusdInput } from '../lib/format'
import { PlusIcon } from '../components/icons'

function endTimeFromNow(durationDays: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + durationDays * 86400)
}

export function CreateMarket() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const navigate = useNavigate()

  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [duration, setDuration] = useState('7')
  const [liquidity, setLiquidity] = useState('100')
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const approveWrite = useWriteContract()
  const createWrite = useWriteContract()

  const liquidityAmount = parseMusdInput(liquidity)
  const durationDays = Number(duration)
  const valid =
    question.trim().length > 0 &&
    liquidityAmount > 0n &&
    Number.isFinite(durationDays) &&
    durationDays > 0 &&
    durationDays <= 365

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

      const endTime = endTimeFromNow(durationDays)
      const createHash = await createWrite.writeContractAsync({
        address: ANNEX_ADDRESS,
        abi: annexMarketAbi,
        functionName: 'createMarket',
        args: [question.trim(), description.trim(), category, endTime, liquidityAmount],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash })
      const logs = receipt.logs
      setPending(false)
      navigate('/')
      void logs
    } catch (error) {
      setPending(false)
      setStatus(error instanceof Error ? error.message.split('\n')[0].slice(0, 160) : 'Failed')
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <div className="animate-fade-up pt-10 sm:pt-14">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-annex-orange/25 bg-annex-orange/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-annex-orange-soft">
          <PlusIcon className="h-3 w-3" />
          Permissionless
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-annex-ink sm:text-4xl">
          Create a <span className="text-gradient">market</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-annex-muted sm:text-base">
          Anyone can create a market. You seed the pool with MUSD and become the initial liquidity
          provider — you earn the spread when traders take the other side.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass animate-fade-up mt-8 space-y-6 rounded-4xl p-6 [animation-delay:80ms] sm:p-8"
      >
        <div>
          <label className="label-caps mb-2 block" htmlFor="question">
            Question
          </label>
          <input
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Will BTC close above $100,000 this month?"
            maxLength={140}
            className="input-field focus:input-field-focus"
            required
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
            placeholder="Resolves YES if the daily close at 23:59 UTC is above 100,000 USD."
            rows={3}
            className="input-field focus:input-field-focus resize-none"
          />
        </div>

        <div>
          <span className="label-caps mb-2 block">Category</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                  category === item
                    ? 'bg-annex-orange text-black shadow-[0_10px_26px_-12px_rgba(247,147,26,0.9)]'
                    : 'border border-white/8 bg-white/4 text-annex-muted hover:border-white/15 hover:text-annex-ink'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-caps mb-2 block" htmlFor="duration">
              Duration (days)
            </label>
            <input
              id="duration"
              type="number"
              min="1"
              max="365"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="input-field focus:input-field-focus font-mono tabular-nums"
              required
            />
          </div>
          <div>
            <label className="label-caps mb-2 block" htmlFor="liquidity">
              Initial liquidity (MUSD)
            </label>
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
          </div>
        </div>

        <div className="rounded-2xl border border-annex-orange/20 bg-annex-orange/[0.06] px-4 py-3.5 text-xs leading-relaxed text-annex-orange-soft">
          The pool starts balanced at 50 / 50. You are the only liquidity provider, so every trade
          pays the spread straight into your LP position.
        </div>

        {status && (
          <div className="rounded-xl border border-annex-red/40 bg-annex-red/10 px-3 py-2.5 text-xs text-annex-red">
            {status}
          </div>
        )}

        <button
          type="submit"
          disabled={!isConnected || !valid || pending}
          className="btn-primary btn-primary-hover w-full px-4 py-3 text-sm"
        >
          {!isConnected
            ? 'Connect wallet to create'
            : pending
              ? 'Creating market…'
              : `Create market with ${formatMusd(liquidityAmount, 0)} MUSD`}
        </button>
      </form>
    </div>
  )
}
