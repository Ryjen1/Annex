// SPDX-License-Identifier: MIT
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { erc20Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { Link, NavLink } from 'react-router-dom'

import { MUSD_ADDRESS } from '../lib/contracts'
import { formatMusd, shortAddress } from '../lib/format'
import { BitcoinIcon } from './icons'

const NAV = [
  { to: '/', label: 'Markets', end: true },
  { to: '/create', label: 'Create' },
  { to: '/portfolio', label: 'Portfolio' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `relative rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 sm:px-4 sm:py-2 sm:text-sm ${
    isActive ? 'text-annex-orange' : 'text-annex-muted hover:text-annex-ink'
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
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="glass mx-auto flex max-w-6xl items-center gap-2 rounded-full px-2.5 py-2 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] sm:gap-3 sm:px-4">
        <Link to="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-annex-orange-soft to-annex-orange-deep text-black shadow-[0_8px_24px_-10px_rgba(247,147,26,0.9)]">
            <BitcoinIcon className="h-5 w-5" />
          </span>
          <span className="font-display hidden text-[17px] font-semibold tracking-tight sm:block">
            <span className="text-gradient">Annex</span>
          </span>
        </Link>

        <nav className="ml-1 flex items-center gap-0.5 sm:ml-2 sm:gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-annex-orange to-transparent sm:inset-x-4" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isConnected && (
            <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/4 py-1.5 pl-3 pr-4 lg:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-annex-green shadow-[0_0_8px_rgba(62,207,142,0.8)]" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-annex-muted">
                MUSD
              </span>
              <span className="font-mono text-sm font-medium tabular-nums">
                {formatMusd(musdBalance)}
              </span>
            </div>
          )}

          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              if (!mounted || !account) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="btn-primary btn-primary-hover whitespace-nowrap px-3.5 py-2 text-[13px] sm:text-sm"
                  >
                    Connect
                  </button>
                )
              }
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-4 text-sm font-medium transition-colors hover:border-annex-orange/50"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-annex-green shadow-[0_0_8px_rgba(62,207,142,0.8)]" />
                    {account.displayName ?? shortAddress(account.address)}
                  </button>
                  {chain && !chain.unsupported && (
                    <span className="hidden text-xs text-annex-muted xl:inline">{chain.name}</span>
                  )}
                </div>
              )
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </header>
  )
}
