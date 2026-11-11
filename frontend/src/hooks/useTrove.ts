// SPDX-License-Identifier: MIT
import { erc20Abi, type PublicClient } from 'viem'
import { useBalance, useReadContract, useReadContracts } from 'wagmi'

import { annexMarketAbi } from '../lib/abi'
import {
  ANNEX_ADDRESS,
  BORROWER_OPERATIONS_ADDRESS,
  HINT_HELPERS_ADDRESS,
  isDeployed,
  MUSD_ADDRESS,
  PRICE_FEED_ADDRESS,
  SORTED_TROVES_ADDRESS,
  TROVE_MANAGER_ADDRESS,
} from '../lib/contracts'
import {
  borrowerOperationsAbi,
  hintHelpersAbi,
  priceFeedAbi,
  sortedTrovesAbi,
  troveManagerAbi,
} from '../lib/mezoAbi'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const WAD = 10n ** 18n

export type TroveState = {
  status: number
  isActive: boolean
  coll: bigint
  debt: bigint
  icr: bigint
  maxBorrowingCapacity: bigint
  availableToBorrow: bigint
  liquidationPrice: bigint
  mcr: bigint
  ccr: bigint
  minNetDebt: bigint
  gasCompensation: bigint
  borrowingRate: bigint
  btcPrice: bigint
  isRecoveryMode: boolean
  btcBalance: bigint
  musdBalance: bigint
  isLoading: boolean
  refetch: () => void
}

export function computeLiquidationPrice(coll: bigint, debt: bigint, mcr: bigint): bigint {
  if (coll === 0n || debt === 0n || mcr === 0n) return 0n
  return (debt * mcr) / coll
}

export function computeProjectedICR(coll: bigint, debt: bigint, btcPrice: bigint): bigint {
  if (debt === 0n || btcPrice === 0n) return 0n
  return (coll * btcPrice) / debt
}

export function useBtcPrice(): { btcPrice: bigint; isLoading: boolean; refetch: () => void } {
  const { data, isLoading, refetch } = useReadContract({
    address: PRICE_FEED_ADDRESS,
    abi: priceFeedAbi,
    functionName: 'fetchPrice',
    query: { retry: false, staleTime: 15_000, refetchInterval: 20_000 },
  })
  return { btcPrice: (data as bigint | undefined) ?? 0n, isLoading, refetch: () => void refetch() }
}

