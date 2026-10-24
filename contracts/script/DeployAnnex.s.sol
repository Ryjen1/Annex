// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AnnexMarket} from "../src/AnnexMarket.sol";
import {MockMUSD} from "../src/MockMUSD.sol";

/// @notice Deploys AnnexMarket.
///
///         On Mezo Testnet (chain id 31611) it uses the canonical MUSD token.
///         On any other chain (anvil, local) it deploys a MockMUSD for testing.
///
///         Usage:
///           forge script script/DeployAnnex.s.sol --rpc-url $RPC_URL \
///             --private-key $PRIVATE_KEY --broadcast
///
///         Optional env vars:
///           PRIVATE_KEY   deployer key (otherwise use --private-key/--account/--ledger)
///           MUSD_ADDRESS  force a specific settlement token
contract DeployAnnex is Script {
    uint256 public constant MEZO_CHAIN_ID = 31611;
    address public constant MEZO_MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;

    function run() external returns (AnnexMarket annex, address musd) {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk != 0) {
            vm.startBroadcast(pk);
        } else {
            vm.startBroadcast();
        }

        musd = vm.envOr("MUSD_ADDRESS", address(0));
        if (musd == address(0)) {
            // Use canonical MUSD only when it actually exists at that address
            // (a local anvil on chain 31611 has no Mezo contracts deployed).
            if (block.chainid == MEZO_CHAIN_ID && MEZO_MUSD.code.length > 0) {
                musd = MEZO_MUSD;
            } else {
                musd = address(new MockMUSD());
            }
        }

        annex = new AnnexMarket(musd);

        vm.stopBroadcast();

        console.log("----------------------------------------------------------");
        console.log("Annex deployed");
        console.log("----------------------------------------------------------");
        console.log("AnnexMarket :", address(annex));
        console.log("MUSD        :", musd);
        console.log("Chain id    :", block.chainid);
        console.log("Owner       :", annex.owner());
        console.log("----------------------------------------------------------");
    }
}
