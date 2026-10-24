// SPDX-License-Identifier: MIT
import { formatUnits } from 'viem'

export const WAD = 10n ** 18n

/** Format a wei amount as MUSD with a fixed number of decimals. */
export function formatMusd(value: bigint | undefined, decimals = 2): string {
  if (value === undefined) return '0.00'
  const asNumber = Number(formatUnits(value, 18))
  if (!Number.isFinite(asNumber)) return '0.00'
  return asNumber.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Format a 1e18-scaled price (1.0 == 1 MUSD) as a percentage string. */
export function formatPercent(price: bigint | undefined, decimals = 1): string {
  if (price === undefined) return '0%'
  const asNumber = Number(formatUnits(price, 18))
  if (!Number.isFinite(asNumber)) return '0%'
  return `${(asNumber * 100).toFixed(decimals)}%`
}

/** Format a 1e18-scaled price as a MUSD amount per share. */
export function formatPrice(price: bigint | undefined): string {
  if (price === undefined) return '0.00'
  const asNumber = Number(formatUnits(price, 18))
  if (!Number.isFinite(asNumber)) return '0.00'
  return `$${asNumber.toFixed(3)}`
}

export function formatShares(value: bigint | undefined): string {
  if (value === undefined) return '0'
  const asNumber = Number(formatUnits(value, 18))
  if (!Number.isFinite(asNumber)) return '0'
  return asNumber.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function shortAddress(address: string | undefined): string {
  if (!address) return ''
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Human readable "3d 4h" style countdown. */
export function timeLeft(endTime: bigint | undefined, now: bigint): string {
  if (endTime === undefined) return '—'
  const end = Number(endTime)
  const current = Number(now)
  const diff = Math.floor((end - current) / 1000)
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatDate(timestamp: bigint | undefined): string {
  if (!timestamp) return '—'
  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function parseMusdInput(value: string): bigint {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) return 0n
  return BigInt(Math.round(numeric * 1e6)) * (10n ** 12n)
}
