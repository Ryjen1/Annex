# AGENTS.md — Annex Project Handoff

> **Read this file first.** It contains everything you need to pick up where the
> previous session left off.

## Project: Annex

Annex is a permissionless binary prediction market protocol on **Mezo Testnet**,
settled in MUSD. Users create yes/no markets, trade YES/NO shares via an on-chain
constant-product AMM, and redeem winning shares 1:1 for MUSD after resolution.

**IMPORTANT:** the user renamed the product to **"Annex"**. Use "Annex" everywhere.
The original PRD name must never appear in code, docs, README, or commit messages.

## Workspace

- **Root:** `/home/maryjane/Desktop/workspace/job/hack/Annex`
- **Git:** initialized, branch `main`, **no commits yet** (user has not asked for commits)
- **OS:** linux, Node v24, Foundry at `/home/maryjane/.foundry/bin` (add to PATH)

## Environment

- Foundry: `forge`, `anvil`, `cast` at `/home/maryjane/.foundry/bin/`
- Node v24.22.0, npm 11.19.1
- Chrome at `/usr/bin/google-chrome` + `playwright-core` (in `/tmp/opencode`) for headless UI checks

## Mezo Testnet Config (verified on-chain)

```
Chain ID:     31611 (0x7b7b)
RPC:          https://rpc.test.mezo.org
WSS:          wss://rpc-ws.test.mezo.org
Explorer:     https://explorer.test.mezo.org
Native coin:  Bitcoin (BTC), 18 decimals
MUSD token:   0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503  (18 decimals)
Faucet:       https://faucet.test.mezo.org/  (dispenses testnet BTC)
Wallet SDK:   @mezo-org/passport (wraps RainbowKit + wagmi + viem)
```

MUSD is a CDP stablecoin. To get MUSD on testnet: faucet BTC → open trove via Mezo app
or BorrowerOperations (`0xCdF7028ceAB81fA0C6971208e83fa7872996beE5`) → borrow MUSD.

---

## Current State (end of Session 2)

### Done ✅
1. **Contracts** — `contracts/src/AnnexMarket.sol` (+ `IERC20.sol`, `MockMUSD.sol`), compiles clean.
2. **AMM math fixed** — the deposit now splits into a complete set; the buyer receives
   `amount + swapOut` shares. Before the fix the quoted price and the charged price
   diverged by ~2.2x (a 50¢ market really charged $1.10/share). See `docs/architecture.md`.
3. **Test suite** — `contracts/test/AnnexMarket.t.sol`, 51 tests, all green
   (`cd contracts && forge test -vvv`). Includes fuzz + reentrancy + invariant assertions.
4. **Deploy scripts** — `contracts/script/DeployAnnex.s.sol` and `SeedMarkets.s.sol`,
   verified end-to-end on a local anvil (chain id 31611).
5. **Frontend** — `frontend/` fully built (markets list, market detail with live quote and
   approve→buy flow, create market, portfolio). Verified in headless Chrome against a
   local deployment.
6. **Docs** — `README.md` + `docs/architecture.md`.

### NOT done ❌ (in priority order)
1. **Deploy to Mezo testnet** — needs a funded `PRIVATE_KEY` from the user. See PLAN.md section A.
2. **Get MUSD on testnet** — open a trove (PLAN.md section B).
3. **Pitch deck** — `docs/pitch-deck.md`, 6–8 slides.
4. **Demo video** — under 3 minutes: connect → buy YES → resolve → redeem.

---

## Contract Architecture Summary

`AnnexMarket.sol` is a single contract holding all markets. Key design:

- **AMM:** constant-product (x*y=k) between YES/NO shares.
  - A deposit of `a` MUSD splits into `a` YES + `a` NO; the NO half seeds the pool as
    counter-collateral, the pool releases YES (k preserved), the buyer keeps the YES half.
  - Buyer receives `a + swapOut` shares.
  - Price: `priceYes = reserveNo / (reserveYes + reserveNo)` — the true marginal cost.
- **Solvency invariant:** `totalCollateral == totalYes == totalNo` (exact).
- **LP:** creator gets LP shares = initial liquidity; claims proportional pool value after
  resolution. LP positions are not transferable (wave 1 limitation).
- **Resolution:** resolver (defaults to creator, transferable) or protocol owner; resolver
  only after `endTime`, owner may resolve early.
- **Views split:** `getMarketA()` (strings/status) + `getMarketB()` (numerics/prices) —
  split to avoid Solidity "stack too deep". Frontend calls both.

### Key function signatures
```solidity
createMarket(string question, string description, string category, uint256 endTime, uint256 initialLiquidity) → uint256 marketId
buyShares(uint256 marketId, Outcome outcome, uint256 musdAmount)
resolve(uint256 marketId, Outcome outcome)
redeem(uint256 marketId)
claimLp(uint256 marketId)
getYesPrice(uint256 marketId) → uint256
getNoPrice(uint256 marketId) → uint256
getBuyQuote(uint256 marketId, Outcome outcome, uint256 musdAmount) → uint256
getMarketA(uint256 marketId) → (string, string, string, uint256, address, address, Outcome, bool)
getMarketB(uint256 marketId) → (uint256 x8)
getUserPosition(uint256 marketId, address user) → (uint256, uint256, uint256)
marketCount() → uint256
```

`Outcome` enum: `0=None, 1=Yes, 2=No`

---

## Frontend Notes

- `frontend/src/lib/chains.ts` — chain config, `VITE_RPC_URL` override for local anvil.
- `frontend/src/lib/contracts.ts` — `VITE_ANNEX_ADDRESS`, `VITE_MUSD_ADDRESS`.
- `frontend/src/lib/wagmi.ts` — wagmi config via `@mezo-org/passport` (`getConfig`).
  A non-empty WalletConnect project id is required (placeholder in the file).
- React **18** (not 19): Passport's peer dependency.
- `vite-plugin-node-polyfills` injects `Buffer`/`process`/`global` — required by the
  Mezo wallet stack. Don't remove it.
- Local anvil lacks `multicall3`; the frontend's batched reads need it installed:
  ```bash
  cast rpc anvil_setCode 0xcA11bde05977b3631167028862bE2a173976CA11 <runtime-bytecode> --rpc-url http://127.0.0.1:8545
  ```

---

## Rules

1. **Name = "Annex"** everywhere; the original PRD name must never appear.
2. **No external references** — do not mention/link/credit any other prediction market
   project in public files, README, code comments, commit messages, or docs.
3. **MUSD only** as currency. Gas in BTC.
4. **Non-custodial** — all funds in contracts.
5. **Deadline: Oct 26** (Wave 1).
6. After completing a task, update PLAN.md status and run `forge build` / `forge test` /
   `npm run build` to verify.
7. Do NOT commit unless the user explicitly asks. Work stays on disk.

## Quick Start for Next Session

```bash
cd /home/maryjane/Desktop/workspace/job/hack/Annex
cat PLAN.md          # status + remaining work
cat AGENTS.md        # this file
cd contracts && forge test        # 51 tests, should be green
cd ../frontend && npm run build   # typecheck + bundle
```

Then start with: **deploy to Mezo testnet** (needs the user's funded key) or the
**pitch deck** if the deploy is blocked.
