# Annex

**Permissionless binary prediction markets on Mezo Testnet, settled in MUSD.**

Anyone can create a yes/no market about anything. Traders buy YES or NO shares from an
on-chain constant-product AMM. When the market resolves, the winning side redeems 1:1 for
MUSD. No custody, no admin, no off-chain operators — the whole protocol is one contract.

- **Chain:** Mezo Testnet (chain id `31611`, gas paid in BTC)
- **Settlement asset:** MUSD (`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, 18 decimals)
- **Contract:** [`contracts/src/AnnexMarket.sol`](contracts/src/AnnexMarket.sol)

---

## How it works

### Market lifecycle

```
create ──► trade ──► endTime passes ──► resolve ──► redeem / claimLP
```

1. **Create.** A creator posts a question, resolution criteria, category and close date, and
   seeds the pool with MUSD. The pool starts balanced at 50 / 50 and the creator receives
   the only LP position.
2. **Trade.** Buyers spend MUSD on YES or NO shares. The price is the pool's marginal
   price, so every trade moves it.
3. **Resolve.** After `endTime` the market resolver (the creator by default, transferable)
   or the protocol owner sets the outcome. The owner may also resolve early.
4. **Settle.** Winning shares redeem 1:1 for MUSD. The LP claims its share of the pool.

### The AMM

Each market holds a pool of YES and NO shares with a constant product `reserveYes * reserveNo = k`.

Buying YES with `a` MUSD works like this:

```
a MUSD  ──►  split into a complete set:  a YES + a NO
                    │
                    ├──► the NO half becomes counter-collateral in the pool
                    └──► the pool releases YES shares to the buyer (k preserved)
```

The buyer ends up long `a + swapOut` YES shares. Because every MUSD deposited mints exactly
one YES and one NO share, the pool stays exactly solvent:

```
totalCollateral == totalYes == totalNo
```

Whichever side wins, every winning share is backed 1:1 by MUSD, and after resolution the
entire collateral is distributed — nothing is stranded.

**Prices.** `priceYes = reserveNo / (reserveYes + reserveNo)`. That is not just a display
number: it is the true marginal cost of one YES share at the margin, so the price a trader
sees is the price they pay (plus normal slippage). The test suite asserts this.

**Who earns what.** The LP (market creator) collects the spread. A trade at the pre-trade
price leaves the trader roughly flat minus slippage, and the LP takes the difference.

---

## Repository layout

```
Annex/
├── contracts/               Foundry project
│   ├── src/
│   │   ├── AnnexMarket.sol  core protocol (single contract, no external deps)
│   │   ├── IERC20.sol       minimal ERC20 interface
│   │   └── MockMUSD.sol     ERC20 for local testing only
│   ├── test/                51 tests: unit, fuzz, reentrancy, lifecycle
│   └── script/              DeployAnnex.s.sol, SeedMarkets.s.sol
├── frontend/                Vite + React + TS + wagmi + viem + Tailwind
│   ├── src/lib/             chain config, ABI, formatting
│   ├── src/hooks/           market/position reads
│   ├── src/components/      Header, MarketCard, TradePanel
│   └── src/pages/           Markets, MarketDetail, CreateMarket, Portfolio
└── docs/                    architecture notes
```

---

## Running it

### Contracts

```bash
cd contracts
forge build
forge test -vvv
```

### Local node

```bash
anvil --chain-id 31611
```

Then deploy and seed:

```bash
export PRIVATE_KEY=0x...            # anvil default key
export RPC_URL=http://127.0.0.1:8545

cd contracts
forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
ANNEX_ADDRESS=0x... forge script script/SeedMarkets.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

`DeployAnnex.s.sol` deploys `MockMUSD` on any chain except a Mezo node that actually has the
canonical MUSD deployed, in which case it uses the real token.

> Local anvil does not ship the canonical `multicall3` contract that the frontend batches
> reads through. Install it once with:
>
> ```bash
> cast rpc anvil_setCode 0xcA11bde05977b3631167028862bE2a173976CA11 <runtime-bytecode> --rpc-url $RPC_URL
> ```

### Mezo Testnet

```bash
export PRIVATE_KEY=0x...            # funded with testnet BTC
export RPC_URL=https://rpc.test.mezo.org

cd contracts
forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --verify
```

Get testnet BTC from the [Mezo faucet](https://faucet.test.mezo.org/). MUSD is a CDP
stablecoin: open a trove (Mezo app or `BorrowerOperations` at
`0xCdF7028ceAB81fA0C6971208e83fa7872996beE5`) to borrow it.

Seed demo markets:

```bash
ANNEX_ADDRESS=0x... forge script script/SeedMarkets.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # set VITE_ANNEX_ADDRESS
npm run dev
```

| Env var | Purpose |
|---|---|
| `VITE_ANNEX_ADDRESS` | deployed AnnexMarket address |
| `VITE_MUSD_ADDRESS` | settlement token (defaults to canonical Mezo MUSD) |
| `VITE_RPC_URL` | override the RPC (e.g. a local anvil) |
| `VITE_WALLETCONNECT_PROJECT_ID` | optional, enables the WalletConnect connector |

Wallets: Unisat, Xverse, OKX and any injected EVM wallet, through the Mezo Passport SDK
plus RainbowKit.

---

## Contract API

```solidity
createMarket(string question, string description, string category,
             uint256 endTime, uint256 initialLiquidity) returns (uint256 marketId)
buyShares(uint256 marketId, Outcome outcome, uint256 musdAmount)
resolve(uint256 marketId, Outcome outcome)
redeem(uint256 marketId)
claimLp(uint256 marketId)
setResolver(uint256 marketId, address resolver)

getYesPrice(uint256 marketId) returns (uint256)      // 1e18 == 1.0 MUSD
getNoPrice(uint256 marketId) returns (uint256)
getBuyQuote(uint256 marketId, Outcome outcome, uint256 musdAmount) returns (uint256)
getMarketA(uint256 marketId) returns (string, string, string, uint256, address, address, Outcome, bool)
getMarketB(uint256 marketId) returns (uint256 x8)     // reserves, totals, prices
getUserPosition(uint256 marketId, address user) returns (uint256, uint256, uint256)
marketCount() returns (uint256)
```

`Outcome`: `0 = None`, `1 = Yes`, `2 = No`.

---

## Security notes

- `nonReentrant` on `buyShares`, `redeem` and `claimLp` (covered by a test with a malicious
  token that re-enters during `transferFrom`).
- Solvency invariant `totalCollateral >= max(totalYes, totalNo)` asserted after every
  operation in the test suite, including fuzz runs.
- Constant product preserved up to integer rounding dust.
- Resolution is permissioned to the resolver or the protocol owner; no oracle, no upgrade
  path, no admin withdrawal function.
- All funds stay in the contract. There is no way to move collateral out except paying
  winners and LPs.

---

## Tech stack

Solidity 0.8.28 (Foundry) · viem · wagmi v2 · React 18 + TypeScript · Vite · Tailwind CSS v4 ·
`@mezo-org/passport` · RainbowKit
