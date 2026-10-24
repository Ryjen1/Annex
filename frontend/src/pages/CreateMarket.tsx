// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, CATEGORIES, MUSD_ADDRESS } from '../lib/contracts'
import { formatMusd, parseMusdInput } from '../lib/format'

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
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Create a market</h1>
      <p className="mt-1 text-sm text-annex-muted">
        Anyone can create a market. You seed the pool with MUSD and become the initial liquidity
        provider — you earn the spread when traders take the other side.
      </p>

      <form onSubmit={handleSubmit} className="panel mt-6 space-y-5 p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-annex-muted" htmlFor="question">
            Question
          </label>
          <input
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Will BTC close above $100,000 this month?"
            maxLength={140}
            className="input-field"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-annex-muted" htmlFor="description">
            Resolution criteria
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Resolves YES if the daily close at 23:59 UTC is above 100,000 USD."
            rows={3}
            className="input-field resize-none"
          />
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-annex-muted">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  category === item ? 'bg-annex-orange text-black' : 'bg-annex-panel-2 text-annex-muted hover:text-white'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-annex-muted" htmlFor="duration">
              Duration (days)
            </label>
            <input
              id="duration"
              type="number"
              min="1"
              max="365"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="input-field tabular-nums"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-annex-muted" htmlFor="liquidity">
              Initial liquidity (MUSD)
            </label>
            <input
              id="liquidity"
              type="number"
              min="1"
              step="1"
              value={liquidity}
              onChange={(event) => setLiquidity(event.target.value)}
              className="input-field tabular-nums"
              required
            />
          </div>
        </div>

        <div className="rounded-lg border border-annex-border bg-annex-panel-2 px-4 py-3 text-xs text-annex-muted">
          The pool starts balanced at 50 / 50. You are the only liquidity provider, so every trade
          pays the spread straight into your LP position.
        </div>

        {status && (
          <div className="rounded-lg border border-annex-red/40 bg-annex-red/10 px-3 py-2 text-xs text-annex-red">
            {status}
          </div>
        )}

        <button
          type="submit"
          disabled={!isConnected || !valid || pending}
          className="w-full rounded-xl bg-annex-orange px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
