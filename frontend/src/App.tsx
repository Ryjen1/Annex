// SPDX-License-Identifier: MIT
import { Route, Routes } from 'react-router-dom'

import { Header } from './components/Header'
import { CreateMarket } from './pages/CreateMarket'
import { MarketDetail } from './pages/MarketDetail'
import { Markets } from './pages/Markets'
import { Portfolio } from './pages/Portfolio'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Routes>
          <Route path="/" element={<Markets />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/create" element={<CreateMarket />} />
          <Route path="/portfolio" element={<Portfolio />} />
        </Routes>
      </main>
      <footer className="border-t border-annex-border px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-annex-muted">
          <span>Annex — permissionless binary prediction markets on Mezo, settled in MUSD.</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-annex-orange" />
            Non-custodial · on-chain AMM · gas in BTC
          </span>
        </div>
      </footer>
    </div>
  )
}
