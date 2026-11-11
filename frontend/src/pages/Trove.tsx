// SPDX-License-Identifier: MIT
import { TroveFundingPanel } from '../components/TroveFundingPanel'
import { BitcoinIcon, ExternalIcon } from '../components/icons'
import { explorerAddress } from '../lib/chains'
import {
  BORROWER_OPERATIONS_ADDRESS,
  MEZO_FAUCET_URL,
  PRICE_FEED_ADDRESS,
  TROVE_MANAGER_ADDRESS,
} from '../lib/contracts'

export function Trove() {
  return (
    <div className="shell mx-auto max-w-4xl pb-24 pt-28 md:pt-40">
      <div className="animate-fade-up">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-annex-orange/25 bg-annex-orange/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-annex-orange-soft uppercase">
          <BitcoinIcon className="h-3.5 w-3.5" />
          Mezo Native Collateral
        </span>
        <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl">
          Mint <span className="text-gradient">MUSD</span> from BTC
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50 sm:text-base">
          Open or top up a Bitcoin-backed Trove directly through Mezo{' '}
          <code className="font-mono text-white/75">BorrowerOperations</code> to fund your prediction
          market trades or seed new liquidity pools without leaving Annex.
        </p>
      </div>

      <div className="animate-fade-up mt-8 [animation-delay:80ms]">
        <TroveFundingPanel />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <InfoCard
          title="1. Get testnet BTC"
          body="Gas and Trove collateral on Mezo Testnet use BTC. Request free testnet BTC first."
          href={MEZO_FAUCET_URL}
          linkLabel="Mezo Faucet"
        />
        <InfoCard
          title="2. BorrowerOperations"
          body="Open a Trove (>= 1,800 MUSD net debt) or add BTC & draw more MUSD from an existing Trove."
          href={explorerAddress(BORROWER_OPERATIONS_ADDRESS)}
          linkLabel="Contract"
        />
        <InfoCard
          title="3. Live Oracle & Health"
          body="ICR and liquidation price update continuously from Mezo TroveManager and canonical PriceFeed."
          href={explorerAddress(PRICE_FEED_ADDRESS)}
          linkLabel="PriceFeed"
          secondaryHref={explorerAddress(TROVE_MANAGER_ADDRESS)}
          secondaryLabel="TroveManager"
        />
      </div>
    </div>
  )
}

function InfoCard({
  title,
  body,
  href,
  linkLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string
  body: string
  href: string
  linkLabel: string
  secondaryHref?: string
  secondaryLabel?: string
}) {
  return (
    <div className="glass rounded-3xl p-5">
      <h2 className="font-display text-sm font-semibold text-white">{title}</h2>
      <p className="mt-2 text-xs leading-relaxed text-white/45">{body}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-annex-orange hover:underline"
        >
          {linkLabel} <ExternalIcon className="h-3 w-3" />
        </a>
        {secondaryHref && secondaryLabel && (
          <a
            href={secondaryHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-white/60 hover:text-annex-orange"
          >
            {secondaryLabel} <ExternalIcon className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}
