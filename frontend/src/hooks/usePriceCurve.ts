// SPDX-License-Identifier: MIT
import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS, OUTCOME } from '../lib/contracts'
import { curveAmounts, postTrade, type Side } from '../lib/amm'
import type { Market } from './useMarkets'

export type CurvePoint = {
  amount: number
  cents: number
}

/**
 * Marginal price of `side` across a range of trade sizes, read from the contract
 * with one batched multicall. Every point comes from `getBuyQuote`, so the chart
 * is the real on-chain curve rather than a local re-implementation.
 */
export function usePriceCurve(market: Market | undefined, side: Side): CurvePoint[] {
  const marketId = market?.id
  const reserveYes = market?.reserveYes ?? 0n
  const reserveNo = market?.reserveNo ?? 0n

  const outcome = side === 'yes' ? OUTCOME.Yes : OUTCOME.No

  const amounts = useMemo(() => {
    if (marketId === undefined) return []
    const size = Math.max(Number(reserveYes), Number(reserveNo)) / 1e18
    return curveAmounts(Math.max(size * 0.9, 1))
  }, [marketId, reserveYes, reserveNo])

  const { data } = useReadContracts({
    contracts: amounts.map((amount) => ({
      address: ANNEX_ADDRESS,
      abi: annexMarketAbi,
      functionName: 'getBuyQuote',
      args: [marketId!, outcome, amount] as const,
    })),
    query: {
      enabled: marketId !== undefined && amounts.length > 0,
      staleTime: 30_000,
    },
  })

  return useMemo(() => {
    if (marketId === undefined || !data) return []
    const pool = { reserveYes, reserveNo }
    return amounts.map((amount, index) => {
      const result = data[index]?.result as bigint | undefined
      if (result === undefined) return { amount: Number(amount) / 1e18, cents: 0 }
      const state = postTrade(side, pool, amount, result)
      const cents = (side === 'yes' ? state.priceYes : state.priceNo) * 100
      return { amount: Number(amount) / 1e18, cents }
    })
  }, [amounts, data, marketId, reserveNo, reserveYes, side])
}
