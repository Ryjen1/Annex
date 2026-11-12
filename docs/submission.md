# Annex — AKINDO Submission Copy (Wave 2)

> Paste-ready answers for the Mezo Buildathon submission form (**Wave 2**).
> Fixes the Wave 1 `#ERROR!` product overview, upgrades MUSD integration from L2 to L3+,
> discloses the 0.30% entry protocol fee, and updates live verification/submission steps.
> Product name is **Annex**. No external project names.

---

## Project name

`Annex`

## Product category

`Binary Prediction Markets`

## Overview (replaces `#ERROR!` on AKINDO)

Annex is a permissionless, non-custodial binary prediction market protocol built natively on
Mezo and settled 100% in MUSD. In Wave 2, users can open or top up their own Mezo MUSD Trove
from inside the app via BorrowerOperations and TroveManager, trade objective BTC/USD strike
markets settled permissionlessly by the canonical Mezo PriceFeed alongside resolver-settled
event markets, and pay a transparent 0.30% protocol entry fee isolated from 1:1 market
collateral.

## TL;DR

Annex lets anyone open or top up a Mezo Trove for MUSD in-app, trade YES/NO shares on
BTC/USD PriceFeed strike markets or custom event markets through a constant-product AMM, and
redeem winning shares 1:1 for MUSD after resolution — non-custodial, one contract, gas in BTC.

## How it works

**The problem.** Prediction markets have clear product demand, yet existing venues are
custodial and opaque or live on external chains requiring bridges and non-Bitcoin stablecoins.
Bitcoin has the capital and users, while Mezo brings a native Bitcoin EVM economy (`BTC` gas
and `MUSD` CDP stablecoin).

**What Annex does.** Every market is a pool of YES and NO shares held by a single immutable
contract and priced by a constant-product AMM (`reserveYes × reserveNo = k`). A buyer who
commits `grossAmount` MUSD pays a disclosed `0.30%` (`30 bps`) protocol entry fee into an
isolated `accruedFees` accumulator; the remaining `netAmount` splits into a complete set
(`netAmount` YES + `netAmount` NO). For a YES buy, the NO half stays as counter-collateral
and the pool releases YES via `swapOut`, so the buyer receives `netAmount + swapOut` YES
shares at true marginal pricing (`priceYes = reserveNo / (reserveYes + reserveNo)`). Winning
shares redeem strictly `1:1` for MUSD (`0%` exit fee) while the LP claims the remaining
pool value. Exact on-chain solvency holds after every instruction:
`MUSD.balanceOf(this) == totalLockedCollateral + accruedFees`, with
`totalLockedCollateral == totalYes == totalNo` across all unsettled pools.

**Wave 2 Mezo L3+ Primitives (wired directly inside Annex).**
1. **In-app Trove funding (`BorrowerOperations` + `TroveManager` + `PriceFeed`):** Inside `/trove`
   or inline on the trade and create flows, users inspect their live collateral, debt,
   individual collateral ratio (ICR), borrowing capacity, and liquidation price via
   `TroveManager` and `AnnexMarket.getUserTroveState`, and execute `openTrove`, `addColl`,
   `adjustTrove`, or `addColl → refinance → withdrawMUSD` directly through `BorrowerOperations`
   (`0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`) with on-chain `HintHelpers` and `SortedTroves`
   positioning — eliminating the external hop to mint MUSD.
