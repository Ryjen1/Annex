// SPDX-License-Identifier: MIT

/**
 * Deployment addresses.
 *
 * Override with Vite env vars:
 *   VITE_ANNEX_ADDRESS=0x...   deployed AnnexMarket
 *   VITE_MUSD_ADDRESS=0x...   settlement token (defaults to canonical Mezo Testnet MUSD)
 */
export const ANNEX_ADDRESS = (import.meta.env.VITE_ANNEX_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export const MUSD_ADDRESS = (import.meta.env.VITE_MUSD_ADDRESS ??
  '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503') as `0x${string}`

export const isDeployed = ANNEX_ADDRESS !== '0x0000000000000000000000000000000000000000'

/** Outcome enum on the contract: 0 = None, 1 = Yes, 2 = No. */
export const OUTCOME = {
  None: 0,
  Yes: 1,
  No: 2,
} as const

export type Outcome = 0 | 1 | 2

export const CATEGORIES = ['BTC Price', 'Mezo', 'Crypto', 'Other'] as const
