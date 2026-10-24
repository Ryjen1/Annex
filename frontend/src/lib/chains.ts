// SPDX-License-Identifier: MIT
import { defineChain } from 'viem'

/**
 * Mezo Testnet.
 * Chain id 31611 (0x7b7b), native coin BTC (18 decimals), gas paid in BTC.
 *
 * VITE_RPC_URL can point the app at a local node (anvil) for development.
 */
const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://rpc.test.mezo.org'

/**
 * Websocket support is opt-in.
 *
 * Mezo's `wss://rpc-ws.test.mezo.org` currently answers the HTTP upgrade with
 * `400 Bad Request` and no `Connection: upgrade` header, so any client that tries
 * to subscribe over it fails with "Connection header did not include 'upgrade'".
 * Annex polls over plain HTTP, so we do not advertise a websocket URL unless one
 * is explicitly configured (e.g. a local anvil at ws://127.0.0.1:8546).
 */
const wssUrl = import.meta.env.VITE_WSS_URL as string | undefined

const rpcUrls = {
  default: {
    http: [rpcUrl],
    ...(wssUrl ? { webSocket: [wssUrl] } : {}),
  },
  public: {
    http: [rpcUrl],
    ...(wssUrl ? { webSocket: [wssUrl] } : {}),
  },
} as const

export const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 18,
  },
  rpcUrls,
  blockExplorers: {
    default: {
      name: 'Mezo Testnet Explorer',
      url: 'https://explorer.test.mezo.org',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 3669328,
    },
  },
  testnet: true,
})

export const MEZO_CHAIN_ID = 31611
export const MEZO_TESTNET_RPC = 'https://rpc.test.mezo.org'
export const MEZO_EXPLORER = 'https://explorer.test.mezo.org'

/** Canonical MUSD (18 decimals) on Mezo Testnet. */
export const MUSD_ADDRESS = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503' as const

export function explorerTx(hash: `0x${string}`) {
  return `${MEZO_EXPLORER}/tx/${hash}`
}

export function explorerAddress(address: `0x${string}`) {
  return `${MEZO_EXPLORER}/address/${address}`
}
