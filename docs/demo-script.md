# Annex — 2-Minute Pitch Video Shot List

> Target length: **120 s**. AKINDO asks for a 2-minute pitch video.
> Screen recording only — no face cam, no music bed under the voice.
> Capture at 1920×1080, 60 fps, browser zoom 100 %, notifications off.

## Before you record

1. Wallet funded on Mezo Testnet: testnet BTC for gas + MUSD for trading (`docs/submission.md`
   explains the MUSD route: faucet BTC → borrow MUSD in the Mezo testnet app).
2. **Live deployment** — `AnnexMarket` at
   `0xfdbfde0a430de94c1d862cfc290c36549b5a501d`
   (https://explorer.test.mezo.org/address/0xfdbfde0a430de94c1d862cfc290c36549b5a501d),
   app at https://annex-markets.vercel.app, seven markets live.
3. Market ids to use on camera: **0** (BTC > $100k — already traded, price at ~59% YES),
   **1** (Mezo 1M txns — traded, ~42% YES), **5** ("Will Annex's first demo market resolve
   YES?" — 30-minute market, created for the resolve→redeem shots; the deployer/owner can
   resolve it early).
4. MetaMask unlocked on the Mezo Testnet network, account visible, notifications silenced.
5. Tabs ready: `annex-markets.vercel.app` (app) and `explorer.test.mezo.org` (contract).

Route map: `/` is the landing page (hero + explainer + live featured markets),
`/markets` is the full market list, `/market/<id>` is a market, `/create` and
`/portfolio` are the write paths.

## The shots

| # | Time | On screen | Voiceover / on-screen text |
|---|------|-----------|---------------------------|
| 1 | 0:00–0:10 | Title card: `Annex` + tagline | "Bitcoin has the money, the users and the finality — and no venue for collective opinion. Annex is a permissionless prediction market that runs natively on Mezo." |
| 2 | 0:10–0:20 | Explorer tab: the deployed `AnnexMarket` contract | "One contract. No custody, no upgrade key, no admin pricing. Anyone can create a market." |
| 3 | 0:20–0:35 | Landing hero, then `/markets` (live prices, pools, countdown) | "Buyers take YES or NO from an on-chain constant-product AMM. The price you see is the marginal price — reserve NO over total reserves — so the quote is the price you pay." |
| 4 | 0:35–0:50 | Market detail: trade panel, enter 25 MUSD, live quote | "Twenty-five MUSD buys forty-nine shares of YES, at a shown average price. No order book, no operator, no hidden markup." |
| 5 | 0:50–1:05 | MetaMask approve popup → MetaMask sign popup → position updates, price moves | "Approve MUSD once. Trade. The pool price moves immediately and the position shows what you own." |
| 6 | 1:05–1:20 | Solvency line in the terminal or architecture doc (`totalCollateral == totalYes == totalNo`) | "Every MUSD deposited mints exactly one YES and one NO share, so whichever side wins, every winning share is backed one-to-one." |
| 7 | 1:20–1:35 | Resolve action on an ended market → resolved banner | "After the close, the resolver posts the outcome. The protocol owner can settle early; nobody else can touch it." |
| 8 | 1:35–1:50 | Redeem click → MUSD balance goes up in the header | "Winning shares redeem one-to-one in MUSD — Bitcoin-backed stablecoin, settled on-chain. The LP claims the rest of the pool." |
| 9 | 1:50–2:00 | End card: app URL, contract, GitHub | "Annex. Permissionless binary prediction markets on Mezo, settled in MUSD. Gas in BTC. Code and docs are public." |

## Recording notes

- Keep the cursor deliberate; pause ~1 s on the quote updating in shot 4 and on the balance in
  shot 8 so the number is readable.
- Do not show wallet seed phrases, private keys, or the faucet page with personal data.
- Add captions for the three numbers that carry the argument: the quote, the execution price,
  and the redeemed amount.
- If a transaction is slow, cut to the explorer link for that transaction rather than waiting
  on screen — but never cut mid-sentence.
- End card must show the live app URL, the contract address and the public repo.