export function useTrove(address: `0x${string}` | undefined): TroveState {
  const btcBalanceQuery = useBalance({
    address,
    query: { enabled: Boolean(address), staleTime: 10_000 },
  })

  const musdBalanceQuery = useReadContract({
    address: MUSD_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), staleTime: 10_000 },
  })

  const { btcPrice, refetch: refetchPrice } = useBtcPrice()

  // Protocol-level view directly through AnnexMarket contract (when deployed)
  const annexTroveQuery = useReadContract({
    address: ANNEX_ADDRESS,
    abi: annexMarketAbi,
    functionName: 'getUserTroveState',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && isDeployed, retry: false },
  })

  // Direct Mezo TroveManager & BorrowerOperations parameters
  const directQuery = useReadContracts({
    contracts: [
      {
        address: TROVE_MANAGER_ADDRESS,
        abi: troveManagerAbi,
        functionName: 'getTroveStatus',
        args: [address ?? ZERO_ADDRESS] as const,
      },
      {
        address: TROVE_MANAGER_ADDRESS,
        abi: troveManagerAbi,
        functionName: 'getEntireDebtAndColl',
        args: [address ?? ZERO_ADDRESS] as const,
      },
      {
        address: TROVE_MANAGER_ADDRESS,
        abi: troveManagerAbi,
        functionName: 'getTroveMaxBorrowingCapacity',
        args: [address ?? ZERO_ADDRESS] as const,
      },
      {
        address: BORROWER_OPERATIONS_ADDRESS,
        abi: borrowerOperationsAbi,
        functionName: 'minNetDebt',
      },
      {
        address: BORROWER_OPERATIONS_ADDRESS,
        abi: borrowerOperationsAbi,
        functionName: 'MUSD_GAS_COMPENSATION',
      },
      {
        address: BORROWER_OPERATIONS_ADDRESS,
        abi: borrowerOperationsAbi,
        functionName: 'borrowingRate',
      },
      {
        address: BORROWER_OPERATIONS_ADDRESS,
        abi: borrowerOperationsAbi,
        functionName: 'MCR',
      },
      {
        address: BORROWER_OPERATIONS_ADDRESS,
        abi: borrowerOperationsAbi,
        functionName: 'CCR',
      },
    ],
    query: { staleTime: 15_000 },
  })

  const recoveryQuery = useReadContract({
    address: TROVE_MANAGER_ADDRESS,
    abi: troveManagerAbi,
    functionName: 'checkRecoveryMode',
    args: btcPrice > 0n ? [btcPrice] : undefined,
    query: { enabled: btcPrice > 0n, retry: false },
  })

  const annexTuple = annexTroveQuery.data as
    | readonly [number, bigint, bigint, bigint, bigint, bigint, bigint]
    | undefined

  const dStatus = directQuery.data?.[0]?.result as number | undefined
  const dCollDebt = directQuery.data?.[1]?.result as
    | readonly [bigint, bigint, bigint, bigint, bigint, bigint]
    | undefined
  const dMaxCap = directQuery.data?.[2]?.result as bigint | undefined
  const minNetDebt = (directQuery.data?.[3]?.result as bigint | undefined) ?? 1_800n * WAD
  const gasCompensation = (directQuery.data?.[4]?.result as bigint | undefined) ?? 200n * WAD
  const borrowingRate = (directQuery.data?.[5]?.result as bigint | undefined) ?? WAD / 1000n
  const mcr = (directQuery.data?.[6]?.result as bigint | undefined) ?? (11n * WAD) / 10n
  const ccr = (directQuery.data?.[7]?.result as bigint | undefined) ?? (15n * WAD) / 10n

  const status = address
    ? Number(annexTuple?.[0] ?? dStatus ?? 0)
    : 0
  const isActive = status === 1
  const coll = address ? (annexTuple?.[1] ?? dCollDebt?.[0] ?? 0n) : 0n
  const debt = address
    ? (annexTuple?.[2] ?? (dCollDebt ? dCollDebt[1] + dCollDebt[2] : 0n))
    : 0n
  const resolvedBtcPrice = (annexTuple?.[6] && annexTuple[6] > 0n) ? annexTuple[6] : btcPrice
  const icr = address
    ? (annexTuple?.[3] && annexTuple[3] > 0n
        ? annexTuple[3]
        : isActive && resolvedBtcPrice > 0n && debt > 0n
          ? computeProjectedICR(coll, debt, resolvedBtcPrice)
          : 0n)
    : 0n
  const maxBorrowingCapacity = address ? (annexTuple?.[4] ?? dMaxCap ?? 0n) : 0n
  const effectiveMcr = (annexTuple?.[5] && annexTuple[5] > 0n) ? annexTuple[5] : mcr
  const availableToBorrow =
    isActive && maxBorrowingCapacity > debt ? maxBorrowingCapacity - debt : 0n
  const liquidationPrice = isActive ? computeLiquidationPrice(coll, debt, effectiveMcr) : 0n

  function refetch() {
    void btcBalanceQuery.refetch()
    void musdBalanceQuery.refetch()
    refetchPrice()
    void annexTroveQuery.refetch()
    void directQuery.refetch()
    void recoveryQuery.refetch()
  }

  return {
    status,
    isActive,
    coll,
    debt,
    icr,
    maxBorrowingCapacity,
    availableToBorrow,
    liquidationPrice,
    mcr: effectiveMcr,
    ccr,
    minNetDebt,
    gasCompensation,
    borrowingRate,
    btcPrice: resolvedBtcPrice,
    isRecoveryMode: Boolean(recoveryQuery.data),
    btcBalance: btcBalanceQuery.data?.value ?? 0n,
    musdBalance: (musdBalanceQuery.data as bigint | undefined) ?? 0n,
    isLoading: directQuery.isLoading,
    refetch,
  }
}

/**
 * Compute Liquity/Mezo SortedTroves insertion hints for lower gas costs.
 * Falls back cleanly to (0x0, 0x0) if the sorted list is empty or RPC skips.
 */
export async function findTroveHints(
  publicClient: PublicClient,
  collWei: bigint,
  principalDebtWei: bigint,
): Promise<readonly [`0x${string}`, `0x${string}`]> {
  if (collWei <= 0n || principalDebtWei <= 0n) return [ZERO_ADDRESS, ZERO_ADDRESS]
  try {
    const nicr = (await publicClient.readContract({
      address: HINT_HELPERS_ADDRESS,
      abi: hintHelpersAbi,
      functionName: 'computeNominalCR',
      args: [collWei, principalDebtWei],
    })) as bigint

    const numTroves = (await publicClient.readContract({
      address: SORTED_TROVES_ADDRESS,
      abi: sortedTrovesAbi,
      functionName: 'getSize',
    })) as bigint

    if (numTroves === 0n) return [ZERO_ADDRESS, ZERO_ADDRESS]

    const numTrials = BigInt(Math.min(15, Math.max(1, Math.ceil(Math.sqrt(Number(numTroves))))))
    const [approxHint] = (await publicClient.readContract({
      address: HINT_HELPERS_ADDRESS,
      abi: hintHelpersAbi,
      functionName: 'getApproxHint',
      args: [nicr, numTrials, 42n],
    })) as readonly [`0x${string}`, bigint, bigint]

    const [upperHint, lowerHint] = (await publicClient.readContract({
      address: SORTED_TROVES_ADDRESS,
      abi: sortedTrovesAbi,
      functionName: 'findInsertPosition',
      args: [nicr, approxHint, approxHint],
    })) as readonly [`0x${string}`, `0x${string}`]

    return [upperHint, lowerHint]
  } catch {
    return [ZERO_ADDRESS, ZERO_ADDRESS]
  }
}
