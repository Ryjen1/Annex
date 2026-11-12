# Annex — Pitch Deck (Wave 2)

> 8 slides. Kept deliberately short: the demo does the talking.
> Product name is **Annex**, everywhere. No external project names anywhere.

---

## 1 — Title

**Annex**
Permissionless binary prediction markets, settled in MUSD on Mezo.

Open a Trove in-app, trade YES or NO on BTC PriceFeed or custom event markets via an on-chain
AMM, and redeem winning shares 1:1 for MUSD. Non-custodial, one contract, gas paid in BTC.

`Mezo Testnet · 31611 · Wave 2 L3+ Integration`

---

## 2 — The problem

People already bet on outcomes — crypto prices, elections, macro events. Existing venues fail
Bitcoin users in four ways:

- **Offshore & custodial.** Funds sit with an operator, not in bytecode you can audit.
- **Disjointed stablecoin UX.** Even on Bitcoin EVMs, plain ERC-20 apps force users to leave
  the product to open a CDP Trove elsewhere before funding a single trade.
- **Opaque risk.** Proprietary order books and private settlement engines hide insolvency.
- **Unpriced BTC finality.** Objective BTC/USD markets shouldn't rely on opaque manual settles
  when canonical on-chain price feeds exist.

---

## 3 — The solution (Wave 2 L3+ Architecture)

**Annex is a Bitcoin-native prediction market wired directly into Mezo's DeFi stack.**

- **In-app Mezo Trove funding (`/trove` & trade drawer):** Users open Troves, add BTC,
  refinance capacity, and borrow MUSD directly via `BorrowerOperations`, with live ICR and
  liquidation price from `TroveManager` + `PriceFeed`.
- **Dual-path resolution:** Objective BTC/USD strike markets (`MarketKind.PriceFeed`) settle
  permissionlessly from Mezo `PriceFeed.fetchPrice()`; subjective events stay `MarketKind.Manual`.
- **Sustainable revenue:** `0.30%` (`30 bps`) protocol entry fee isolated from `totalLockedCollateral`.
- **Verified execution:** 1 immutable contract · 65 Foundry tests · zero proxy/admin sweep.

---

## 4 — AMM & Fee Economics

Each market holds a pool of YES and NO shares with constant product `x · y = k`.

```
buy YES with grossAmount MUSD
  ├─ 0.30% protocol fee (30 bps) ──► accruedFees (owner-claimable revenue)
  └─ netAmount splits into complete set:  netAmount YES + netAmount NO
        ├─ NO half stays in pool as counter-collateral
        └─ pool releases YES  (k preserved)

buyer receives  netAmount + swapOut  YES shares
winner redeems  1.00 MUSD / share  (0% exit fee)
```

- **Honest pricing:** `priceYes = reserveNo / (reserveYes + reserveNo)` plus disclosed impact.
- **Entry fee, 0% exit tax:** Winners always redeem 1:1 at par; LPs earn pool trading spreads.
- **No hidden collateral drag:** `claimFees()` only withdraws `accruedFees`, never market reserves.

---

## 5 — Why it is safe (Solvency & Deferred Yield)

```
MUSD.balanceOf(AnnexMarket)  ==  totalLockedCollateral + accruedFees
totalLockedCollateral        ==  totalYes  ==  totalNo
```

- **Zero custody & strict isolation:** No proxy, no upgrade key, no `withdraw` of collateral,
  and `claimFees()` strictly bounded by `accruedFees`.
- **Dual resolution guardrails:** `resolve()` and `setResolver()` revert on `PriceFeed`
  markets (`PriceFeedMarketOnly`); price reads enforce `MAX_PRICE_STALENESS = 1 hour`.
- **Why idle yield is explicitly deferred:** Auditing `StabilityPool.sol` confirmed withdrawals
  lock during undercollateralized troves and `offset()` swaps MUSD for BTC. Keeping resting
  collateral inside `AnnexMarket` guarantees 100% 1:1 MUSD redemption liveness.
- **65 Foundry tests:** All 51 Wave 1 tests (incl. 4 AMM regression tests) + 14 Wave 2 tests.

---

## 6 — The Wave 2 Demo (120 seconds)

1. **Connect** a Bitcoin wallet (Xverse, Unisat, OKX) or EVM wallet via Mezo Passport.
2. **Mint MUSD in-app (`/trove`)** — inspect live BTC price, ICR, and liquidation price via
   `TroveManager`, then `openTrove` / `addColl` / borrow MUSD through `BorrowerOperations`.
3. **Create & trade** a `BTC/USD PriceFeed` or `Manual` market; inspect the pre-trade
   breakdown (`Order total`, `0.30% protocol fee`, `Net into AMM`, `1:1 win payout`).
4. **Settle & redeem** — call permissionless `resolvePriceMarket()` after expiry, redeem
   winning shares `1:1 MUSD`, claim LP surplus, and show `claimFees()` leaves collateral intact.

---

## 7 — What is built today (Wave 2)

| Piece | Status |
|---|---|
| `AnnexMarket.sol` Wave 2 (`PriceFeed`, `TroveManager`, `30 bps` fee) | Live & Blockscout verified |
| In-app Trove funding (`BorrowerOperations` + `HintHelpers` + `SortedTroves`) | Done — `/trove` + 2,440 MUSD live Trove |
| Foundry suite (`AnnexMarket.t.sol` + `AnnexMarketWave2.t.sol`) | Done — 65 / 65 passing |
| Live Mezo Testnet rollout (`SeedMarkets`, non-deployer trades, `claimFees`) | Done — 8 markets (#0–#5 open, #6–#7 settled) |
| Frontend (`Vite` + `React 18` + `Tailwind` + `Passport`) + Wave 2 docs/deck | Done — 0 lint/type warnings |

`Chain: Mezo Testnet (31611) · Wave 2: 0x3b760389…31c680d (verified) · Settlement: MUSD · Gas: BTC`

---

## 8 — Roadmap

- **Wave 2 Shipped (Now):** Live Blockscout-verified Wave 2 contract (`0x3b760389…31c680d`),
  in-app Troves (L3+), BTC/USD `PriceFeed` settlement, `0.30%` isolated fee, multi-user txs.
- **Submission Finalization (Today):** Verify Vercel `VITE_ANNEX_ADDRESS` env, attach
  2-minute Wave 2 walkthrough video, and submit AKINDO overview + team fields.
- **Mainnet & Beyond:** Atomic `sMUSD` idle-collateral yield once live on Mezo, transferable
  ERC-20 LP positions, per-market OHLC/activity charts, multi-outcome Bitcoin macro pools.

---

*Annex · Mezo Testnet · MUSD settlement · gas in BTC · non-custodial*
