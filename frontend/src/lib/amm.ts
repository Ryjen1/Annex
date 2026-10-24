// SPDX-License-Identifier: MIT

/**
 * Helpers that turn an on-chain AMM quote into the post-trade pool state.
 *
 * The contract splits a deposit of `a` MUSD into a complete set (`a` YES + `a` NO).
 * The opposite half seeds the pool as counter-collateral, the pool releases the
 * desired side with `k` preserved, and the buyer keeps `a + swapOut` shares.
 *
 * Everything here is derived from `getBuyQuote` output, so the UI always matches
 * the contract exactly instead of re-implementing the swap.
 */

export const WAD = 10n ** 18n

export type Side = 'yes' | 'no'

export type PoolState = {
  reserveYes: bigint
  reserveNo: bigint
}

export type PostTrade = {
  reserveYes: bigint
  reserveNo: bigint
  priceYes: number
  priceNo: number
  priceImpact: number
}

/** Pool state after a trade of `amount` MUSD that returned `sharesOut` shares. */
export function postTrade(
  side: Side,
  pool: PoolState,
  amount: bigint,
  sharesOut: bigint,
): PostTrade {
  const swapOut = sharesOut > amount ? sharesOut - amount : 0n

  const reserveYes =
    side === 'yes' ? pool.reserveYes - swapOut : pool.reserveYes + amount
  const reserveNo = side === 'yes' ? pool.reserveNo + amount : pool.reserveNo - swapOut

  const sum = reserveYes + reserveNo
  const priceYes = sum === 0n ? 0 : Number(reserveNo) / Number(sum)
  const priceNo = sum === 0n ? 0 : Number(reserveYes) / Number(sum)

  const reserveSum = pool.reserveYes + pool.reserveNo
  const priceBefore =
    reserveSum === 0n
      ? 0
      : side === 'yes'
        ? Number(pool.reserveNo) / Number(reserveSum)
        : Number(pool.reserveYes) / Number(reserveSum)
  const priceAfter = side === 'yes' ? priceYes : priceNo
  const priceImpact = priceBefore === 0 ? 0 : Math.abs((priceAfter - priceBefore) / priceBefore)

  return { reserveYes, reserveNo, priceYes, priceNo, priceImpact }
}

/** Sample amounts for the price curve, from 0 up to `cap` MUSD. */
export function curveAmounts(cap: number, samples = 20): bigint[] {
  const capWei = BigInt(Math.max(Math.round(cap * 1e18), 1))
  const step = capWei / BigInt(samples)
  const amounts: bigint[] = []
  for (let i = 0; i <= samples; i++) amounts.push(step * BigInt(i))
  return amounts
}
