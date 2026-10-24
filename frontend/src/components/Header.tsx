// SPDX-License-Identifier: MIT
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { erc20Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { Link, NavLink } from 'react-router-dom'

import { MUSD_ADDRESS } from '../lib/contracts'
import { formatMusd, shortAddress } from '../lib/format'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-annex-panel-2 text-annex-orange'
      : 'text-annex-muted hover:bg-annex-panel hover:text-white'
  }`

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
    <header className="sticky top-0 z-40 border-b border-annex-border bg-annex-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-annex-orange font-bold text-black">
            A
          </span>
          <span className="text-lg font-bold tracking-tight">
            Annex
            <span className="ml-1 text-xs font-normal text-annex-muted">prediction markets</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={navLinkClass}>
            Markets
          </NavLink>
          <NavLink to="/create" className={navLinkClass}>
            Create
          </NavLink>
          <NavLink to="/portfolio" className={navLinkClass}>
            Portfolio
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isConnected && (
            <div className="hidden items-center gap-2 rounded-lg border border-annex-border bg-annex-panel px-3 py-1.5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-annex-green" />
              <span className="text-xs font-medium text-annex-muted">MUSD</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatMusd(musdBalance)}
              </span>
              <span className="text-xs text-annex-muted">{shortAddress(address)}</span>
            </div>
          )}

          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              if (!mounted) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="rounded-lg bg-annex-orange px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    Connect
                  </button>
                )
              }
              if (!account) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="rounded-lg bg-annex-orange px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    Connect wallet
                  </button>
                )
              }
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 rounded-lg border border-annex-border bg-annex-panel px-3 py-2 text-sm font-medium hover:border-annex-orange"
                  >
                    <span className="h-2 w-2 rounded-full bg-annex-green" />
                    {account.displayName ?? shortAddress(account.address)}
                  </button>
                  {chain && !chain.unsupported && (
                    <span className="hidden text-xs text-annex-muted lg:inline">{chain.name}</span>
                  )}
                </div>
              )
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      <nav className="flex items-center gap-1 border-t border-annex-border px-4 py-2 md:hidden">
        <NavLink to="/" end className={navLinkClass}>
          Markets
        </NavLink>
        <NavLink to="/create" className={navLinkClass}>
          Create
        </NavLink>
        <NavLink to="/portfolio" className={navLinkClass}>
          Portfolio
        </NavLink>
      </nav>
    </header>
  )
}
