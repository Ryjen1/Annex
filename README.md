# Annex

**Permissionless binary prediction markets on Mezo Testnet, deeply wired into native MUSD primitives.**

Anyone can launch an oracle-settled BTC/USD price market powered by Mezo's canonical
`PriceFeed` or a custom event market with an explicit resolver. Users can open or top up a
Bitcoin-backed Trove via `BorrowerOperations` directly inside the app (with live collateral
ratio and liquidation price from `TroveManager`), trade YES or NO shares through an on-chain
constant-product AMM with a transparent `0.30%` protocol fee, and redeem winning shares
strictly 1:1 for MUSD.

- **Chain:** Mezo Testnet (chain id `31611`, gas paid in BTC)
- **Canonical MUSD:** `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (18 decimals)
- **Canonical Mezo Primitives (verified on-chain):**
  - `BorrowerOperations`: [`0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`](https://explorer.test.mezo.org/address/0xCdF7028ceAB81fA0C6971208e83fa7872994beE5) *(note: earlier Wave 1 notes contained a typo `96beE5`, which has no bytecode on testnet; `94beE5` is the live contract)*
  - `TroveManager`: [`0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`](https://explorer.test.mezo.org/address/0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0)
  - `PriceFeed`: [`0x86bCF0841622a5dAC14A313a15f96A95421b9366`](https://explorer.test.mezo.org/address/0x86bCF0841622a5dAC14A313a15f96A95421b9366)
- **Wave 2 Contract (Mezo Testnet, Blockscout verified):** [`0x3b760389E795a191219e86edD8bef498B31c680d`](https://explorer.test.mezo.org/address/0x3b760389E795a191219e86edD8bef498B31c680d) (`FEE_BPS=30`, deployed & verified)
- **Wave 1 Contract (legacy v1):** [`0xfdbfde0a430de94c1d862cfc290c36549b5a501d`](https://explorer.test.mezo.org/address/0xfdbfde0a430de94c1d862cfc290c36549b5a501d)
- **Live app:** https://annex-markets.vercel.app
- **Repo:** https://github.com/Ryjen1/Annex
- **Docs:** [`docs/architecture.md`](docs/architecture.md) · [`docs/pitch-deck.md`](docs/pitch-deck.md) · [`docs/submission.md`](docs/submission.md) · [`docs/demo-script.md`](docs/demo-script.md)

---

## Wave 2 Architecture Overview

### 1. In-App Trove Funding (`BorrowerOperations` + `TroveManager` + `PriceFeed`)
- First-time or underfunded traders/creators can open or top up a Bitcoin-backed Trove inside Annex (`/trove`, inside the `Trade` panel, and inside `Create Market`) without leaving the trade flow.
- `AnnexMarket.getUserTroveState(user)` reads live `TroveManager` debt/collateral/ICR/`maxBorrowingCapacity` alongside `PriceFeed` BTC/USD directly on-chain.
- The UI computes Liquity `SortedTroves`/`HintHelpers` insertion hints, live collateral ratio, liquidation price (`debt * MCR / coll`), and automatically handles Mezo's `addColl -> refinance -> withdrawMUSD` flow when borrowing against newly added BTC collateral.

### 2. Two Strictly Separated Market Types (`PriceFeed` vs `Manual`)
- **`MarketKind.PriceFeed` (Objective BTC/USD Markets):** Created via `createPriceMarket(question, description, endTime, initialLiquidity, strikePrice, resolveAbove)`. Stored with `resolver = address(priceFeed)`. At or after `endTime`, **anyone** can permissionlessly call `resolvePriceMarket(marketId)`, which reads `priceFeed.fetchPrice()` on-chain (reverting if Mezo's `PriceFeed` reports a stale oracle). Neither the creator nor protocol owner can call `resolve()` or `setResolver()` on a `PriceFeed` market.
- **`MarketKind.Manual` (Subjective Event Markets):** Created via `createMarket(...)` for non-oracle events (protocol milestones, qualitative outcomes). Resolved after `endTime` by the designated resolver or early by the owner. Manual and PriceFeed settlement paths cannot cross.

### 3. Protocol Revenue & Collateral Isolation (`0.30%` Entry Fee)
- **Rate & Point of Deduction:** **`0.30%` (`30 bps`)**, hard-capped at `MAX_FEE_BPS = 200` (`2.00%`) at deployment (`immutable feeBps`). Charged in MUSD on trade entry (`buyShares`), while `createMarket`, `createPriceMarket`, `redeem`, and `claimLp` charge **`0%`**. Taking the fee on entry guarantees winning shares always redeem **1.00 MUSD per share (1:1)** — matching the quoted payoff shown to traders.
- **Strict Isolation:** Fees accumulate into `accruedFees`, separate from market pool collateral `totalCollateral` and global `totalLockedCollateral`. `claimFees(to)` (owner-only) transfers strictly `accruedFees` and cannot touch a single wei of user or LP collateral, even if claimed mid-market before resolution.

### 4. Constant-Product AMM & Solvency Invariants
For a gross trade `musdAmount`:
```
fee       = (musdAmount * feeBps) / 10_000
netAmount = musdAmount - fee                  // enters AMM + pool collateral

