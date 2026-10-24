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
| `VITE_ANNEX_ADDRESS` | deployed `AnnexMarket` address |
| `VITE_MUSD_ADDRESS` | settlement token, defaults to canonical Mezo Testnet MUSD |
| `VITE_RPC_URL` | override the RPC URL (e.g. `http://127.0.0.1:8545` for anvil) |
| `VITE_WALLETCONNECT_PROJECT_ID` | optional; enables the WalletConnect connector |

## Layout

```
src/
├── lib/
│   ├── chains.ts      Mezo Testnet chain definition (multicall3, explorer)
│   ├── abi.ts         AnnexMarket ABI (generated from the forge output)
│   ├── contracts.ts   addresses, Outcome enum, categories
│   ├── format.ts      MUSD / percent / share / countdown formatting
│   └── wagmi.ts       wagmi config via the Mezo Passport wallet list
├── hooks/
│   ├── useMarkets.ts  batched market + position reads
│   └── useNow.ts      ticking clock for countdowns
├── components/
│   ├── Header.tsx     nav, wallet button, MUSD balance
│   ├── MarketCard.tsx market card + YES/NO price bar
│   └── TradePanel.tsx approve → buy, live quote, average price, max payout
└── pages/
    ├── Markets.tsx      list, category filters, search, pool stats
    ├── MarketDetail.tsx market info, position, redeem / claim / resolve
    ├── CreateMarket.tsx create form (approve + create)
    └── Portfolio.tsx    positions and settlement actions
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
