# Annex — AKINDO Submission Copy

> Paste-ready answers for the Mezo Buildathon submission form (Wave 1).
> Product name is **Annex**. No external project names.

---

## Project name

`Annex`

## Product category

`Binary Prediction Markets`

## TL;DR

Annex is a permissionless binary prediction market protocol on Mezo: anyone can create a
yes/no market in one transaction, trade YES/NO shares against an on-chain constant-product
AMM, and redeem winning shares 1:1 for MUSD after resolution — non-custodial, one contract,
gas paid in BTC.

## How it works

**The problem.** People want to trade on outcomes — crypto prices, elections, sports,
headlines — but the venues are custodial and opaque, or they live on chains that a
Bitcoin-native user cannot reach without a bridge and a stablecoin they do not hold.
Bitcoin has the money and the users; there is no market infrastructure on Bitcoin rails.

**What Annex does.** Every market is a pool of YES and NO shares held by one contract, priced
by a constant-product AMM (`reserveYes × reserveNo = k`). A buyer who spends `a` MUSD gets
`a + swapOut` YES shares: the deposit is split into a complete set (`a` YES + `a` NO), the NO
half becomes the pool's counter-collateral, and the pool releases the YES half plus the swap
output. `priceYes = reserveNo / (reserveYes + reserveNo)` is the true marginal cost of a
share, so the quoted price is the price paid (plus ordinary slippage) — no hidden markup.
After `endTime` the market's resolver (the creator by default, transferable) or the protocol
owner sets the outcome, and winning shares redeem 1:1 for MUSD while the LP claims the rest
of the pool. Exact solvency is enforced on-chain:
`totalCollateral == totalYes == totalNo`.

**How MUSD is positioned.** MUSD is the settlement asset and the only accepted currency:
liquidity providers deposit MUSD to seed a market, traders pay MUSD to take a side, and
winning shares pay out in MUSD. That makes MUSD the productive, yield-bearing capital of the
protocol — collateral in the pool, cashflow for LPs, and the unit of account for every
prediction. Gas is paid in BTC (Mezo's native coin), so the protocol consumes both assets of
the Mezo economy: BTC for execution, MUSD for settlement.

**Why it is safe.** No withdrawal function, no upgrade key, no admin pricing, no off-chain
component; reentrancy-guarded entry points; 51 Foundry tests covering unit, fuzz, reentrancy
and full-lifecycle paths, including quote-vs-price consistency and solvency invariants after
every operation.

## Target group

Crypto-native and Bitcoin-native traders who want to express a view on measurable outcomes
and are comfortable with a wallet and a DEX-style interface. Experienced users (self-custody,
EVM familiarity) are the primary segment, with a familiar AMM-style trade panel as the
entry point. Desktop-first, mobile-responsive; English-language UI. The product is
permissionless and geography-neutral — anyone with a Mezo Testnet wallet can create a market
and trade on it.

## Tech stack

- **Contracts:** Solidity `0.8.28`, Foundry (forge, forge-std, fuzz + invariant tests),
  EVM `london`; ERC-20 interface only — no external dependencies
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, wagmi v2 + viem, Mezo Passport
  (RainbowKit) for wallet connection, `@tanstack/react-query` for batched multicall reads
- **Chain:** Mezo Testnet — chain id `31611`, RPC `https://rpc.test.mezo.org`, gas in BTC,
  settlement in canonical MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- **Tooling:** forge scripts for deploy + seed, GitHub Actions CI for the test suite,
  Vercel for the live frontend

## Track

`Track 1 — DeFi (Borrowing, Lending, Looping, and Yield)`

MUSD is the protocol's reserve asset: liquidity providers supply MUSD, traders pay MUSD, and
redemptions return MUSD. Track 2 is a reasonable secondary fit because the protocol also
removes access friction — anyone can list a market without permission.

## Chain deployed on

`Mezo` — Mezo Testnet (chain id `31611`). Testnet deployment with the canonical MUSD token;
mainnet deployment planned after Wave 1.

## Project status

`Entirely new` — built from scratch during the Mezo Buildathon (Wave 1). No prior product
or codebase; one contract, one frontend, written during the build period.

## Project readiness

`Testnet deployment` — AnnexMarket is deployed on Mezo Testnet against the canonical MUSD
token, with a live frontend and seeded demo markets.

## Live links

| What | Link |
|------|------|
| Live app | https://annex-markets.vercel.app |
| Contract | `0x<ANNEX_ADDRESS>` — https://explorer.test.mezo.org/address/0x<ANNEX_ADDRESS> |
| Public repo | https://github.com/Ryjen1/Annex |
| Deck | [`docs/pitch-deck.md`](pitch-deck.md) (8 slides, in the repo) |
| Video | 2-minute pitch — `<YOUTUBE_LINK>` |

## Updates in this Wave

Wave 1 shipped the complete protocol end to end:

- **Protocol contract** (`AnnexMarket`): create market, buy YES/NO through the AMM, transfer
  resolver, resolve, redeem, LP claim, plus split views for the frontend. Solvency is
  enforced exactly — `totalCollateral == totalYes == totalNo` — and there is no admin path
  to move funds or reprice a market.
- **AMM economics:** a deposit splits into a complete set so the pool releases `a + swapOut`
  shares; the marginal price `reserveNo / (reserveYes + reserveNo)` equals the quoted price.
  A session-2 fix corrected a ~2.2x divergence between quoted and charged price; four
  regression tests now lock that behaviour in.
- **51 Foundry tests:** unit, fuzz over random trade sequences, reentrancy against a
  malicious token, resolution authorisation and timing, redemption, LP claims, and
  quote-vs-execution-price consistency. All green.
- **Frontend:** markets list with live prices and pool depth, market detail with a live quote
  and average execution price, approve → buy flow, create market, portfolio with position and
  redeem, resolver controls, wallet connector via Mezo Passport (MetaMask / Xverse / Unisat /
  OKX / WalletConnect).
- **Deployment:** forge deploy + seed scripts, deployed to Mezo Testnet against canonical
  MUSD, frontend published and pointed at the deployed contract.
- **Docs:** protocol README, AMM architecture notes, pitch deck and this submission copy.

## Future milestones

1. **Transferable LP shares + secondary LP market** — anyone can provide liquidity, not just
   the market creator. Target: **Wave 2 build window, by Nov 1, 2026**.
2. **Price-history and activity chart per market** — time series of the AMM price plus an
   on-chain trade feed. Target: **by Nov 8, 2026**.
3. **Multi-outcome markets with optional oracle resolution** — any number of buckets instead
   of yes/no, and a resolution source a creator can point at instead of a person. Target:
   **Wave 2 submission, by Nov 15, 2026**.

## Team info

| Member | Role | X / LinkedIn |
|--------|------|--------------|
| `<name>` | Protocol + frontend engineer | `<handle>` |
| `<name>` | Design / operations | `<handle>` |

## Submission checklist

- [x] MUSD integration (settlement asset, canonical MUSD on Mezo Testnet)
- [x] Working deployment on a supported chain (Mezo Testnet)
- [x] Public GitHub repository
- [x] Product deck (8 slides)
- [ ] Live project link reachable with the deployed contract
- [ ] 2-minute pitch video uploaded
- [ ] Team info filled in
