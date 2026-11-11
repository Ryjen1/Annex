# Annex — Architecture Notes (Wave 2)

## Single Immutable Contract, Separated Resolution & Fee Ledger

[`AnnexMarket.sol`](../contracts/src/AnnexMarket.sol) holds every market in `mapping(uint256 => Market)` with a companion `mapping(uint256 => PriceMarketConfig)` for oracle-settled BTC/USD markets. There is no proxy and no upgrade path. Governance is intentionally narrow: setting resolvers on **Manual** markets, emergency resolving **Manual** markets, and claiming separately accounted protocol fees.

```
Market {
    string  question, description, category;
    uint256 endTime;
    address creator, resolver;

    uint256 reserveYes, reserveNo;    // AMM pool inventory, in share units
    uint256 k;                        // reserveYes * reserveNo
    uint256 totalYes, totalNo;        // every share in existence
    uint256 totalCollateral;          // cumulative net MUSD collateral assigned to this market
    uint256 lpTotalSupply;

    Outcome outcome;
    bool    resolved;
}

PriceMarketConfig {
    MarketKind kind;                  // 0 = Manual, 1 = PriceFeed
    uint256    strikePrice;           // 18-decimal BTC/USD strike
    bool       resolveAbove;          // true: YES if price >= strikePrice; false: YES if price < strikePrice
    uint256    resolvedPrice;         // oracle price recorded at settlement
}
```

---

## Protocol Fee Mechanics (30 bps on Entry)

When a trader calls `buyShares(marketId, outcome, musdAmount)`:

```
fee       = (musdAmount * feeBps) / 10_000     // 30 bps = 0.30% (capped at 200 bps max)
netAmount = musdAmount - fee                   // enters AMM complete-set split
```

- `accruedFees += fee` (tracked globally, withdrawn only via owner `claimFees(to)`).
- `m.totalCollateral += netAmount` and `totalLockedCollateral += netAmount`.
- Market creation (`createMarket`, `createPriceMarket`), winning redemption (`redeem`), and LP exits (`claimLp`) have **0% fee**.
- Why take the fee on entry rather than exit: a winning share MUST always redeem cleanly for **1.00 MUSD** (`1:1`), matching what `getBuyQuoteWithFee()` shows before confirmation. Deducting 0.30% upfront keeps redemption 1:1 with zero exit haircuts.

---

## Trading & Complete-Set AMM Math

On a buy with net deposit `a = netAmount` into pool `(x = reserveYes, y = reserveNo)` with `k = x * y`:

```
newReserveNo  = y + a                 // opposite half of split enters pool as counter-collateral
newReserveYes = k / newReserveNo      // integer division preserves k (minus rounding dust)
swapOut       = x - newReserveYes     // YES released by pool
buyer receives a + swapOut YES shares
```

Splitting `a` MUSD into `(a YES + a NO)` guarantees that `priceYes = reserveNo / (reserveYes + reserveNo)` equals the true marginal cost at infinitesimal size (`d(sharesOut)/da = 1 + x/y = 1 / priceYes`). Without the split term `a`, buyers would pay ~2.2x fair price at balanced reserves; four dedicated regression tests in `contracts/test/AnnexMarket.t.sol` enforce this behavior.

---

## Restated Solvency & Conservation Invariants

| Invariant | Source |
|---|---|
| `m.totalCollateral == m.totalYes == m.totalNo` | Every initial deposit & `netAmount` mints `1 YES + 1 NO` per MUSD |
| `musd.balanceOf(address(this)) >= totalLockedCollateral + accruedFees` | Strict accounting separation between collateral and fees |
| `reserveYes * reserveNo <= k` | Constant product up to integer division rounding down |
| `priceYes + priceNo == 1e18` | Complementary marginal prices |

When `claimFees(to)` transfers `accruedFees`, `musd.balanceOf(address(this))` remains strictly `>= totalLockedCollateral`, ensuring admin fee claims can never affect active markets or user redemptions at any stage (tested before and after resolution).

---

## Strict Separation of Resolution Paths

| Attribute | `MarketKind.Manual` (`createMarket`) | `MarketKind.PriceFeed` (`createPriceMarket`) |
|---|---|---|
| Intended scope | Subjective / qualitative outcomes | Objective BTC/USD price vs strike at expiry |
| Resolver address | `creator` by default (transferable via `setResolver`) | Fixed to canonical Mezo `PriceFeed` (`0x86bC...b9366`) |
| Settlement call | `resolve(id, outcome)` | `resolvePriceMarket(id)` (permissionless `>= endTime`) |
| Owner early override | Allowed (`resolve()`) | **Strictly blocked** (`PriceFeedMarketOnly()`) |
| Staleness protection | N/A | Enforces Mezo `PriceFeed.fetchPrice()` oracle freshness (reverts if stale) |

---

## Mezo Trove Integration & Liquity Borrowing Capacity Note

To integrate MUSD's CDP engine into the product rather than treating MUSD as a generic ERC-20:
- **On-chain view:** `AnnexMarket.getUserTroveState(user)` calls `TroveManager` (`0xE47c...6bb0`) + `PriceFeed` (`0x86bC...b9366`) in one read, returning `(status, coll, debt, icr, maxBorrowingCapacity, mcr, btcPrice)` while safely degrading (`icr=0, btcPrice=0`) if `PriceFeed.fetchPrice()` temporarily reverts as stale so user position displays remain visible.
- **In-app Trove funding flow:** `TroveFundingPanel` calls Mezo `BorrowerOperations` (`0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`) directly with `HintHelpers` + `SortedTroves` hints.
- **`maxBorrowingCapacity` nuance on top-ups:** Inside Mezo's `BorrowerOperations.sol`, `adjustTrove` checks debt increases against `TroveManager.getTroveMaxBorrowingCapacity(borrower)`, which is set at `openTrove` / `refinance` and is NOT automatically increased by `addColl`. Our UI detects when a collateral top-up plus additional MUSD borrow exceeds recorded `maxBorrowingCapacity` and orchestrates `addColl -> refinance -> withdrawMUSD` cleanly.

---

## Idle-Pool Yield — Evaluated & Deliberately Deferred

We inspected the deployed source code of Mezo's `StabilityPool` (`0x1CCA7E410eE41739792eA0A24e00349Dd247680e`) and deployment manifests for matsnet to determine whether idle pool MUSD could safely earn yield:

- **`StabilityPool.withdrawFromSP` blocks redemptions during undercollateralized states:** In `StabilityPool.sol`, any positive withdrawal calls `_requireNoUnderCollateralizedTroves()`, reverting if **any** trove in Mezo sits below 110% ICR. In a sharp BTC downturn — precisely when BTC price markets expire and settle — market winners would be unable to `redeem()`.
- **`StabilityPool` liquidation `offset()` replaces MUSD with BTC:** Offsetting liquidations burns deposited MUSD and credits ETH/BTC collateral gains, breaking strict 1:1 MUSD settlement (`totalCollateral == totalYes == totalNo`) and introducing asset-mismatch insolvency.
- **No `sMUSD` vault on matsnet:** No ERC-4626 MUSD savings vault is present in the canonical `@mezo-org/musd-contracts` matsnet deployment.

**Decision:** Do not route user or LP collateral out of `AnnexMarket`. User collateral remains 100% liquid, non-custodial, and guaranteed redeemable 1:1 in MUSD at all times. Yield routing is deferred until a liquid, MUSD-denominated ERC-4626 buffer with guaranteed atomic withdrawal exists.
