// SPDX-License-Identifier: MIT
import { Link } from 'react-router-dom'

import { HeroScene } from '../components/HeroScene'
import { MarketCard } from '../components/MarketCard'
import { ArrowUpRight, BoltIcon, LayersIcon, ShieldIcon } from '../components/icons'
import { useMarkets } from '../hooks/useMarkets'
import { useNow } from '../hooks/useNow'

const FEATURES = [
  {
    icon: LayersIcon,
    title: 'Create a market',
    body: 'Post any yes/no question with your own resolution criteria. One transaction seeds a balanced pool and you become the first liquidity provider.',
  },
  {
    icon: BoltIcon,
    title: 'Trade on chain',
    body: 'Buy YES or NO from a constant-product AMM priced by the pool itself. The quote you see is the marginal price — no order book, no operator.',
  },
  {
    icon: ShieldIcon,
    title: 'Settle in MUSD',
    body: 'Winning shares redeem 1:1 for MUSD, Bitcoin-backed and fully on-chain. Every MUSD deposited is provably collateralised by the pool.',
  },
]

export function Landing() {
  const { markets } = useMarkets()
  const now = useNow()

  const live = markets.filter((m) => !m.resolved && now < m.endTime).slice(0, 2)
  const featured = live.length > 0 ? live : markets.slice(0, 2)

  return (
    <div>
      <section className="relative flex min-h-screen w-full items-center justify-start overflow-hidden">
        <HeroScene />

        <div className="shell relative z-10 pt-28 pb-24">
          <div className="max-w-3xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-annex-orange/30 bg-annex-orange/10 px-4 py-1.5 text-xs font-medium tracking-[0.18em] text-annex-orange-soft uppercase backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-annex-orange shadow-[0_0_10px_rgba(247,147,26,0.9)]" />
              Live on Mezo Testnet
            </span>

            <h1 className="font-display text-5xl leading-[0.95] font-bold tracking-[-0.045em] text-white sm:text-7xl lg:text-[76px]">
              Trade the outcome
              <br />
              <span className="text-gradient-brand">of anything</span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/60">
              Permissionless binary prediction markets on Mezo. Create a question, take YES or NO
              against an on-chain AMM, settle 1:1 in MUSD. No custody, no operator, no order
              book.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/markets"
                className="btn-primary btn-primary-hover inline-flex items-center gap-2 px-7 py-3.5 text-[15px]"
              >
                Explore markets
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                to="/create"
                className="btn-ghost inline-flex items-center gap-2 px-7 py-3.5 text-[15px]"
              >
                Create a market
              </Link>
            </div>

            <div className="mt-14 flex flex-wrap items-center gap-x-10 gap-y-5">
              <Stat label="Markets live" value={String(markets.filter((m) => !m.resolved).length)} />
              <Stat label="Settled in" value="MUSD" />
              <Stat label="Gas" value="BTC" />
              <Stat label="Custody" value="None" />
            </div>
          </div>
        </div>
      </section>

      <section className="shell section-pad">
        <div className="max-w-2xl">
          <span className="label-caps">What is Annex?</span>
          <h2 className="font-display mt-4 text-4xl leading-[1.02] font-bold tracking-[-0.035em] text-white sm:text-6xl">
            A market maker in your pocket
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/55">
            Bitcoin has the money, the users and the finality — and no venue for collective
            opinion. Annex is the venue: one contract, one AMM, settlement you can read off the
            bytecode.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className="surface group animate-fade-up p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-annex-orange/25"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-annex-orange/12 text-annex-orange ring-1 ring-annex-orange/25 transition-transform duration-300 group-hover:scale-105">
                <feature.icon className="h-6 w-6" />
              </span>
              <h3 className="font-display mt-6 text-xl font-semibold tracking-tight text-white">
                {feature.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/50">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell section-pad">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="label-caps">Featured markets</span>
            <h2 className="font-display mt-4 text-4xl leading-[1.02] font-bold tracking-[-0.035em] text-white sm:text-6xl">
              Live right now
            </h2>
          </div>
          <Link
            to="/markets"
            className="group inline-flex items-center gap-2 text-sm font-medium text-annex-orange transition-colors hover:text-annex-orange-soft"
          >
            View all markets
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {featured.map((market) => (
            <MarketCard key={market.id} market={market} now={now} />
          ))}
        </div>
      </section>

      <section className="shell pb-24">
        <div className="relative overflow-hidden rounded-4xl border border-annex-orange/20 bg-[radial-gradient(ellipse_at_center,rgba(247,147,26,0.16),transparent_65%)] px-8 py-16 text-center">
          <div className="relative z-10">
            <h2 className="font-display text-3xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
              Ready to start trading?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/55">
              Connect a Bitcoin wallet, take a side on a market, and settle in MUSD. It takes
              two transactions and nothing else.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/markets"
                className="btn-primary btn-primary-hover inline-flex items-center gap-2 px-7 py-3.5 text-[15px]"
              >
                Explore markets
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                to="/create"
                className="btn-ghost inline-flex items-center gap-2 px-7 py-3.5 text-[15px]"
              >
                Create the first market
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs tracking-[0.16em] text-white/35 uppercase">{label}</div>
    </div>
  )
}
