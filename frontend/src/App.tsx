// SPDX-License-Identifier: MIT
import { Route, Routes } from 'react-router-dom'

import { Background } from './components/Background'
import { Header } from './components/Header'
import { CreateMarket } from './pages/CreateMarket'
import { Landing } from './pages/Landing'
import { MarketDetail } from './pages/MarketDetail'
import { Markets } from './pages/Markets'
import { Portfolio } from './pages/Portfolio'
import { BitcoinIcon } from './components/icons'

export default function App() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Background />
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/create" element={<CreateMarket />} />
          <Route path="/portfolio" element={<Portfolio />} />
        </Routes>
      </main>
      <footer className="border-t border-white/6 px-5 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 text-xs text-white/35 sm:flex-row">
          <span className="flex items-center gap-2">
            <BitcoinIcon className="h-3.5 w-3.5 text-annex-orange" />
            Annex — permissionless binary prediction markets on Mezo, settled in MUSD.
          </span>
          <span className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-annex-orange" />
              Non-custodial · on-chain AMM · gas in BTC
            </span>
            <a
              href="https://explorer.test.mezo.org/address/0xfdbfde0a430de94c1d862cfc290c36549b5a501d"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              Mezo Testnet
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
