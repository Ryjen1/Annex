// SPDX-License-Identifier: MIT
import { formatUnits, parseUnits } from 'viem'

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

/** Format an 18-decimal BTC amount. */
export function formatBtc(value: bigint | undefined, decimals = 4): string {
  if (value === undefined) return '0.0000'
  const asNumber = Number(formatUnits(value, 18))
  if (!Number.isFinite(asNumber)) return '0.0000'
  return asNumber.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Format an 18-decimal USD oracle price (e.g. $74,120). */
export function formatUsdPrice(value: bigint | undefined, decimals = 0): string {
  if (value === undefined || value === 0n) return '—'
  const asNumber = Number(formatUnits(value, 18))
  if (!Number.isFinite(asNumber)) return '—'
  return `$${asNumber.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/** Format an 18-decimal collateral ratio (1.1e18 -> 110%). */
export function formatRatioPct(ratio: bigint | undefined): string {
  if (ratio === undefined || ratio === 0n) return '—'
  const pct = Number(formatUnits(ratio, 18)) * 100
  if (!Number.isFinite(pct) || pct > 100_000) return '∞'
  return `${pct.toFixed(0)}%`
}

export function parseDecimalInput(value: string): bigint {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '.') return 0n
  try {
    return parseUnits(trimmed, 18)
  } catch {
    return 0n
  }
}

export function parseMusdInput(value: string): bigint {
  return parseDecimalInput(value)
}
