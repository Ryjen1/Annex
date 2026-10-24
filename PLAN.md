# Annex — Build Plan & Status

> **Last updated:** Session 3 — Wave 1 submission prep (public repo + Vercel deploy +
> submission copy + video shot list done; contract deploy blocked on testnet funding).
> **Wave 1 deadline: Oct 26, 2026, 16:00 UTC.**

## What is Annex?

Annex is a permissionless binary prediction market protocol on Mezo Testnet, settled in MUSD.
Users create yes/no markets, trade YES/NO shares via an on-chain constant-product AMM, and
redeem winning shares 1:1 for MUSD after resolution. Gas is paid in BTC (Mezo native).

**Name clarification:** the product was renamed by the user. The name is **Annex** — use it
everywhere: contract names, frontend, README, docs, pitch deck. The original PRD name must
never appear in code, docs, README or commit messages.

---

## Mezo Testnet Reference (verified)

| Parameter | Value |
|-----------|-------|
| Chain ID | `31611` (`0x7b7b`) |
| RPC URL | `https://rpc.test.mezo.org` |
| WSS URL | `wss://rpc-ws.test.mezo.org` |
| Explorer | `https://explorer.test.mezo.org` |
| Native currency | Bitcoin (BTC), 18 decimals |
| **MUSD contract** | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| Faucet (testnet BTC) | `https://faucet.test.mezo.org/` |
| Wallet SDK | `@mezo-org/passport` (wraps RainbowKit + wagmi + viem) |
| Solidity version | `0.8.28` (matches Mezo's own MUSD contracts) |
| EVM version | `london` |

**MUSD notes:** MUSD has 18 decimals. It's a CDP stablecoin — to get MUSD on testnet, you
get testnet BTC from the faucet, then open a trove via the Mezo app or BorrowerOperations
contract (`0xCdF7028ceAB81fA0C6971208e83fa7872996beE5`).

---

## Completed Work

### 1. Project scaffold ✅
- Git repo initialized at `/home/maryjane/Desktop/workspace/job/hack/Annex` (branch: `main`, **no commits yet**)
- Foundry project in `contracts/` (forge-std installed)
- `contracts/foundry.toml`: solc 0.8.28, london, optimizer 200 runs, via_ir, fuzz 256 runs

### 2. Mezo research ✅
- All details in the table above. MUSD address verified on-chain via eth_call.

### 3. Smart contracts ✅ (`contracts/src/AnnexMarket.sol`, compiles clean)

**AMM design (CORRECTED in session 2 — read `docs/architecture.md`):**
- Constant-product pool over YES/NO share inventories, `k = reserveYes * reserveNo`.
- A deposit of `a` MUSD is split into a complete set (`a` YES + `a` NO). The NO half is the
  counter-collateral that makes the pool release YES; the buyer keeps the YES half plus the
  pool's swap output → buyer receives `a + swapOut` YES shares.
- `priceYes = reserveNo / (reserveYes + reserveNo)` is the true marginal cost of a share, so
  the quoted price equals the price paid (plus slippage).
- Solvency is exact: `totalCollateral == totalYes == totalNo`.

**Key functions:**
| Function | Purpose |
|----------|---------|
| `createMarket(question, description, category, endTime, initialLiquidity)` | Create + seed AMM, mint LP shares to creator |
| `buyShares(marketId, outcome, musdAmount)` | Buy YES/NO via AMM |
| `resolve(marketId, outcome)` | Resolver/owner sets outcome after endTime |
| `redeem(marketId)` | Redeem winning shares 1:1 for MUSD |
| `claimLp(marketId)` | LPs claim proportional AMM value after resolution |
| `setResolver(marketId, resolver)` | Change resolver (creator or owner) |
| `transferOwnership(newOwner)` | Protocol owner transfer |
| `getYesPrice` / `getNoPrice` | Marginal prices (1e18 = 1.0 MUSD) |
| `getBuyQuote(marketId, outcome, musdAmount)` | Preview shares out (incl. split half) |
| `getMarketA` / `getMarketB` | Split views (avoid stack-too-deep) — frontend calls both |
| `getUserPosition(marketId, user)` | User's YES/NO/LP shares |
| `marketCount()` | Total markets created |

### 4. Test suite ✅ (`contracts/test/AnnexMarket.t.sol` — 51 tests, all green)
`forge test` covers: creation + reverts, buy YES/NO (reserves, prices, constant product),
quote-vs-price consistency, execution price between pre/post trade price, "buyer is never
systematically short", solvency + share-accounting invariants after every operation,
resolution authorisation/timing/double-resolve, redeem (1:1, winning side only, zeroing),
LP claim, full lifecycles (YES wins / NO wins / exact collateral payout), reentrancy guard
(malicious token re-entering during `transferFrom`), and fuzz tests over random trade
sequences.

**Regression value:** reverting the AMM fix makes 4 tests fail (`test_Buy_QuoteMatchesQuotedPrice`,
`test_Buy_ExecutionPriceLiesBetweenPreAndPostPrice`, `test_Buy_BuyerIsNeverSystematicallyShort`,
`test_BuyYes_UpdatesReservesAndBalances`) — verified.

### 5. Deploy + seed scripts ✅
- `contracts/script/DeployAnnex.s.sol` — deploys MockMUSD off-Mezo, canonical MUSD on Mezo
  Testnet (falls back to mock if the MUSD address has no code, e.g. local anvil).
  Supports `PRIVATE_KEY` env or `--private-key` CLI.
- `contracts/script/SeedMarkets.s.sol` — creates 5 demo markets (BTC price, Mezo, crypto).
- Both verified end-to-end against a local anvil on chain id 31611.

### 6. Frontend ✅ (`frontend/`, Vite + React 18 + TS + wagmi v2 + viem + Tailwind v4)
- `src/lib/chains.ts` — Mezo Testnet chain (multicall3, explorer, `VITE_RPC_URL` override)
- `src/lib/abi.ts` — ABI generated from the forge output
- `src/lib/contracts.ts` — addresses + `Outcome` enum + categories
- `src/lib/wagmi.ts` — wagmi config via `@mezo-org/passport` (Unisat/Xverse/OKX/WalletConnect)
- `src/hooks/useMarkets.ts` — batched multicall reads for markets + user positions
- `src/components/` — Header (wallet + MUSD balance), MarketCard + PriceBar, TradePanel
  (approve → buy, live quote, average price, max payout)
- `src/pages/` — Markets (list, filters, search, stats), MarketDetail (info, position,
  redeem/claim/resolve), CreateMarket (form with approve + create), Portfolio
- Dark Bitcoin-orange theme, responsive.

**Build/runtime fixes needed for the wallet stack:**
- `vite-plugin-node-polyfills` injects `Buffer`/`process`/`global` (Mezo wallet stack needs them).
- `WalletConnect projectId` must be non-empty (placeholder `annex0000…` in `wagmi.ts`).
- React 18 (not 19) — Passport's peer dependency.

**Verified in a headless browser:** markets list renders live data (5 seeded markets, prices,
pools, countdowns), market detail renders with a live quote (25 MUSD → 49.39 YES @ 50.62¢),
create + portfolio pages render, no console errors.

### 7. Docs ✅
- `README.md` — overview, AMM explanation, run instructions, API, security notes
- `docs/architecture.md` — AMM design, invariants, settlement maths, roles, limitations

### 8. Wave 1 submission prep ✅ (session 3)
- **Public repo** — https://github.com/Ryjen1/Annex (first commit `e320783`, pushed to `main`)
- **Frontend deployed** — https://annex-markets.vercel.app (Vercel project `annex-markets`,
  VITE_* env vars set there, `frontend/.vercelignore` keeps local `.env` out of the upload,
  `frontend/vercel.json` rewrites SPA routes to `index.html`)
