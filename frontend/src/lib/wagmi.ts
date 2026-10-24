// SPDX-License-Identifier: MIT
import {
  getConfig,
  okxWalletMezoTestnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoTestnet,
} from '@mezo-org/passport/dist/src/config'
import { injectedWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { http, type Transport } from 'viem'

import { mezoTestnet } from './chains'

const transports: Record<number, Transport> = {}
transports[mezoTestnet.id] = http(mezoTestnet.rpcUrls.default.http[0])

/**
 * wagmi config built on the Mezo Passport wallet list.
 *
 * Two groups:
 *  - Bitcoin: Unisat / Xverse / OKX, wired to the Mezo testnet chain.
 *  - EVM: any injected provider (MetaMask, Rabby, OKX, Brave, …).
 *
 * WalletConnect is only offered when VITE_WALLETCONNECT_PROJECT_ID holds a real
 * WalletConnect Cloud project id — a placeholder id makes the connector fail at
 * runtime and spams the console with rejected relay requests.
 */
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined

const evmWallets = walletConnectProjectId
  ? [injectedWallet, walletConnectWallet]
  : [injectedWallet]

export const wagmiConfig = getConfig({
  appName: 'Annex',
  appDescription: 'Permissionless binary prediction markets settled in MUSD',
  appUrl: typeof window === 'undefined' ? 'https://annex.me' : window.location.origin,
  mezoNetwork: 'testnet',
  walletConnectProjectId: walletConnectProjectId || 'annex000000000000000000000000000',
  chains: [mezoTestnet],
  transports,
  wallets: [
    {
      groupName: 'Bitcoin',
      wallets: [unisatWalletMezoTestnet, xverseWalletMezoTestnet, okxWalletMezoTestnet],
    },
    {
      groupName: 'EVM',
      wallets: evmWallets,
    },
  ],
})