netAmount MUSD ──► split into netAmount YES + netAmount NO
                    ├── opposite half enters AMM reserve (k = reserveYes * reserveNo preserved)
                    └── buyer receives netAmount + swapOut shares
```

Exact on-chain invariants enforced across all paths and fuzz tests:
- **Per-market solvency:** `totalCollateral == totalYes == totalNo`
- **Global fee/collateral isolation:** `musd.balanceOf(address(this)) >= totalLockedCollateral + accruedFees`
- **Quoted-price honesty:** `priceYes = reserveNo / (reserveYes + reserveNo)`

### 5. Idle-Pool Yield Assessment (Designed, Deliberately Deferred)
We evaluated deploying idle `AnnexMarket` MUSD into Mezo's **Stability Pool** (`0x1CCA7E410eE41739792eA0A24e00349Dd247680e`), **Mezo Pools**, or a savings vault, and **deliberately deferred** it in Wave 2 so user redemptions can never be blocked or short:
1. **Redemption Liveness Risk (`StabilityPool.sol`):** Calling `withdrawFromSP(_amount)` invokes `_requireNoUnderCollateralizedTroves()`, which **reverts whenever any Trove in Mezo has ICR < 110%** — freezing prediction market winners' `redeem()` and LP exits during volatile BTC moves when settlements happen most.
2. **MUSD Solvency Breakdown (`offset()`):** Stability Pool liquidations burn deposited MUSD and replace it with volatile BTC collateral gains (`collateralGain`), violating strict 1:1 MUSD backing (`totalCollateral == totalYes == totalNo`).
3. **DEX IL & Missing Testnet Vault:** AMM LP pools introduce impermanent loss/slippage, and no canonical `sMUSD` ERC-4626 vault is deployed in `@mezo-org/musd-contracts` on `matsnet`. When an instant-liquidity, MUSD-only ERC-4626 buffer with liquid reserve floors becomes available, we can add a capped reserve sleeve without weakening 1:1 redemptions.

---

## Repository Layout

```
Annex/
├── contracts/                   Foundry project (Solidity 0.8.28 / EVM london)
│   ├── src/
│   │   ├── AnnexMarket.sol      Core engine: PriceFeed markets, Manual markets, AMM, Trove reads, fee ledger
│   │   ├── IERC20.sol           Minimal ERC-20 interface
│   │   └── MockMUSD.sol         ERC-20 mock for offline local testing
│   ├── test/
│   │   ├── AnnexMarket.t.sol        51 Wave 1 regression tests (unit, fuzz, reentrancy, lifecycle)
│   │   ├── AnnexMarketWave2.t.sol   14 Wave 2 tests (PriceFeed oracle, fee isolation, Trove reads, fuzz)
│   │   └── mocks/                   MockPriceFeed.sol, MockTroveManager.sol, ReentrantMUSD.sol
│   └── script/                  DeployAnnex.s.sol, SeedMarkets.s.sol, SmokeTestWave2.s.sol
├── frontend/                    Vite + React 18 + TypeScript + wagmi v2 + viem + Tailwind v4
│   ├── src/lib/                 chains.ts, abi.ts, mezoAbi.ts, contracts.ts, amm.ts, format.ts, wagmi.ts
│   ├── src/hooks/               useMarkets.ts, usePriceCurve.ts, useTrove.ts
│   ├── src/components/          Header, MarketCard, PriceCurve, TradePanel, TroveFundingPanel
│   └── src/pages/               Landing, Markets, MarketDetail, CreateMarket, Portfolio, Trove
└── docs/                        architecture.md, submission.md, akindo-form-answers.md, pitch-deck.md, demo-script.md
```

---

## Running & Verifying

### Contracts (65 tests: 51 Wave 1 + 14 Wave 2)
```bash
cd contracts
forge build
forge test -vvv
```

### Deploy & Verify on Mezo Testnet (chain id `31611`)
1. Get testnet BTC from [faucet.test.mezo.org](https://faucet.test.mezo.org/), then open a Trove inside Annex (`/trove`) or via `BorrowerOperations` (`0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`) to mint MUSD.
2. Deploy, verify source code on Mezo Blockscout Explorer, and seed both PriceFeed and Manual markets:
```bash
export RPC_URL=https://rpc.test.mezo.org
export PRIVATE_KEY=0x...   # funded with testnet BTC & MUSD

