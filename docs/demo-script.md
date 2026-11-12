# Annex — 2-Minute Wave 2 Pitch Video Shot List

> Target length: **120 s**. AKINDO asks for a 2-minute pitch video.
> Screen recording only — no face cam, no music bed under the voice.
> Capture at 1920×1080, 60 fps, browser zoom 100%, notifications off.

## Before you record

1. Deploy & verify Wave 2 `AnnexMarket` on Mezo Testnet (`DeployAnnex.s.sol` + Blockscout
   verify), run `SeedMarkets.s.sol` (seeds 2 `PriceFeed` BTC/USD markets + 4 `Manual` event
   markets), and point the frontend (`VITE_ANNEX_ADDRESS`) at the new verified address.
2. Wallet ready on Mezo Testnet (`31611`) with testnet BTC for gas (`faucet.test.mezo.org`),
   using a wallet either without a Trove or ready to top up collateral / draw MUSD in-app.
3. Market IDs to use on camera:
   - **PriceFeed Market (`#0` or fresh 5-min test strike):** shows `PriceFeed` strike pill,
     live Mezo BTC price comparison, and permissionless `Resolve via Mezo PriceFeed` button.
   - **Manual Market (`#2` or custom):** shows `Manual` resolver pill (`MarketKind.Manual` kept
     strictly separate from BTC PriceFeed settlement).
4. Tabs ready: Annex app (`/`, `/trove`, `/markets`, `/market/0`), `explorer.test.mezo.org`
   showing the **verified** Wave 2 `AnnexMarket` contract source tab, and GitHub repo.

Route map: `/` (landing hero + live markets), `/trove` (in-app Mezo Trove CDP manager),
`/markets` (filterable by `PriceFeed` / category), `/market/<id>` (trade panel with 0.30%
fee breakdown + PriceFeed/Manual settle panel), `/create` (dual Market Type builder),
`/portfolio` (positions + Trove summary + redeem).

## The shots

| # | Time | On screen | Voiceover / on-screen text |
|---|---|---|---|
| 1 | 0:00–0:10 | Landing hero (`/`): `Annex` + L3+ Mezo callouts | "Prediction markets on Bitcoin shouldn't force users off-app to mint stablecoins or trust a single operator. Annex runs natively on Mezo — gas in BTC, settled 1:1 in MUSD." |
| 2 | 0:10–0:22 | Explorer tab: verified Wave 2 `AnnexMarket` source + `BorrowerOperations` / `PriceFeed` wires | "Wave 2 is one non-custodial, verified contract wired directly into Mezo's TroveManager and canonical PriceFeed — no upgrade key, no hidden collateral withdrawal." |
| 3 | 0:22–0:40 | `/trove` (or inline Trove drawer on Trade): enter BTC collateral + MUSD borrow, watch live ICR & liquidation price update, submit `openTrove` / top-up | "Right inside Annex, users pledge BTC to open or top up a Mezo Trove through BorrowerOperations, watching live collateral ratio and liquidation price update before minting MUSD." |
| 4 | 0:40–0:55 | `/markets` filter pill (`PriceFeed` badge vs `Manual`) + `/create` dual type toggle | "Annex strictly separates objective BTC/USD PriceFeed strike markets from creator-resolved event markets — manual resolvers can never override a PriceFeed market." |
| 5 | 0:55–1:12 | `/market/0`: enter 100 MUSD on YES, linger on live pre-trade breakdown (`Order total`, `0.30% protocol fee`, `Net into AMM`, `Shares`, `1:1 win payout`), approve + buy | "Before signing, the trade panel discloses the 0.30% protocol entry fee routed to an isolated fee ledger. The rest splits into YES and NO across the constant-product AMM." |
| 6 | 1:12–1:28 | Terminal / architecture invariant card (`MUSD.balanceOf == totalLockedCollateral + accruedFees`) | "Winning shares pay zero exit fee and redeem strictly 1:1 for MUSD. Idle pool yield stays inside the contract because StabilityPool withdrawals can lock during liquidations — solvency first." |
| 7 | 1:28–1:42 | Permissionless `Resolve via Mezo PriceFeed` click on an expired BTC strike market -> resolved badge | "Once expiry hits, any wallet can trigger `resolvePriceMarket`, reading Mezo's canonical PriceFeed on-chain with oracle staleness checks." |
| 8 | 1:42–1:52 | `Redeem` click (+ `claimLp` / `claimFees` note in portfolio or explorer tx) -> MUSD balance rises | "Winners redeem one-to-one in MUSD, LPs claim the pool surplus, and owner fee claims never touch user collateral." |
| 9 | 1:52–2:00 | End card: `annex-markets.vercel.app`, verified Wave 2 contract address, `github.com/Ryjen1/Annex` | "Annex Wave 2. Deep MUSD integration, transparent revenue, 65 Foundry tests. Try it on Mezo Testnet." |

## Recording notes

- Pause 1–2 seconds on: (a) live ICR / liquidation price in `/trove`, (b) pre-trade `0.30%`
  protocol fee breakdown before clicking Buy, and (c) post-redeem MUSD balance jump.
- Never show private keys, seed phrases, or unrelated personal browser bookmarks.
- If a testnet confirmation takes >3 s, show the Mezo Testnet Explorer tx confirmation rather
  than dead air, then return to updated UI state.
- Upload unlisted to YouTube and attach the video URL on AKINDO alongside the overview and team fields.
