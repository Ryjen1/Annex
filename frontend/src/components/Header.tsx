// SPDX-License-Identifier: MIT
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { erc20Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { Link, NavLink } from 'react-router-dom'

import { MUSD_ADDRESS } from '../lib/contracts'
import { formatMusd, shortAddress } from '../lib/format'
import { BitcoinIcon } from './icons'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/markets', label: 'Markets' },
  { to: '/create', label: 'Create' },
  { to: '/portfolio', label: 'Portfolio' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
    isActive ? 'text-annex-orange' : 'text-white/55 hover:text-white'
  }`
}

export function Header() {
  const { address, isConnected } = useAccount()

  const { data: musdBalance } = useReadContract({
    address: MUSD_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })

  return (
    <nav className="fixed top-4 left-1/2 z-50 w-[95%] max-w-7xl -translate-x-1/2 overflow-hidden rounded-full border border-white/10 bg-black/25 shadow-lg backdrop-blur-xl transition-all duration-300 md:top-6">
      <div className="relative z-10 flex w-full items-center justify-between px-4 py-3 lg:px-8">
        <Link to="/" className="group flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-annex-orange-soft to-annex-orange-deep text-black shadow-[0_0_20px_-4px_rgba(255,140,0,0.8)]">
            <BitcoinIcon className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-bold tracking-[-0.02em] text-gradient-brand">
            Annex
          </span>
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isConnected && (
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1.5 pr-4 pl-3.5 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-annex-green shadow-[0_0_8px_rgba(62,207,142,0.8)]" />
              <span className="text-[10px] font-medium tracking-[0.16em] text-white/45 uppercase">
                MUSD
              </span>
              <span className="font-mono text-sm tabular-nums">{formatMusd(musdBalance)}</span>
            </div>
          )}

          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              if (!mounted || !account) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="rounded-full border border-white/12 bg-black px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_40px_rgba(255,140,0,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:border-annex-orange/50"
                  >
                    Connect wallet
                  </button>
                )
              }
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 py-1.5 pr-4 pl-3.5 text-sm font-medium transition-colors hover:border-annex-orange/50"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-annex-green shadow-[0_0_8px_rgba(62,207,142,0.8)]" />
                    {account.displayName ?? shortAddress(account.address)}
                  </button>
                  {chain && !chain.unsupported && (
                    <span className="hidden text-xs text-white/40 xl:inline">{chain.name}</span>
                  )}
                </div>
              )
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </nav>
  )
}
