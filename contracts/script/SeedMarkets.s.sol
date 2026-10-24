// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AnnexMarket} from "../src/AnnexMarket.sol";
import {IERC20} from "../src/IERC20.sol";

/// @notice Seeds a handful of demo markets on an already-deployed AnnexMarket.
///
///         Usage:
///           ANNEX_ADDRESS=0x... forge script script/SeedMarkets.s.sol \
///             --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
contract SeedMarkets is Script {
    struct Seed {
        string question;
        string description;
        string category;
        uint256 duration; // seconds from now
        uint256 liquidity; // MUSD
    }

    function run() external returns (uint256[] memory ids) {
        address annexAddr = vm.envAddress("ANNEX_ADDRESS");
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk != 0) {
            vm.startBroadcast(pk);
        } else {
            vm.startBroadcast();
        }

        AnnexMarket annex = AnnexMarket(annexAddr);
        IERC20 musd = IERC20(annex.musd());

        uint256 pk2 = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pk2 != 0 ? vm.addr(pk2) : msg.sender;
        musd.approve(annexAddr, type(uint256).max);

        Seed[] memory seeds = _seeds();

        ids = new uint256[](seeds.length);
        for (uint256 i = 0; i < seeds.length; i++) {
            ids[i] = annex.createMarket(
                seeds[i].question,
                seeds[i].description,
                seeds[i].category,
                block.timestamp + seeds[i].duration,
                seeds[i].liquidity
            );
            console.log("Market created:", ids[i]);
            console.log("  ", seeds[i].question);
        }

        vm.stopBroadcast();

        console.log("----------------------------------------------------------");
        console.log("Seeded", seeds.length, "markets from", deployer);
        console.log("----------------------------------------------------------");
    }

    function _seeds() internal pure returns (Seed[] memory seeds) {
        seeds = new Seed[](5);
        seeds[0] = Seed({
            question: "Will BTC close above $100,000 this month?",
            description: "Resolves YES if the Binance BTC/USDT daily close at 23:59 UTC is above 100,000 USD on the last day of the month.",
            category: "BTC Price",
            duration: 30 days,
            liquidity: 1_000 ether
        });
        seeds[1] = Seed({
            question: "Will Mezo process more than 1M transactions this week?",
            description: "Resolves YES if the Mezo testnet explorer reports more than 1,000,000 transactions in the calendar week.",
            category: "Mezo",
            duration: 7 days,
            liquidity: 500 ether
        });
        seeds[2] = Seed({
            question: "Will ETH flip BTC market cap this quarter?",
            description: "Resolves YES if Ethereum's market capitalisation exceeds Bitcoin's on any single day before the quarter ends.",
            category: "Crypto",
            duration: 60 days,
            liquidity: 2_000 ether
        });
        seeds[3] = Seed({
            question: "Will a Bitcoin ETF see net inflows for 5 straight days?",
            description: "Resolves YES if spot Bitcoin ETFs record positive net inflows on five consecutive trading days before the deadline.",
            category: "Crypto",
            duration: 14 days,
            liquidity: 1_500 ether
        });
        seeds[4] = Seed({
            question: "Will the next Mezo hard fork ship before December?",
            description: "Resolves YES if the Mezo core team publishes a hard fork release before 1 December.",
            category: "Mezo",
            duration: 45 days,
            liquidity: 750 ether
        });
    }
}
