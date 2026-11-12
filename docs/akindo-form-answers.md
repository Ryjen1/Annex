# Annex — AKINDO form answers (Wave 2)

> Paste-ready answers for the Wave 2 submission form sections (including OVERVIEW to replace the Wave 1 `#ERROR!`).

==============================================================================
OVERVIEW
==============================================================================
Annex is a permissionless, non-custodial binary prediction market protocol built natively on Mezo and settled in MUSD. In Wave 2, users can open or top up their own MUSD Trove directly inside the app via BorrowerOperations and TroveManager, trade objective BTC/USD strike markets settled permissionlessly against the canonical Mezo PriceFeed alongside resolver-settled event markets, and pay a disclosed 0.30% protocol entry fee isolated from 1:1 redeemable pool collateral.

==============================================================================
WHAT IT DOES
==============================================================================
Annex is a permissionless binary prediction market protocol on Mezo Testnet, settled 100% in MUSD.

Wave 2 connects Mezo's core CDP and oracle primitives directly into both the smart contract and frontend:
1. In-app Trove funding: From `/trove` or directly inside the trade and create drawers, any user can inspect their live BTC collateral, MUSD debt, individual collateral ratio (ICR), borrowing capacity and liquidation price via `TroveManager` and `AnnexMarket.getUserTroveState`, then open a Trove, add collateral, or draw extra MUSD through `BorrowerOperations` without leaving Annex.
2. Two clearly separated market types: Objective BTC/USD threshold markets (`createPriceMarket`, e.g. "BTC >= $95,000 at expiry") settle permissionlessly after `endTime` using Mezo's canonical `PriceFeed.fetchPrice()` (`resolvePriceMarket`), with manual overrides blocked on-chain. Subjective/event markets keep `MarketKind.Manual` resolver settlement (`resolve`).
3. Constant-product AMM with isolated revenue: `buyShares` charges a disclosed 0.30% (`30 bps`) protocol entry fee into `accruedFees`, splits the remaining MUSD into YES + NO shares across `reserveYes * reserveNo = k`, and guarantees 1:1 MUSD redemptions (`0%` exit fee) for winners while LPs claim the remaining pool surplus.

All 65 Foundry tests (unit, fuzz, reentrancy, Wave 1 regression + Wave 2 PriceFeed/fee/Trove tests) and production frontend checks pass, and the Wave 2 `AnnexMarket` contract is deployed and verified on Mezo Testnet at `0x3b760389E795a191219e86edD8bef498B31c680d` (`https://explorer.test.mezo.org/address/0x3b760389E795a191219e86edD8bef498B31c680d`) alongside legacy Wave 1 contract `0xfdbfde0a430de94c1d862cfc290c36549b5a501d` — with a live 2,440 MUSD Trove, 8 seeded/tested markets, non-deployer trades, permissionless `resolvePriceMarket`, 1:1 redemptions, and `0.48 MUSD` `claimFees` verified on-chain.

==============================================================================
THE PROBLEM IT SOLVES
==============================================================================
Prediction markets have proven demand, yet most venues are either custodial and opaque or live on external chains requiring a bridge and a non-Bitcoin stablecoin. Even when deployed on a Bitcoin EVM, treating MUSD as a plain ERC-20 still forces users out of the product to open a CDP elsewhere before they can fund a single trade, and leaves objective price markets dependent on manual human resolution.

Annex solves all three on Mezo:
- Native onboarding: Users turn BTC into MUSD inside Annex via Mezo's `BorrowerOperations`, watching live ICR and liquidation price update as they mint, then move immediately into markets.
- Trust-minimized BTC settlement: BTC/USD strike markets resolve strictly from Mezo's canonical `PriceFeed` after expiry while subjective event markets remain cleanly separated under creator/resolver governance.
- Sustainable, provably solvent economics: A 0.30% entry fee funds the protocol inside an isolated `accruedFees` ledger while `MUSD.balanceOf(this) == totalLockedCollateral + accruedFees` enforces 1:1 MUSD backing on every market position.

