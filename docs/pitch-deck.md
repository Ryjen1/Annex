# Annex — Pitch Deck

> 8 slides. Kept deliberately short: the demo does the talking.
> Product name is **Annex**, everywhere. No external project names anywhere.

---

## 1 — Title

**Annex**
Permissionless binary prediction markets, settled in MUSD on Mezo.

Create a market about anything. Trade YES or NO. Redeem 1:1 when it resolves.
Non-custodial, one contract, gas paid in BTC.

`mezotestnet · 31611`

---

## 2 — The problem

People already bet on outcomes — sports, elections, crypto prices, headlines. But the places
where they do it are:

- **Offshore and custodial.** Funds sit with an operator, not in a contract you can verify.
- **Hard to reach.** A Bitcoin-native user needs a separate chain, a bridge, and a stablecoin
  they do not hold.
- **Opaque.** A proprietary order book and a private risk engine. You cannot check that the
  market is solvent.

There is no market infrastructure on Bitcoin rails. Bitcoin has the money, the users and the
finality — and no venue for collective opinion.

---

## 3 — The solution

**Annex is a prediction market protocol that runs natively on Mezo, a Bitcoin EVM.**

- Any wallet can create a yes/no market in one transaction.
- An on-chain constant-product AMM prices the two sides and settles every trade.
- The winner redeems 1:1 for **MUSD**, a Bitcoin-backed stablecoin.
- Everything is verifiable on-chain. There is no operator, no order book, no off-chain
  component.

**The pitch in one line:** a market maker in your pocket, with a settlement guarantee you can
read in the bytecode.

---

## 4 — How the AMM works

Each market holds a pool of YES and NO shares with a constant product `x · y = k`.

```
buy YES with a MUSD
  └─► split a into a complete set:  a YES + a NO
        ├─ the NO half becomes counter-collateral in the pool
        └─ the pool releases YES to the buyer  (k preserved)

buyer receives  a + swapOut  YES shares
```

**The price is honest.** `priceYes = reserveNo / (reserveYes + reserveNo)` is not a display
number — it is the true marginal cost of a share. The price a trader sees is the price they
pay, plus normal slippage.

**The spread is the business.** The liquidity provider earns the difference between the
pre-trade and post-trade price. The trader pays slippage, not a hidden markup.

---

## 5 — Why it is safe

```
totalCollateral  ==  totalYes  ==  totalNo
```

Every MUSD deposited mints exactly one YES and one NO share. So whichever side wins, every
winning share is backed 1:1 by MUSD — and after resolution the entire collateral is
distributed. Nothing is stranded, nothing is borrowed.

Plus:

- No withdrawal function, no upgrade key, no admin pricing.
- Resolution is permissioned to the market's resolver or the protocol owner — and nothing else.
- Reentrancy-guarded entry points, fuzz-tested invariants, 51 passing tests.

**The invariant is the product.** You do not have to trust the operator's risk engine; you
read it off the contract.

---

## 6 — The demo (90 seconds)

1. **Connect** a Bitcoin wallet (Unisat, Xverse, OKX) or any injected EVM wallet.
2. **Create** a market: question, resolution criteria, close date, 1,000 MUSD of liquidity.
   You become the liquidity provider.
3. **Trade.** Buy 100 MUSD of YES at 50¢ → receive ~190 YES shares. The price moves to ~55¢.
   The LP position is worth more than you put in — that is the spread.
4. **Resolve** at the close. The resolver posts the outcome.
5. **Redeem.** Winning shares pay 1:1 in MUSD. The LP claims the rest of the pool.

No registration, no deposit address, no support ticket.

---

## 7 — What is built today

| Piece | Status |
|---|---|
| Core contract (`AnnexMarket`) | done — create / trade / resolve / redeem / LP claim |
| AMM | done — constant product, exact solvency, honest marginal pricing |
| Test suite | done — 51 tests: unit, fuzz, reentrancy, full lifecycle |
| Deploy + seed scripts | done — verified on a local node |
| Frontend | done — markets, market detail, trade, create, portfolio |
| Docs | done — README + architecture notes |

**Next:** deploy to Mezo Testnet, open the first user-funded markets, publish the market
list, and open LP positions to secondary providers.

---

## 8 — Roadmap

**Wave 1 (now)**
- Deploy to Mezo Testnet, seed markets, onboard the first traders.
- LP shares become transferable — anyone can provide liquidity.
- Price history chart per market.

**Wave 2**
- Multi-outcome markets (any number of buckets, not just yes/no).
- Oracles: a resolution source that a market creator can point at instead of a person.
- Fee switch that routes the spread to a treasury.

**The long game:** a Bitcoin-native market for every measurable claim, with settlement that
does not ask anybody for permission.

---

*Annex · Mezo Testnet · MUSD settlement · gas in BTC · non-custodial*
