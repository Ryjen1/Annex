// SPDX-License-Identifier: MIT
import { useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import { ANNEX_ADDRESS } from '../lib/contracts'

export type Market = {
  id: bigint
  question: string
  description: string
  category: string
  endTime: bigint
  creator: `0x${string}`
  resolver: `0x${string}`
  outcome: number
  resolved: boolean
  reserveYes: bigint
  reserveNo: bigint
  collateral: bigint
  totalYes: bigint
  totalNo: bigint
  lpSupply: bigint
  priceYes: bigint
  priceNo: bigint
}

export function useMarketCount() {
  return useReadContract({
    address: ANNEX_ADDRESS,
    abi: annexMarketAbi,
    functionName: 'marketCount',
    query: { enabled: ANNEX_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })
}

/** All markets with their prices, loaded with two batched multicalls. */
export function useMarkets(): { markets: Market[]; isLoading: boolean } {
  const { data: count, isLoading: countLoading } = useMarketCount()

  const ids = useMemo(() => {
    const total = Number(count ?? 0n)
    return Array.from({ length: total }, (_, i) => BigInt(i))
  }, [count])

  const marketA = useReadContracts({
    contracts: ids.map((id) => ({
      address: ANNEX_ADDRESS,
      abi: annexMarketAbi,
      functionName: 'getMarketA',
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0 },
  })

  const marketB = useReadContracts({
    contracts: ids.map((id) => ({
      address: ANNEX_ADDRESS,
      abi: annexMarketAbi,
      functionName: 'getMarketB',
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0 },
  })

  const markets = useMemo<Market[]>(() => {
    if (ids.length === 0) return []
    return ids.map((id, index) => {
      const a = marketA.data?.[index]?.result as
        | readonly [string, string, string, bigint, `0x${string}`, `0x${string}`, number, boolean]
        | undefined
      const b = marketB.data?.[index]?.result as
        | readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
        | undefined

      if (!a || !b) {
        return {
          id,
          question: `Market #${id}`,
          description: '',
          category: '',
          endTime: 0n,
          creator: '0x0000000000000000000000000000000000000000',
          resolver: '0x0000000000000000000000000000000000000000',
          outcome: 0,
          resolved: false,
          reserveYes: 0n,
          reserveNo: 0n,
          collateral: 0n,
          totalYes: 0n,
          totalNo: 0n,
          lpSupply: 0n,
          priceYes: 0n,
          priceNo: 0n,
        }
      }

      return {
        id,
        question: a[0],
        description: a[1],
        category: a[2],
        endTime: a[3],
        creator: a[4],
        resolver: a[5],
        outcome: Number(a[6]),
        resolved: a[7],
        reserveYes: b[0],
        reserveNo: b[1],
        collateral: b[2],
        totalYes: b[3],
        totalNo: b[4],
        lpSupply: b[5],
        priceYes: b[6],
        priceNo: b[7],
      }
    })
  }, [ids, marketA.data, marketB.data])

  return { markets, isLoading: countLoading || marketA.isLoading || marketB.isLoading }
}

export function useMarket(id: bigint | undefined): { market: Market | undefined; isLoading: boolean } {
  const { markets, isLoading } = useMarkets()
  const market = useMemo(
    () => markets.find((m) => m.id === id),
    [markets, id],
  )
  return { market, isLoading }
}

/** A user's YES / NO / LP position in every market. */
export function useUserPositions(
  address: `0x${string}` | undefined,
): { positions: Record<string, { yes: bigint; no: bigint; lp: bigint }> } {
  const { markets } = useMarkets()

  const ids = useMemo(
    () => markets.filter((m) => m.creator !== '0x0000000000000000000000000000000000000000').map((m) => m.id),
    [markets],
  )

  const { data } = useReadContracts({
    contracts: ids.map((id) => ({
      address: ANNEX_ADDRESS,
      abi: annexMarketAbi,
      functionName: 'getUserPosition',
      args: [id, address ?? '0x0000000000000000000000000000000000000000'] as const,
    })),
    query: { enabled: Boolean(address) && ids.length > 0 },
  })

  const positions = useMemo(() => {
    const result: Record<string, { yes: bigint; no: bigint; lp: bigint }> = {}
    if (!address) return result
    ids.forEach((id, index) => {
      const position = data?.[index]?.result as readonly [bigint, bigint, bigint] | undefined
      if (!position) return
      result[id.toString()] = { yes: position[0], no: position[1], lp: position[2] }
    })
    return result
  }, [address, ids, data])

  return { positions }
}
