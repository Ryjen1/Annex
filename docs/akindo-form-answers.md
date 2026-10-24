# Annex — AKINDO form answers

> Paste-ready answers for the submission form sections.

==============================================================================
WHAT IT DOES
==============================================================================
Annex is a permissionless binary prediction market protocol on Mezo Testnet, settled in MUSD.

Anyone can create a yes/no market in one transaction: question, resolution criteria, category, close date and initial liquidity. Traders then buy YES or NO shares from an on-chain constant-product AMM that prices both sides from the pool's own reserves. When a market's end time passes, its resolver (the creator by default, transferable, or the protocol owner) posts the outcome, and winning shares redeem 1:1 for MUSD while the liquidity provider claims the rest of the pool.

The whole protocol is one immutable contract. No proxy, no upgrade key, no admin withdrawal function, no oracle, no off-chain component. MUSD is the reserve asset: liquidity providers deposit it, traders pay it, winners settle in it. Gas is paid in BTC, so the protocol consumes both assets of the Mezo economy - BTC for execution and MUSD for settlement.

It is live: the contract is deployed on Mezo Testnet (0xfdbfde0a430de94c1d862cfc290c36549b5a501d) against canonical MUSD, with seeded markets, a public frontend at annex-markets.vercel.app, 51 passing tests and a public repository.

[character count: 1162]

==============================================================================
THE PROBLEM IT SOLVES
==============================================================================
Prediction markets are proven demand, but the venues are not built for Bitcoin users. They are typically offshore and custodial (your funds sit with an operator, not in a contract you can verify), opaque (a private order book and risk engine you cannot audit), and hard to reach - a Bitcoin-native user needs a separate chain, a bridge, and a stablecoin they do not hold.

Bitcoin has the money, the users and the finality, and there is no market infrastructure on Bitcoin rails where collective opinion gets priced. Annex builds that venue natively on Mezo, a Bitcoin EVM where the stablecoin (MUSD) and the gas asset (BTC) are already the ones the ecosystem uses.

For Mezo specifically this extends MUSD from savings and payments into active, price-discovery capital. A prediction market holds MUSD as pool collateral, prices it continuously, and pays it out at settlement, so the stablecoin earns a spread instead of sitting idle. Traders on Bitcoin get a native way to express a view on measurable outcomes without leaving the chain, and without trusting an operator or trusting a private risk model: solvency is an on-chain invariant, not a claim.

The result is a market venue that is non-custodial, provably solvent, and auditable by reading the contract.

[character count: 1263]

==============================================================================
CHALLENGES I RAN INTO
==============================================================================
1. The AMM was wrong at first. A deposit was not split into a complete set, so the quoted price (the marginal cost) and the price actually charged diverged by about 2.2x - a 50-cent market charged roughly $1.10 per share. I caught it by asserting that the execution price must lie between the pre-trade and post-trade price, then fixed it by splitting every deposit into `a` YES + `a` NO, with the NO half acting as the pool's counter-collateral. Four regression tests now lock that behaviour in.

2. `k` is frozen at market creation in the contract, so re-deriving the price curve in the frontend from the current reserves drifts by rounding once a market has been traded. Rather than mirror the swap math locally, the price curve reads the contract's own `getBuyQuote` through one batched multicall - the chart is the real on-chain curve, not a re-implementation of it.

3. The wallet stack is where most of the integration time went. Mezo Passport (RainbowKit + wagmi) needed node polyfills for Buffer/process/global and React 18 rather than 19, and a placeholder WalletConnect project id was firing rejected relay requests, so that connector was removed until a real id exists.

4. Getting MUSD on testnet was not a faucet click: MUSD is a CDP stablecoin, so it means faucet BTC, open a trove through BorrowerOperations (1,800 MUSD minimum net debt, 110% MCR), and borrow against the collateral.

5. Solidity's stack-too-deep limit forced the market views to be split into getMarketA (strings and roles) and getMarketB (numerics and prices); the frontend calls both.

[character count: 1570]

==============================================================================
TECHNOLOGIES I USED
==============================================================================
Contracts: Solidity 0.8.28 (EVM `london`, optimizer 200 runs, via-ir), Foundry with forge-std - unit, fuzz (256 runs) and invariant tests, `forge fmt`, and CI on GitHub Actions.

Frontend: viem, wagmi v2 and @mezo-org/passport (RainbowKit) for wallet connection, @tanstack/react-query for batched multicall reads, React 18 + TypeScript + Vite 8 + Tailwind CSS v4, and vite-plugin-node-polyfills because the Mezo wallet stack expects Buffer/process/global in the browser.

Tooling: Vercel for the live frontend, static asset hosting and the submission deck/video; GitHub Actions for the test suite; Python (edge-tts + ffmpeg) to produce the narrated product video; hand-written SVG/CSS for the brand kit and the hero scene.

There is no backend, no database, no indexer and no off-chain service: every market, price, position and payout is read from or written to the chain. The deployed contract depends on nothing but an ERC-20 interface.

[character count: 939]

==============================================================================
HOW WE BUILT IT
==============================================================================
We started from the invariant rather than the interface: totalCollateral == totalYes == totalNo, because every deposit mints exactly one YES and one NO share.

Then the AMM. A deposit of `a` MUSD splits into a complete set (a YES + a NO). The NO half becomes the pool's counter-collateral, the pool releases YES with `k` preserved, and the buyer keeps `a + swapOut` shares. `priceYes = reserveNo / (reserveYes + reserveNo)` is the true marginal cost of a share, so the quote the UI shows is the price the market charges, plus ordinary slippage - the difference between the pre-trade and post-trade price is exactly the spread the liquidity provider earns.

The contract is a single immutable market table with create, buy, resolve, redeem, claimLP and setResolver, plus resolver/owner roles that cannot touch pricing or withdraw funds. 51 Foundry tests cover unit paths, fuzz over random trade sequences, a reentrancy attempt through a malicious token during transferFrom, resolution authorisation and timing, full lifecycles for both outcomes, and assertions of the solvency, share-accounting and quote-vs-price invariants after every operation.

The frontend reads markets and user positions through two batched multicalls, renders the live AMM price curve, and carries a user through approve -> buy -> resolve -> redeem. Deployment is a forge script (canonical MUSD on Mezo, a mock everywhere else) plus a seed script; the AMM helpers were verified against a fork of Mezo Testnet by comparing derived post-trade reserves with real on-chain state.

[character count: 1549]

==============================================================================
WHAT WE LEARNED
==============================================================================
1. The accounting detail is the product. Splitting a deposit into a complete set is a small change in code, but it is the difference between a market maker and a guaranteed loss for every buyer. We got that right by writing invariants and regression tests, not by reading the code carefully.

2. Show the chain's numbers; do not re-derive them. Moving the price curve from a local AMM implementation to on-chain quotes removed an entire class of rounding bugs and made the UI provably consistent with settlement.

3. "Native Bitcoin EVM" is a systems problem, not a compiler problem. The wallet stack needed polyfills and a React version pin, the frontend needed a multicall contract, and MUSD had to be borrowed against BTC rather than clicked out of a faucet. The primitives are simple; integrating them honestly is not.

4. UX is trust. Displaying price impact, average execution price and a reserve-backed price rail is what separates a betting app from a market people can verify - and with judging weighted on user experience and composability, that transparency is the product.

5. A permissionless protocol is mostly explicit, boring design: who can resolve, who can claim the LP surplus, what happens to unclaimed collateral. We chose narrow, stated roles over admin powers, and would rather ship fewer features than an admin key.

[character count: 1339]