==============================================================================
CHALLENGES I RAN INTO
==============================================================================
1. Complete-set AMM pricing bug (Wave 1): Deposits initially skipped complete-set splitting, causing a ~2.2x divergence between quoted marginal price and charged cost. Splitting every net deposit into `netAmount` YES + `netAmount` NO (with counter-side shares seeding the pool) unified quote and execution price, locked in by four named regression tests.
2. `BorrowerOperations.addColl` capacity nuance on Mezo (Wave 2): Testing against real Matsnet CDP contracts showed `addColl` lowers liquidation risk without immediately raising `TroveManager.getTroveMaxBorrowingCapacity` unless `refinance()` updates recorded borrowing capacity. Our `TroveFundingPanel` handles both direct single-tx `adjustTrove` and `addColl -> refinance -> withdrawMUSD` automatically.
3. Mezo `PriceFeed` custom precompile (`0x7b7c...0015`): Canonical `PriceFeed.fetchPrice()` delegates to a Mezo Go precompile on live Testnet RPC (~$73.4k BTC live), while local Anvil forks lack that precompile bytecode unless shimmed; additionally, Matsnet headers omit EIP-4844 blob gas, requiring London/Shanghai EVM settings (`--hardfork shanghai`) in Anvil forks and catching a stale documented address (`96beE5` vs real `0xCdF7...94beE5` for `BorrowerOperations`).
4. `SortedTroves` O(N) gas cost with 350+ testnet Troves: Zero hints force linked-list scans across all Troves; computing exact `(upperHint, lowerHint)` via `HintHelpers` + `SortedTroves` in-app avoids excessive gas and RPC latency.
5. Idle-pool yield safety trade-off: Auditing Mezo `StabilityPool.sol` confirmed withdrawals revert whenever undercollateralized troves exist and `offset()` converts MUSD to BTC collateral during liquidations, so routing resting AMM collateral there would break guaranteed 1:1 MUSD redemption liveness — leading us to defer idle-pool yield cleanly until atomic `sMUSD` vault liquidity exists.

==============================================================================
TECHNOLOGIES I USED
==============================================================================
Contracts: Solidity 0.8.28 (EVM `london`, optimizer 200 runs, via-ir), Foundry + forge-std (65 tests: 51 Wave 1 + 14 Wave 2 unit/fuzz/invariant), Blockscout-verified Wave 2 `AnnexMarket` (`0x3b760389E795a191219e86edD8bef498B31c680d` on `explorer.test.mezo.org`), integrated directly with canonical Mezo MUSD (`0x1189...Ac503`), `PriceFeed` (`0x86bC...b9366`), and `TroveManager` (`0xE47c...6bb0`).

Frontend: React 18, TypeScript, Vite 8, Tailwind CSS v4, wagmi v2 + viem, @mezo-org/passport (RainbowKit), @tanstack/react-query multicalls, vite-plugin-node-polyfills, plus direct ABIs for Mezo `BorrowerOperations` (`0xCdF7...4beE5`), `HintHelpers` (`0x4e4c...BCF6`), and `SortedTroves` (`0x722E...68fA`).

Infrastructure: Zero backend, database, or indexer — every Trove health ratio, market quote, AMM price curve (`getBuyQuoteWithFee`), and settlement reads from and writes directly to Mezo Testnet (chain 31611) and Vercel static hosting.

==============================================================================
HOW WE BUILT IT
==============================================================================
We extended `AnnexMarket.sol` without adding an upgradeable proxy or breaking the original 51 tests:
- Added `MarketKind { Manual, PriceFeed }` and `PriceMarketConfig { kind, strikePrice, resolveAbove, resolvedPrice }`, implementing `createPriceMarket` and permissionless `resolvePriceMarket` wired to Mezo `PriceFeed.fetchPrice()` (reverting automatically if Mezo's oracle is stale). Existing `resolve()` and `setResolver()` reject `PriceFeed` markets with `PriceFeedMarketOnly()`.
- Added `feeBps` (30 bps = 0.30%, immutable/capped at `MAX_FEE_BPS = 200`), separating `totalLockedCollateral` from `accruedFees` so `claimFees()` can never touch market collateral and `redeem()` / `claimLp()` remain 1:1 with zero exit fee.
- Exposed `getBuyQuoteWithFee`, `liveBtcPrice`, and `getUserTroveState` directly on `AnnexMarket` and wired a complete in-app Trove manager (`/trove` + inline `TroveFundingPanel` inside trade/create flows) using `BorrowerOperations`, `HintHelpers`, and `SortedTroves`.
- Audited Mezo `StabilityPool` on-chain before declining risky idle-collateral parking, then verified everything across 65 Foundry tests, TypeScript/oxlint checks, and an end-to-end Mezo Testnet fork script (`openTrove` -> `addColl` -> `withdrawMUSD` -> `SeedMarkets` -> `buyShares` with 30 bps fee -> `resolvePriceMarket` -> `redeem` -> `claimLp` -> `claimFees`).

==============================================================================
WHAT WE LEARNED
==============================================================================
1. Composability means meeting the other protocol's exact state machine: integrating `BorrowerOperations` revealed `maxBorrowingCapacity` persistence across `addColl`/`refinance()` and O(N) hint sensitivity in `SortedTroves` — details you only catch by testing against the live chain contracts.
2. Pricing and accounting invariants are the real UX: entry-fee isolation (`totalLockedCollateral` vs `accruedFees`) keeps every YES/NO share redeemable at an exact 1.00 MUSD par while giving the protocol clean revenue.
3. Saying "no" to unsafe yield is an engineering deliverable: proving from `StabilityPool.sol` bytecode why parking prediction collateral there can block withdrawals saved user solvency from silent liquidation risk.
4. Keeping objective PriceFeed markets and subjective resolver markets structurally separate eliminates ambiguity for both traders and automated settlement bots. 
