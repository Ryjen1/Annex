# Annex — Frontend

Vite + React 18 + TypeScript, wagmi v2 + viem for chain access, Tailwind CSS v4 for the
dark Bitcoin-orange theme, and `@mezo-org/passport` for the wallet stack.

## Run

```bash
npm install
cp .env.example .env    # set VITE_ANNEX_ADDRESS to your deployment
npm run dev
```

| Env var | Purpose |
|---|---|
| `VITE_ANNEX_ADDRESS` | deployed Wave 2 `AnnexMarket` address |
| `VITE_MUSD_ADDRESS` | settlement token, defaults to canonical Mezo Testnet MUSD |
| `VITE_BORROWER_OPERATIONS_ADDRESS` | optional override (defaults to `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`) |
| `VITE_TROVE_MANAGER_ADDRESS` | optional override (defaults to `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`) |
| `VITE_PRICE_FEED_ADDRESS` | optional override (defaults to `0x86bCF0841622a5dAC14A313a15f96A95421b9366`) |
| `VITE_HINT_HELPERS_ADDRESS` | optional override (`0x4e4c...BCF6`) |
| `VITE_SORTED_TROVES_ADDRESS` | optional override (`0x722E...68fA`) |
| `VITE_RPC_URL` | override the RPC URL (e.g. `http://127.0.0.1:8545` for anvil) |
| `VITE_WALLETCONNECT_PROJECT_ID` | optional; enables the WalletConnect connector |

## Layout

```
src/
├── lib/
│   ├── chains.ts      Mezo Testnet chain definition (multicall3, explorer)
│   ├── abi.ts         AnnexMarket Wave 2 ABI (generated from forge output)
│   ├── mezoAbi.ts     Mezo BorrowerOperations, TroveManager, PriceFeed, HintHelpers, SortedTroves ABIs
│   ├── contracts.ts   verified addresses, Outcome & MarketKind enums, categories
│   ├── format.ts      MUSD / BTC / USD price / ICR / countdown formatting
│   └── wagmi.ts       wagmi config via the Mezo Passport wallet list
├── hooks/
│   ├── useMarkets.ts  batched market + PriceFeed + position + feeBps reads
│   ├── usePriceCurve.ts 21-point live curve computed via fee-adjusted quotes
│   ├── useTrove.ts    live Trove ICR / liq price / HintHelpers lookups
│   └── useNow.ts      ticking clock for countdowns
├── components/
│   ├── Header.tsx            nav (/markets, /trove, /create, /portfolio), wallet button
│   ├── MarketCard.tsx        market card with PriceFeed/Manual badges + YES/NO bar
│   ├── TroveFundingPanel.tsx in-app Trove open/top-up/borrow & refinance flow
│   └── TradePanel.tsx        approve → buy, 0.30% fee disclosure, inline Trove drawer
└── pages/
    ├── Landing.tsx      hero, featured markets, Trove CTA
    ├── Trove.tsx        dedicated in-app Mezo Trove & MUSD dashboard
    ├── Markets.tsx      list, PriceFeed/category filters, search, pool stats
    ├── MarketDetail.tsx market info, PriceFeed permissionless settle vs Manual resolve, redeem
    ├── CreateMarket.tsx dual MarketKind (PriceFeed BTC/USD vs Manual) builder + Trove drawer
    └── Portfolio.tsx    positions, Trove health card, redeem & LP claim actions
```

## Notes

- **React 18, not 19** — the Mezo Passport SDK has a React 18 peer dependency.
- **`vite-plugin-node-polyfills`** injects `Buffer` / `process` / `global`, which the wallet
  stack expects in the browser. Do not remove it.
- The frontend batches reads through `multicall3`. A local anvil does not have that contract
  — install it with:
  ```bash
  cast rpc anvil_setCode 0xcA11bde05977b3631167028862bE2a173976CA11 <runtime-bytecode> --rpc-url http://127.0.0.1:8545
  ```
- The `WalletConnect` connector needs a real project id; without one the Bitcoin wallets
  (Unisat, Xverse, OKX) and injected wallets still work.
