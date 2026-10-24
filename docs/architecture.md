# Annex — Architecture Notes

## One contract, one market table

`AnnexMarket.sol` holds every market in a `mapping(uint256 => Market)`. There is no factory,
no proxy and no upgrade path. The contract is immutable once deployed; governance is limited
to "who is allowed to resolve".

```
Market {
    string  question, description, category;
    uint256 endTime;
    address creator, resolver;

    uint256 reserveYes, reserveNo;   // pool inventory, in share units
    uint256 k;                        // reserveYes * reserveNo
    uint256 totalYes, totalNo;        // every share in existence
    uint256 totalCollateral;          // MUSD backing this market
    uint256 lpTotalSupply;

    Outcome outcome;
    bool    resolved;
}
```

## Trading mechanics

The pool is a constant-product AMM over two share inventories, `x = reserveYes` and
`y = reserveNo`, with `k = x * y`.

Buying YES with `a` MUSD:

```
newReserveNo  = y + a                 // the NO half of the split joins the pool
newReserveYes = k / newReserveNo      // integer division
swapOut       = x - newReserveYes     // YES released by the pool
buyer receives a + swapOut YES shares
```

The `a` term is the important one. A deposit is first split into a complete set
(`a` YES + `a` NO, backed 1:1 by the `a` MUSD). The NO half is the counter-collateral the
pool needs to release YES. Without it the buyer would receive only `swapOut` shares for
`a` MUSD — the marginal cost per share would be `reserveNo / reserveYes` instead of the
quoted `reserveNo / (reserveYes + reserveNo)`, i.e. roughly double at balanced reserves.
Every trade would then be a guaranteed loss for the buyer no matter the outcome.

## Invariants

| Invariant | Where it comes from |
|---|---|
| `totalCollateral == totalYes == totalNo` | every deposit mints exactly one YES and one NO share |
| `totalCollateral >= max(totalYes, totalNo)` | solvency: the winning side can always be paid 1:1 |
| `reserveYes * reserveNo <= k` | constant product, minus integer division dust |
| `priceYes + priceNo == 1e18` | complementary marginal prices |
| `sum(user balances) + reserve == total` | share accounting |

## Settlement

After resolution:

```
users redeem winning shares   ->  (totalWinning - winningReserve) MUSD
LP claims the pool            ->  winningReserve + surplus MUSD
total paid                    ==  totalCollateral
```

`surplus = totalCollateral - totalWinning` is zero under the current accounting (the split
keeps collateral and winning shares in lockstep) but the term is kept so the payout stays
correct if the share accounting ever changes.

Nothing is stranded: after every winner redeems and the LP claims, the contract's MUSD
balance for that market is exactly zero. The test suite asserts this on every lifecycle
path.

## Prices

```
priceYes = reserveNo / (reserveYes + reserveNo)
```

This is the marginal price of one YES share in the pool, which is also what the trader
pays at the margin:

```
d(shares received)/d(a) = 1 + reserveYes/reserveNo = 1 / priceYes
```

So the number the UI shows is the number the market charges. The average execution price of
a trade always lies between the pre-trade and post-trade price, and the difference is the
slippage the LP collects.

## Roles

| Role | Can |
|---|---|
| Anyone | create a market, buy shares |
| Market creator | initial LP, resolver by default |
| Resolver | resolve the market once `endTime` has passed |
| Protocol owner | override the resolver, resolve early or late |
| Protocol owner | **cannot** withdraw funds, change prices, or upgrade |

There is no oracle and no automated resolution in wave 1: the resolver checks the outcome
off-chain and posts it on-chain.

## Known limitations (wave 1)

- LP positions cannot be transferred or joined by anyone other than the creator, so the
  secondary LP market is out of scope.
- No order book — the AMM is the only liquidity venue.
- `getMarketA` / `getMarketB` are split into two calls to avoid stack-too-deep; the
  frontend calls both.
