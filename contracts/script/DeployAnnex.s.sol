// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AnnexMarket} from "../src/AnnexMarket.sol";
import {MockMUSD} from "../src/MockMUSD.sol";
import {MockPriceFeed} from "../test/mocks/MockPriceFeed.sol";
import {MockTroveManager} from "../test/mocks/MockTroveManager.sol";

/// @notice Deploys AnnexMarket (Wave 2).
///
///         On Mezo Testnet (chain id 31611, or a fork of it) it wires canonical
///         MUSD, PriceFeed, and TroveManager automatically.
///         On an un-forked local anvil it deploys MockMUSD, MockPriceFeed, and MockTroveManager.
///
///         Usage:
///           forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL \
///             --private-key $PRIVATE_KEY --broadcast
///
///         Optional env vars:
///           PRIVATE_KEY            deployer key (otherwise use --private-key/--account/--ledger)
///           MUSD_ADDRESS           override settlement token
///           PRICE_FEED_ADDRESS     override BTC/USD PriceFeed
///           TROVE_MANAGER_ADDRESS  override Mezo TroveManager
///           FEE_BPS                override entry fee in bps (default 30 = 0.30%, max 200)
contract DeployAnnex is Script {
    uint256 public constant MEZO_CHAIN_ID = 31611;
    address public constant MEZO_MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address public constant MEZO_PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address public constant MEZO_TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    uint256 public constant DEFAULT_FEE_BPS = 30;

    function run()
        external
        returns (AnnexMarket annex, address musd, address priceFeed, address troveManager)
    {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk != 0) {
            vm.startBroadcast(pk);
        } else {
            vm.startBroadcast();
        }

        bool onMezoOrFork = block.chainid == MEZO_CHAIN_ID && MEZO_MUSD.code.length > 0;

        musd = vm.envOr("MUSD_ADDRESS", address(0));
        if (musd == address(0)) {
            musd = onMezoOrFork ? MEZO_MUSD : address(new MockMUSD());
        }

        priceFeed = vm.envOr("PRICE_FEED_ADDRESS", address(0));
        if (priceFeed == address(0)) {
            priceFeed = (onMezoOrFork && MEZO_PRICE_FEED.code.length > 0)
                ? MEZO_PRICE_FEED
                : address(new MockPriceFeed(74_000 ether));
        }

        troveManager = vm.envOr("TROVE_MANAGER_ADDRESS", address(0));
        if (troveManager == address(0)) {
            troveManager = (onMezoOrFork && MEZO_TROVE_MANAGER.code.length > 0)
                ? MEZO_TROVE_MANAGER
                : address(new MockTroveManager());
        }

        uint256 feeBps = vm.envOr("FEE_BPS", DEFAULT_FEE_BPS);
        annex = new AnnexMarket(musd, priceFeed, troveManager, feeBps);

        vm.stopBroadcast();

        console.log("----------------------------------------------------------");
        console.log("Annex Wave 2 deployed");
        console.log("----------------------------------------------------------");
        console.log("AnnexMarket  :", address(annex));
        console.log("MUSD         :", musd);
        console.log("PriceFeed    :", priceFeed);
        console.log("TroveManager :", troveManager);
        console.log("Fee (bps)    :", feeBps);
        console.log("Chain id     :", block.chainid);
        console.log("Owner        :", annex.owner());
        console.log("----------------------------------------------------------");
    }
}