cd contracts
forge script script/DeployAnnex.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://api.explorer.test.mezo.org/api/

ANNEX_ADDRESS=0x... forge script script/SeedMarkets.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

To verify an already-deployed contract directly on Blockscout:
```bash
forge verify-contract <ANNEX_ADDRESS> src/AnnexMarket.sol:AnnexMarket \
  --chain 31611 \
  --verifier blockscout \
  --verifier-url https://api.explorer.test.mezo.org/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address,address,uint256)" \
    0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 \
    0x86bCF0841622a5dAC14A313a15f96A95421b9366 \
    0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0 \
    30)
```

> **Note on local forks (`anvil --fork-url`):** Mezo's `PriceFeed` calls an on-chain Cosmos/Skip precompile at `0x7b7c000000000000000000000000000000000015`. Standard `anvil` nodes run EVM bytecode rather than Mezo's Go precompile, so fork simulations must shim `0x7b7c...0015` via `anvil_setCode`; live Mezo Testnet RPC handles it natively.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env    # set VITE_ANNEX_ADDRESS
npm run build
npm run dev
```

| Env var | Purpose |
|---|---|
| `VITE_ANNEX_ADDRESS` | Deployed `AnnexMarket` address |
| `VITE_MUSD_ADDRESS` | Settlement token (defaults to canonical Mezo MUSD) |
| `VITE_RPC_URL` | Optional RPC override (e.g. local anvil) |
| `VITE_BORROWER_OPERATIONS_ADDRESS` | Optional override (defaults to `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`) |
| `VITE_TROVE_MANAGER_ADDRESS` | Optional override (defaults to `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`) |
| `VITE_PRICE_FEED_ADDRESS` | Optional override (defaults to `0x86bCF0841622a5dAC14A313a15f96A95421b9366`) |

---

## Contract API Summary

```solidity
// Market Creation
createMarket(string question, string description, string category, uint256 endTime, uint256 initialLiquidity) returns (uint256 marketId)
createPriceMarket(string question, string description, uint256 endTime, uint256 initialLiquidity, uint256 strikePrice, bool resolveAbove) returns (uint256 marketId)

// Trading & Fees
buyShares(uint256 marketId, Outcome outcome, uint256 musdAmount)
getBuyQuote(uint256 marketId, Outcome outcome, uint256 musdAmount) returns (uint256 sharesOut)
getBuyQuoteWithFee(uint256 marketId, Outcome outcome, uint256 musdAmount) returns (uint256 sharesOut, uint256 fee, uint256 netAmount)
claimFees(address to) // owner-only, transfers strictly accruedFees

// Settlement & Redemption
resolve(uint256 marketId, Outcome outcome)      // Manual markets only
resolvePriceMarket(uint256 marketId)             // PriceFeed markets only, permissionless >= endTime
redeem(uint256 marketId)                         // 1:1 MUSD, 0% exit fee
claimLp(uint256 marketId)

// Views & Mezo Trove Reads
getPriceMarket(uint256 marketId) returns (MarketKind kind, uint256 strikePrice, bool resolveAbove, uint256 resolvedPrice)
liveBtcPrice() returns (uint256)
getUserTroveState(address user) returns (uint8 status, uint256 coll, uint256 debt, uint256 icr, uint256 maxBorrowingCapacity, uint256 mcr, uint256 btcPrice)
getMarketA(uint256 marketId) / getMarketB(uint256 marketId)
getUserPosition(uint256 marketId, address user)
marketCount() returns (uint256)
```

---

## Security & Tech Stack

- `nonReentrant` on `createMarket`, `createPriceMarket`, `buyShares`, `redeem`, `claimLp`, and `claimFees`.
- No upgradeable proxy, no admin withdrawal path for pool collateral, strict separation of `PriceFeed` vs `Manual` resolution.
- Solidity `0.8.28` · Foundry · viem · wagmi v2 · React 18 · TypeScript · Vite · Tailwind CSS v4 · `@mezo-org/passport` · RainbowKit.
