// SPDX-License-Identifier: MIT
import { getConfig } from '@mezo-org/passport/dist/src/config'
import { http, type Transport } from 'viem'

import { mezoTestnet } from './chains'

const transports: Record<number, Transport> = {}
transports[mezoTestnet.id] = http(mezoTestnet.rpcUrls.default.http[0])

/**
 * wagmi config built on the Mezo Passport wallet list
 * (Unisat / Xverse / OKX Bitcoin wallets, WalletConnect, injected EVM wallets).
 *
 * A WalletConnect project id is only needed for the WalletConnect connector.
 * Set VITE_WALLETCONNECT_PROJECT_ID in .env to enable it.
 */
export const wagmiConfig = getConfig({
  appName: 'Annex',
  appDescription: 'Permissionless binary prediction markets settled in MUSD',
  appUrl: typeof window === 'undefined' ? 'https://annex.me' : window.location.origin,
  mezoNetwork: 'testnet',
  walletConnectProjectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'annex000000000000000000000000000',
  chains: [mezoTestnet],
  transports,
})