2. **Dual-path resolution (`MarketKind.PriceFeed` vs `MarketKind.Manual`):** Objective BTC/USD
   threshold markets (`"BTC ≥ $X at expiry"`) are created via `createPriceMarket` and settled
   permissionlessly after `endTime` by `resolvePriceMarket`, which reads canonical Mezo
   `PriceFeed.fetchPrice()` on-chain (reverting if Mezo's `PriceFeed` reports a stale oracle)
   and blocks any manual override. User-created subjective/event markets keep `MarketKind.Manual`
   resolver settlement.
3. **Protocol fee (`0.30%` / `30 bps`, cap `200 bps`):** Taken at `buyShares` entry and routed
   to `accruedFees`. Unlike an exit tax on `redeem()`, entry charging leaves winning shares
   redeemable at an exact `1.00 MUSD` par value and prevents owner `claimFees()` from ever
   touching `totalLockedCollateral`.
4. **Idle-pool yield assessment (designed, explicitly deferred):** We evaluated routing idle
   pool collateral into Mezo `StabilityPool` and Mezo Pools. On-chain `StabilityPool`
   enforces `_requireNoUnderCollateralizedTroves()` on withdrawals and converts deposited MUSD
   into BTC during liquidations (`offset`), while DEX pools introduce impermanent loss and
   slippage. Either would break Annex's guarantee that winning shares redeem 1:1 in MUSD on
   demand, so idle-pool yield is deferred until atomic `sMUSD` vault liquidity exists on Mezo.

**How MUSD is positioned.** MUSD is both the unit of account and the full collateral base of
every prediction pool, minted directly inside the Annex app against BTC collateral via Mezo's
CDP engine and settled back 1:1 in MUSD with BTC paying block gas.

**Why it is safe.** No upgrade proxy, no arbitrary collateral sweep, strict separation between
`totalLockedCollateral` and `accruedFees`, non-reentrant state transitions, and 65 Foundry
tests (all 51 Wave 1 tests including the 4 AMM regression tripwires + 14 Wave 2 PriceFeed,
fee isolation, Trove state, and fuzz-invariant tests).

## Target group

Crypto-native and Bitcoin-native traders who want to express a view on measurable outcomes
and are comfortable with a wallet and a DEX-style interface. Experienced users (self-custody,
EVM familiarity) are the primary segment, with a familiar AMM-style trade panel as the
entry point. Desktop-first, mobile-responsive; English-language UI. The product is
permissionless and geography-neutral — anyone with a Mezo Testnet wallet can create a market
and trade on it.

## Tech stack

- **Contracts:** Solidity `0.8.28`, Foundry (forge, forge-std, fuzz + invariant tests),
  EVM `london`; integrated directly with Mezo canonical MUSD (`IERC20`), `PriceFeed`
  (`0x86bC...b9366`), and `TroveManager` (`0xE47c...6bb0`)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, wagmi v2 + viem, Mezo Passport
  (RainbowKit) for wallet connection, `@tanstack/react-query` for batched multicall reads,
  plus direct Mezo CDP integration (`BorrowerOperations` `0xCdF7...4beE5`, `HintHelpers`,
  `SortedTroves`) for in-app MUSD minting
- **Chain:** Mezo Testnet — chain id `31611`, RPC `https://rpc.test.mezo.org`, gas in BTC,
  settlement in canonical MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- **Tooling:** forge scripts for deploy + seed + Wave 2 smoke test, Blockscout contract
  verification (`https://explorer.test.mezo.org/api/`), GitHub Actions CI, Vercel for frontend

## Track

`Track 1 — DeFi (Borrowing, Lending, Looping, and Yield)`

Users pledge native BTC directly inside Annex to borrow canonical MUSD against a Mezo Trove
and route that MUSD straight into constant-product prediction pools backed 1:1 by MUSD
collateral, while BTC/USD markets read Mezo's canonical PriceFeed on-chain.

## Chain deployed on

`Mezo` — Mezo Testnet (chain id `31611`). Wave 1 contract live at
`0xfdbfde0a430de94c1d862cfc290c36549b5a501d`; Wave 2 contract verified against Mezo Testnet
fork and ready for deployer broadcast + Blockscout verification.

## Project status

`Wave 2 upgrade` — built on top of the Wave 1 protocol during the Mezo Buildathon, upgrading
MUSD integration from Level 2 ERC-20 usage to Level 3+ native Mezo CDP & PriceFeed
composition plus sustainable protocol fee accounting.

## Project readiness

`Wave 2 tested on Mezo fork; live testnet redeploy pending deployer broadcast` — all 65
Foundry tests and frontend production build + lint pass locally; live deploy, Blockscout
verification, and seeding scripts are ready for `DeployAnnex.s.sol` / `SeedMarkets.s.sol`.

## Live links

| What | Link |
|------|------|
| Live app | https://annex-markets.vercel.app (landing) · https://annex-markets.vercel.app/markets (markets) · `/trove` (in-app Trove funding) |
| Wave 1 Contract (legacy) | `0xfdbfde0a430de94c1d862cfc290c36549b5a501d` — https://explorer.test.mezo.org/address/0xfdbfde0a430de94c1d862cfc290c36549b5a501d |
| Wave 2 Contract (Mezo Testnet, Blockscout verified) | `0x3b760389E795a191219e86edD8bef498B31c680d` — https://explorer.test.mezo.org/address/0x3b760389E795a191219e86edD8bef498B31c680d |
| Public repo | https://github.com/Ryjen1/Annex |
| Deck | [`assets/deck.pdf`](../assets/deck.pdf) (8 slides, PDF) · source: [`assets/deck.html`](../assets/deck.html) |
| Video | Wave 1 pitch (`assets/video/annex-pitch.mp4`, 78 s) — update with unlisted YouTube Wave 2 walkthrough per `docs/demo-script.md` |

### Brand + media assets

| Asset | File | Live URL (after deploy) |
|-------|------|--------------------------|
| Banner (1600×900) | `assets/banner.png` · `assets/banner.svg` | https://annex-markets.vercel.app/assets/banner.png |
| OG / social card (1200×630) | `assets/og-card.png` · `assets/og-card.svg` | https://annex-markets.vercel.app/assets/og-card.png |
| Logo mark (512×512, transparent) | `assets/logo-mark.png` · `assets/logo-mark.svg` | https://annex-markets.vercel.app/assets/logo-mark.png |
| Logo lockup (1440×400, transparent) | `assets/logo-lockup.png` · `assets/logo-lockup.svg` | https://annex-markets.vercel.app/assets/logo-lockup.png |
| Deck (8 slides, PDF) | `assets/deck.pdf` (updated Wave 2) | https://annex-markets.vercel.app/assets/deck.pdf |
| Deck slide images | `assets/slides/slide-01…08.png` *(Wave 1 PNGs — regenerate after live capture)* | — |
| Product screenshots | `assets/screenshots/01-landing.png` … `06-mobile-landing.png` *(Wave 1 captures)* | — |

Screenshot index: `01-landing` (hero), `02-markets` (market list), `03-market-detail`
(market + trade panel), `04-market-live` (another market), `05-create-market`
(create flow), `06-mobile-landing` (mobile).

### Pitch video

`assets/video/annex-pitch.mp4` — 78 seconds, 1920×1080, narrated. It is a real screen
recording of the live app on Mezo Testnet: landing hero → how it works → market list →
**creating a market on chain** → **buying YES with MUSD** → portfolio → end card. The
create and buy transactions are real testnet transactions.

Upload it to YouTube (unlisted is fine) and replace the link above with the YouTube URL —
AKINDO wants a hosted video link rather than a file. The mp4 is also served from
`https://annex-markets.vercel.app/assets/annex-pitch.mp4` if a direct file link is easier.

## Updates in Wave 2

Wave 2 upgrades Annex from a standalone MUSD ERC-20 prediction market (Level 2) into a deeply
integrated Mezo DeFi application (Level 3+):

- **In-app Mezo Trove funding (`/trove` + inline Trade/Create drawers):** Users no longer leave
  Annex to mint MUSD. `TroveFundingPanel` reads live BTC collateral, MUSD debt, individual
  collateral ratio (ICR), `maxBorrowingCapacity`, and liquidation price from `TroveManager` +
  `PriceFeed` (plus `AnnexMarket.getUserTroveState`) and executes `openTrove`, `addColl`,
  `adjustTrove`, and `addColl → refinance → withdrawMUSD` directly through
  `BorrowerOperations` (`0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`) with `HintHelpers` +
  `SortedTroves`.
- **BTC/USD PriceFeed markets (`MarketKind.PriceFeed`):** Added `createPriceMarket` and
  permissionless `resolvePriceMarket` wired to canonical Mezo `PriceFeed`
  (`0x86bCF0841622a5dAC14A313a15f96A95421b9366`) with oracle staleness revert protection and strict
  separation from `MarketKind.Manual` (`resolve()` / `setResolver()` revert on PriceFeed
  markets). Highlighted with distinct `PriceFeed` strike pills and settlement UI.
- **Sustainable protocol fee (`0.30%` / `30 bps` on entry, cap `200 bps`):** Added
  `getBuyQuoteWithFee` and `accruedFees` accumulator isolated from `totalLockedCollateral`.
  Winning shares redeem at exact `1.00 MUSD` par (`0%` exit fee), owner `claimFees()` cannot
  touch locked user collateral, and the pre-trade panel itemizes order total, fee, net swap
  collateral, and winning payout before signing.
- **Idle-pool yield architecture evaluation:** Audited `StabilityPool.sol` (`offset()`
  collateral conversion and `_requireNoUnderCollateralizedTroves()` withdrawal blocks) and
  Mezo Pools IL risk; explicitly deferred yield parking until atomic `sMUSD` vault liquidity is
  available on Mezo so 1:1 redemption liveness is never compromised.
- **65 Foundry tests + verified Mezo fork lifecycle:** All 51 Wave 1 tests (including the 4 AMM
  quote-vs-price regression tests) plus 14 new Wave 2 unit/fuzz tests (`AnnexMarketWave2.t.sol`)
  and `SmokeTestWave2.s.sol` / `DeployAnnex.s.sol` / `SeedMarkets.s.sol`.
- **Submission & explorer readiness:** `AnnexMarket` verified directly on Blockscout via
  `https://api.explorer.test.mezo.org/api/`, Wave 2 pitch deck & demo script updated, and full
  AKINDO Overview copy written to replace `#ERROR!`.

## Real-user & live protocol testing evidence (Wave 2 — Mezo Testnet)

> Executed live against verified Wave 2 `AnnexMarket` (`0x3b760389E795a191219e86edD8bef498B31c680d`)
> using dedicated non-deployer user wallets alongside deployer Trove/market operations:

| Wallet | Action tested on Mezo Testnet (`chainId 31611`) | Explorer tx link |
|---|---|---|
| Deployer `0x7a0df48a9ae9DA978Be21538F0F9F74182915a49` | `openTrove` + `addColl` + `withdrawMUSD` (2,440 MUSD) via `BorrowerOperations` | [openTrove](https://explorer.test.mezo.org/tx/0x3369c92a5a3e5f0ef5d2399393282ad866b4cf4ec949cb05608ace3d73bd9fb3) · [addColl](https://explorer.test.mezo.org/tx/0x6277d5f7de432392981c4abae94b17cbc786159972b935b1dc009ac6e769c5d1) · [withdrawMUSD](https://explorer.test.mezo.org/tx/0x421cfc45b480ce207ddfafa66d619a17ce3f94914f638124f510829645e5909e) |
| Non-deployer `user1` (`0x222dCAfe7bfba7Da1207BA2F3CDD7e4B42F9B672`) | `buyShares(YES, 50 MUSD)` on PriceFeed Market #0 (`BTC >= $75k`), `buyShares` + `redeem` on #6 & #7 | [buy #0](https://explorer.test.mezo.org/tx/0x9c73eaaecfe948a0fec81fdaed98c1178436e09d37a21f6307427a62a14fad65) · [redeem #6](https://explorer.test.mezo.org/tx/0x7ea33ddbf50515b4d76f96ce0dfa8df52037f7ac8ad8fb74f313c0f7055cb036) · [redeem #7](https://explorer.test.mezo.org/tx/0x79a2e340b97ed5d50ed3c307b03d0c643f9102f8ab7201cf4bfb9b1b0b05dbbe) |
| Non-deployer `user2` (`0x18faF506D79982A23C155D6ED8277051e68617a3`) | `buyShares(NO, 40 MUSD)` on PriceFeed #1, `buyShares(YES, 30 MUSD)` on Manual #2, permissionless `resolvePriceMarket(#7)` | [buy #1](https://explorer.test.mezo.org/tx/0x899bc694570afc898a5575e1d10518ab0d844433dc7179637a976fbc5f7dc976) · [buy #2](https://explorer.test.mezo.org/tx/0x80c1b7dabe42694a8b8f47a72a7b79e0b6c849d757ba70b8e9bfd71c65485bbf) · [resolvePriceMarket #7](https://explorer.test.mezo.org/tx/0x716154f125d1daeaba7cb531a42c05a9b960e9f2c009550baabefd20a8a7c43d) |
| Deployer `0x7a0df48a9ae9DA978Be21538F0F9F74182915a49` | `claimLp` on #6 & #7 + `claimFees` (`0.48 MUSD`, leaving `totalLockedCollateral == MUSD.balanceOf == 2,269.64 MUSD`) | [claimFees](https://explorer.test.mezo.org/tx/0xc4c54497a0428276e98df63ff2d9e6eb5e06746b8acda779159fb54c59082359) |

## Future milestones

1. **Secondary / transferable LP positions + price-history chart** — ERC-20 LP share tokens
   and per-market price-over-time charts.
2. **Atomic MUSD Savings (`sMUSD`) idle collateral routing** — sweep resting pool reserves
   only after an instant-withdrawal `sMUSD` vault avoids liquidation & insolvency locks.
3. **Mezo Mainnet launch & multi-outcome conditional pools** — extend constant-product share
   minting to scalar/categorical Bitcoin macro events settled in MUSD.

## Team info

> Required before submitting on AKINDO (Wave 1 feedback noted empty team fields).

| Member | Role | X / LinkedIn |
|--------|------|--------------|
| `<name>` | Protocol + frontend engineer | `<handle>` |
| `<name>` | Design / operations | `<handle>` |

## Submission checklist

- [x] MUSD L3+ integration in product (`BorrowerOperations`, `TroveManager`, `PriceFeed`)
- [x] Protocol revenue fee (`0.30%` isolated entry fee, pre-trade UI breakdown)
- [x] AKINDO Overview & Wave 2 copy ready (fixes `#ERROR!` product overview)
- [x] Idle-pool yield safety assessment documented (`README.md` + `docs/architecture.md`)
- [x] 65 Foundry tests + frontend `build` / `lint` passing
- [x] Wave 2 `AnnexMarket` deployed to Mezo Testnet (`0x3b760389E795a191219e86edD8bef498B31c680d`), seeded (8 markets), and **verified on Blockscout explorer**
- [ ] Frontend Vercel env (`VITE_ANNEX_ADDRESS=0x3b760389E795a191219e86edD8bef498B31c680d`) verified & redeployed (`contracts.ts` fallback updated)
- [x] Non-deployer user wallets executed testnet trades, settlement & fee claim (hashes recorded above)
- [ ] Wave 2 2-minute pitch video recorded (`docs/demo-script.md`) & uploaded (YouTube unlisted)
- [ ] Team info + AKINDO form fields pasted & submitted