- **Submission copy** — `docs/submission.md`: paste-ready answers for every AKINDO form field
  (name, category, TL;DR, how it works, target group, stack, track, chain, status, readiness,
  links, wave updates, milestones, team info) + checklist
- **Video shot list** — `docs/demo-script.md`: 9-shot, 120 s recording plan with voiceover
- **Deployer key** — generated at `~/.annex/deployer.key` (outside the repo),
  address `0xac89fFA908D0bD7A9EE78DfAd4b40362d9971b15`

### 9. Mezo Testnet deployment ✅ (session 3)
- **AnnexMarket live:** `0xfdbfde0a430de94c1d862cfc290c36549b5a501d` (canonical MUSD
  `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` as settlement token)
  — https://explorer.test.mezo.org/address/0xfdbfde0a430de94c1d862cfc290c36549b5a501d
- **MUSD obtained on-chain:** opened a trove via BorrowerOperations
  `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` — 0.045 BTC collateral → 3,000 MUSD
- **Markets seeded:** 6 demo markets + 1 lifecycle smoke-test market (id 6) that was
  created, traded, resolved YES, redeemed and LP-claimed end to end
- **Demo trades placed:** YES on market 0, NO on market 1 (prices moved off 50/50)
- **Frontend repointed** at the deployed contract and redeployed; markets list, market
  detail, create and portfolio pages verified in headless Chrome against live testnet data

