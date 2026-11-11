// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AnnexMarket} from "../src/AnnexMarket.sol";
import {IERC20} from "../src/IERC20.sol";

/// @notice Seeds demo markets (both PriceFeed BTC/USD oracle markets and manual resolver markets).
///
///         Usage:
///           ANNEX_ADDRESS=0x... forge script script/SeedMarkets.s.sol \
///             --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
contract SeedMarkets is Script {
    struct ManualSeed {
        string question;
        string description;
        string category;
        uint256 duration; // seconds from now
        uint256 liquidity; // MUSD
    }

    struct PriceSeed {
        string question;
        string description;
        uint256 duration;
        uint256 liquidity;
        uint256 strikePrice;
        bool resolveAbove;
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

        address deployer = pk != 0 ? vm.addr(pk) : msg.sender;
        musd.approve(annexAddr, type(uint256).max);

        PriceSeed[] memory priceSeeds = _priceSeeds();
        ManualSeed[] memory manualSeeds = _manualSeeds();

        ids = new uint256[](priceSeeds.length + manualSeeds.length);
        uint256 idx = 0;

        for (uint256 i = 0; i < priceSeeds.length; i++) {
            ids[idx] = annex.createPriceMarket(
                priceSeeds[i].question,
                priceSeeds[i].description,
                block.timestamp + priceSeeds[i].duration,
                priceSeeds[i].liquidity,
                priceSeeds[i].strikePrice,
                priceSeeds[i].resolveAbove
            );
            console.log("PriceFeed Market created:", ids[idx]);
            console.log("  ", priceSeeds[i].question);
            idx++;
        }

        for (uint256 i = 0; i < manualSeeds.length; i++) {
            ids[idx] = annex.createMarket(
                manualSeeds[i].question,
                manualSeeds[i].description,
                manualSeeds[i].category,
                block.timestamp + manualSeeds[i].duration,
                manualSeeds[i].liquidity
            );
            console.log("Manual Market created:", ids[idx]);
            console.log("  ", manualSeeds[i].question);
            idx++;
        }

        vm.stopBroadcast();

        console.log("----------------------------------------------------------");
        console.log("Seeded", ids.length, "markets from", deployer);
        console.log("----------------------------------------------------------");
    }

    function _priceSeeds() internal pure returns (PriceSeed[] memory seeds) {
        seeds = new PriceSeed[](2);
        seeds[0] = PriceSeed({
            question: "Will BTC trade >= $75,000 at expiry (Mezo PriceFeed)?",
            description: "Objective oracle market settled permissionlessly via Mezo PriceFeed.fetchPrice() at or after expiry. Resolves YES if BTC/USD >= $75,000.",
            duration: 14 days,
            liquidity: 500 ether,
            strikePrice: 75_000 ether,
            resolveAbove: true
        });
        seeds[1] = PriceSeed({
            question: "Will BTC drop below $70,000 within 7 days (Mezo PriceFeed)?",
            description: "Objective oracle market settled permissionlessly via Mezo PriceFeed.fetchPrice() at or after expiry. Resolves YES if BTC/USD < $70,000.",
            duration: 7 days,
            liquidity: 400 ether,
            strikePrice: 70_000 ether,
            resolveAbove: false
        });
    }

    function _manualSeeds() internal pure returns (ManualSeed[] memory seeds) {
        seeds = new ManualSeed[](4);
        seeds[0] = ManualSeed({
            question: "Will Mezo Testnet cross 5,000 active Troves this month?",
            description: "Subjective ecosystem milestone resolved by market creator against public Mezo explorer Trove stats at expiry.",
            category: "Mezo",
            duration: 21 days,
            liquidity: 300 ether
        });
        seeds[1] = ManualSeed({
            question: "Will MUSD total supply exceed 100M across Mezo deployments?",
            description: "Resolves YES if canonical MUSD minted supply exceeds 100,000,000 MUSD before the market end timestamp.",
            category: "Mezo",
            duration: 30 days,
            liquidity: 400 ether
        });
        seeds[2] = ManualSeed({
            question: "Will a Bitcoin spot ETF record 5 consecutive days of inflows this month?",
            description: "Resolves YES if spot Bitcoin ETFs post positive net inflows on five consecutive US trading days before expiry.",
            category: "Crypto",
            duration: 14 days,
            liquidity: 350 ether
        });
        seeds[3] = ManualSeed({
            question: "Will Annex Wave 2 demo settlement market resolve YES?",
            description: "Short-lived lifecycle demonstration market resolved YES by the creator once Wave 2 verification trades finish.",
            category: "Other",
            duration: 30 minutes,
            liquidity: 200 ether
        });
    }
}
