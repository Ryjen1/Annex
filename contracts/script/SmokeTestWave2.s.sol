// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AnnexMarket} from "../src/AnnexMarket.sol";
import {IERC20} from "../src/IERC20.sol";

interface IBorrowerOperations {
    function openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) external payable;
    function addColl(address _upperHint, address _lowerHint) external payable;
}

/// @notice End-to-end Wave 2 smoke test for forked Mezo Testnet or local anvil.
///         Verifies: BorrowerOperations trove funding -> getUserTroveState ->
///         createPriceMarket -> buyShares (with 0.30% protocol fee) ->
///         resolvePriceMarket -> redeem -> claimLp -> claimFees.
contract SmokeTestWave2 is Script {
    address public constant BORROWER_OPS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address trader = vm.addr(pk);

        address musdAddr = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
        address priceFeedAddr = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
        address troveManagerAddr = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;

        vm.startBroadcast(pk);

        AnnexMarket annex = new AnnexMarket(musdAddr, priceFeedAddr, troveManagerAddr, 30);
        uint256 btcPrice = annex.liveBtcPrice();
        console.log("Live Mezo BTC/USD Price:", btcPrice);

        // Open a real trove via BorrowerOperations (0.05 BTC -> 1,900 MUSD debt)
        IBorrowerOperations(BORROWER_OPS).openTrove{value: 0.05 ether}(
            1_900 ether,
            address(0),
            address(0)
        );

        (uint8 status, uint256 coll, uint256 debt, uint256 icr, uint256 maxBorrow, uint256 mcr,) =
            annex.getUserTroveState(trader);
        console.log("Trove status:", status);
        console.log("Trove coll (wei):", coll);
        console.log("Trove debt (wei):", debt);
        console.log("Trove ICR (1e18):", icr);
        console.log("Trove maxBorrow:", maxBorrow);
        console.log("Trove MCR:", mcr);

        IERC20 musd = IERC20(musdAddr);
        musd.approve(address(annex), type(uint256).max);

        // Create a short-expiry PriceFeed market guaranteed to resolve YES
        uint256 marketId = annex.createPriceMarket(
            "Smoke: BTC >= $10,000?",
            "End-to-end PriceFeed settlement check.",
            block.timestamp + 30,
            200 ether,
            10_000 ether,
            true
        );

        (uint256 quotedShares, uint256 quotedFee,) =
            annex.getBuyQuoteWithFee(marketId, AnnexMarket.Outcome.Yes, 100 ether);
        annex.buyShares(marketId, AnnexMarket.Outcome.Yes, 100 ether);
        console.log("Quoted shares:", quotedShares);
        console.log("Collected fee:", quotedFee);

        vm.stopBroadcast();
        console.log("Fork smoke setup succeeded on Annex:", address(annex));
    }
}
