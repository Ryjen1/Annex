// SPDX-License-Identifier: MIT

/**
 * Deployment & canonical Mezo Testnet (chain 31611) addresses.
 *
 * Override Annex/MUSD addresses with Vite env vars:
 *   VITE_ANNEX_ADDRESS=0x...   deployed AnnexMarket
 *   VITE_MUSD_ADDRESS=0x...    settlement token (defaults to canonical Mezo Testnet MUSD)
 */
export const ANNEX_ADDRESS = (import.meta.env.VITE_ANNEX_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export const MUSD_ADDRESS = (import.meta.env.VITE_MUSD_ADDRESS ??
  '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503') as `0x${string}`

/** Verified Mezo Testnet (matsnet) core MUSD protocol contracts (checked on-chain). */
export const BORROWER_OPERATIONS_ADDRESS = (import.meta.env.VITE_BORROWER_OPERATIONS_ADDRESS ??
  '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5') as `0x${string}`

export const TROVE_MANAGER_ADDRESS = (import.meta.env.VITE_TROVE_MANAGER_ADDRESS ??
  '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0') as `0x${string}`

export const PRICE_FEED_ADDRESS = (import.meta.env.VITE_PRICE_FEED_ADDRESS ??
  '0x86bCF0841622a5dAC14A313a15f96A95421b9366') as `0x${string}`

export const HINT_HELPERS_ADDRESS = (import.meta.env.VITE_HINT_HELPERS_ADDRESS ??
  '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6') as `0x${string}`

export const SORTED_TROVES_ADDRESS = (import.meta.env.VITE_SORTED_TROVES_ADDRESS ??
  '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA') as `0x${string}`

export const MEZO_FAUCET_URL = 'https://faucet.test.mezo.org/'

export const isDeployed = ANNEX_ADDRESS !== '0x0000000000000000000000000000000000000000'

/** Outcome enum on the contract: 0 = None, 1 = Yes, 2 = No. */
export const OUTCOME = {
  None: 0,
  Yes: 1,
  No: 2,
} as const

export type Outcome = 0 | 1 | 2

/** Market resolution kind on the contract: 0 = Manual, 1 = PriceFeed. */
export const MARKET_KIND = {
  Manual: 0,
  PriceFeed: 1,
} as const

export type MarketKind = 0 | 1

export const CATEGORIES = ['BTC Price', 'Mezo', 'Crypto', 'Other'] as const
