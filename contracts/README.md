# Annex — Contracts

Foundry project for the Annex protocol. See the [root README](../README.md) for the full
picture and [`../docs/architecture.md`](../docs/architecture.md) for the AMM design.

```
src/
  AnnexMarket.sol        core protocol — Manual & PriceFeed markets, AMM, 30 bps entry fee, resolution, redemption, LP claims
  IERC20.sol             minimal ERC20 interface
  MockMUSD.sol           ERC20 with public mint(), for local nodes only
test/
  AnnexMarket.t.sol      51 Wave 1 tests — unit, fuzz, reentrancy, full lifecycle, 4 AMM regression tests
  AnnexMarketWave2.t.sol 14 Wave 2 tests — PriceFeed BTC/USD markets, fee isolation, Trove state, global solvency fuzz
  mocks/                 MockERC20 / MockPriceFeed / MockTroveManager
script/
  DeployAnnex.s.sol      deploys the protocol (canonical MUSD / PriceFeed / TroveManager on Mezo, mocks elsewhere)
  SeedMarkets.s.sol      creates 6 Wave 2 markets (2 PriceFeed + 4 Manual)
  SmokeTestWave2.s.sol   fork / testnet Wave 2 end-to-end smoke script
```

## Commands

```bash
forge build
forge test -vvv

# local node
anvil --chain-id 31611 --hardfork shanghai
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export RPC_URL=http://127.0.0.1:8545

forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
ANNEX_ADDRESS=0x... forge script script/SeedMarkets.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast

# Mezo Testnet (deploy + Blockscout verify)
export RPC_URL=https://rpc.test.mezo.org
forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
forge verify-contract <ADDRESS> src/AnnexMarket.sol:AnnexMarket \
  --verifier blockscout --verifier-url https://api.explorer.test.mezo.org/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address,address,uint256)" \
    0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 \
    0x86bCF0841622a5dAC14A313a15f96A95421b9366 \
    0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0 30)
```

`DeployAnnex.s.sol` wires canonical `MUSD` (`0x1189...Ac503`), `PriceFeed` (`0x86bC...b9366`),
and `TroveManager` (`0xE47c...6bb0`) with `feeBps = 30` when MUSD has code on chain (31611 live or
fork), and deploys local mocks otherwise.
