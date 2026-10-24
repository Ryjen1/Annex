# Annex — Contracts

Foundry project for the Annex protocol. See the [root README](../README.md) for the full
picture and [`../docs/architecture.md`](../docs/architecture.md) for the AMM design.

```
src/
  AnnexMarket.sol   core protocol — markets, AMM, resolution, redemption, LP claims
  IERC20.sol        minimal ERC20 interface
  MockMUSD.sol      ERC20 with public mint(), for local nodes only
test/
  AnnexMarket.t.sol 51 tests — unit, fuzz, reentrancy, full lifecycle
  mocks/             malicious token used to test the reentrancy guard
script/
  DeployAnnex.s.sol  deploys the protocol (canonical MUSD on Mezo, mock elsewhere)
  SeedMarkets.s.sol  creates five demo markets
```

## Commands

```bash
forge build
forge test -vvv

# local node
anvil --chain-id 31611
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export RPC_URL=http://127.0.0.1:8545

forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
ANNEX_ADDRESS=0x... forge script script/SeedMarkets.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast

# Mezo Testnet
export RPC_URL=https://rpc.test.mezo.org
forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --verify
```

`DeployAnnex.s.sol` uses the canonical MUSD (`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`)
when it has code on the target chain, and a `MockMUSD` otherwise.