### 10. Frontend redesign ✅ (session 3)
- **Design system** — `frontend/src/index.css`: deep navy `#030412` base, Outfit display type
  with Poppins body, glass surfaces, gradient brand text, glow utilities, shimmer skeletons,
  ambient orange bloom backdrop
- **Landing page** (`pages/Landing.tsx` + `components/HeroScene.tsx`) — full-screen hero with
  original SVG scene (glowing coin, orbital field, ridged horizon), three-step explainer,
  live featured markets read from the chain, CTA band. `/markets` is the full market list.
- **Floating pill nav** — fixed, `blur(24px)`, black/25, white/10 hairline, gradient brand
- **Live AMM price curve** (`components/PriceCurve.tsx`, `hooks/usePriceCurve.ts`) — 21 points
  read from the contract's own `getBuyQuote` in one multicall, plus price-impact and
  average-price derived from those quotes. Verified against a fork of Mezo Testnet:
  post-trade reserves match on-chain exactly (5/5 markets), price quote matches
  `getBuyQuote` (41.67 YES for 25 MUSD on market 0).
- **Wallet cleanup** — removed the placeholder WalletConnect connector (invalid project id
  caused rejected relay requests in the console); Bitcoin + injected EVM wallets remain

### 11. Submission assets ✅ (session 3)
- **`assets/`** — original vector brand kit in the Bitcoin palette: `logo-mark.svg` (coin),
  `logo-lockup.svg` (wordmark), `banner.svg` (1600×900), `og-card.svg` (1200×630) — all
  exported to PNG (logos transparent)
- **Deck** — `assets/deck.html` (8 slides, same visual language) exported to
  `assets/deck.pdf` + `assets/slides/slide-01…08.png`
- **Screenshots** — `assets/screenshots/`: landing, markets, market detail, second market,
  create flow, mobile landing — captured from the live app
- **Stable URLs** — the same files are served from the app, so the submission can link them:
  `https://annex-markets.vercel.app/assets/{banner.png, og-card.png, logo-mark.png,
  logo-lockup.png, deck.pdf}`. Favicon + OG/Twitter meta tags point at the new brand.
- Asset index with file paths and live URLs is in `docs/submission.md`.

### 12. Pitch video ✅ (session 3)
- **`assets/video/annex-pitch.mp4`** — 78 s, 1920×1080 H.264, narrated (neural TTS), captions
  burned in. Real screen recording of the live app: landing hero → how it works → market
  list → **create a market on chain** → **buy YES with MUSD** → portfolio → end card. The
  create and buy are real testnet transactions.
- Served at `https://annex-markets.vercel.app/assets/annex-pitch.mp4`; upload to YouTube
  (unlisted) for the submission and swap the link in `docs/submission.md`.

---

## What's NOT Done Yet (priority order)

### A. Demo video (HIGH — script ready, needs recording)
AKINDO asks for a **2-minute** pitch video. `docs/demo-script.md` has the shot list. Record
with the deployed contract live: markets list → market detail → approve+buy YES → resolve →
redeem. The 30-minute demo market (id 5, "Will Annex's first demo market resolve YES?")
ends 30 min after creation and can be resolved by the deployer/owner for the resolve→redeem
shots. Upload to YouTube (unlisted is fine) and paste the link into `docs/submission.md`.

### B. Team info + AKINDO form (HIGH)
Fill in the team table in `docs/submission.md` (names, roles, X/LinkedIn), then paste the
answers into the submission form before **Oct 26, 16:00 UTC**.

### C. Pitch deck ✅
`docs/pitch-deck.md` — 8 slides: problem, solution, AMM mechanics, safety invariant, demo
flow, what is built, roadmap. No external project names.

### D. Nice-to-have (only if time remains)
- Transferable LP shares (secondary LP market) — currently creator-only.
- A market activity/history chart (price over time).
- Health endpoint / event log page.

---

## Commands Reference

```bash
# Contracts
cd contracts
forge build                    # compile
forge test -vvv                # run the 51 tests
forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast

# Frontend
cd frontend
npm run dev                    # start dev server
npm run build                  # production build

# Local anvil (chain id 31611 to match Mezo)
anvil --chain-id 31611
```

---

## Critical Constraints (from PRD)

- **The product name is "Annex"** — the original PRD name must never appear anywhere
- Do NOT reference, link, credit, or mention any external prediction market project anywhere public
- MUSD is the only accepted currency
- All funds remain in smart contracts (non-custodial)
- No complex oracle — admin/resolver resolution only
- Wave 1 deadline: **Oct 26**
- Gas paid in BTC (Mezo native)
