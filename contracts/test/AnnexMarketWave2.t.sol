// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {AnnexMarket} from "../src/AnnexMarket.sol";
import {MockMUSD} from "../src/MockMUSD.sol";
import {MockPriceFeed} from "./mocks/MockPriceFeed.sol";
import {MockTroveManager} from "./mocks/MockTroveManager.sol";

contract AnnexMarketWave2Test is Test {
    AnnexMarket internal annex;
    MockMUSD internal musd;
    MockPriceFeed internal priceFeed;
    MockTroveManager internal troveManager;

    address internal alice;
    address internal bob;
    address internal carol;
    address internal treasury;

    uint256 internal constant FEE_BPS = 30; // 0.30%
    uint256 internal constant LIQUIDITY = 1_000 ether;
    uint256 internal constant INITIAL_BTC_PRICE = 74_000 ether;
    uint256 internal constant DAY = 1 days;

    function setUp() public {
        musd = new MockMUSD();
        priceFeed = new MockPriceFeed(INITIAL_BTC_PRICE);
        troveManager = new MockTroveManager();
        annex = new AnnexMarket(address(musd), address(priceFeed), address(troveManager), FEE_BPS);

        alice = makeAddr("alice");
        bob = makeAddr("bob");
        carol = makeAddr("carol");
        treasury = makeAddr("treasury");

        _fund(alice, 1_000_000 ether);
        _fund(bob, 1_000_000 ether);
        _fund(carol, 1_000_000 ether);
    }

    function _fund(address who, uint256 amount) internal {
        musd.mint(who, amount);
        vm.prank(who);
        musd.approve(address(annex), type(uint256).max);
    }

    function _createPrice(address creator, uint256 strike, bool resolveAbove) internal returns (uint256 id) {
        vm.prank(creator);
        id = annex.createPriceMarket(
            resolveAbove ? "BTC >= strike?" : "BTC < strike?",
            "Settled strictly from Mezo PriceFeed.",
            block.timestamp + DAY,
            LIQUIDITY,
            strike,
            resolveAbove
        );
    }

    // ────────────────────────── Constructor Guards ──────────────────────────

    function test_Constructor_GuardsFeeCapAndZeroMusd() public {
        vm.expectRevert(AnnexMarket.ZeroAddress.selector);
        new AnnexMarket(address(0), address(priceFeed), address(troveManager), FEE_BPS);

        vm.expectRevert(AnnexMarket.FeeTooHigh.selector);
        new AnnexMarket(address(musd), address(priceFeed), address(troveManager), 201);

        AnnexMarket maxFee = new AnnexMarket(address(musd), address(priceFeed), address(troveManager), 200);
        assertEq(maxFee.feeBps(), 200);
    }

    // ────────────────────────── PriceFeed Markets ──────────────────────────

    function test_CreatePriceMarket_StoresOracleConfig() public {
        uint256 strike = 80_000 ether;
        uint256 endTime = block.timestamp + DAY;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit AnnexMarket.PriceMarketCreated(0, strike, true);
        uint256 id = annex.createPriceMarket(
            "BTC >= $80k?",
            "Oracle check",
            endTime,
            LIQUIDITY,
            strike,
            true
        );

        (, , string memory category, , address creator, address resolver, , bool resolved) = annex.getMarketA(id);
        assertEq(category, "BTC Price");
        assertEq(creator, alice);
        assertEq(resolver, address(priceFeed));
        assertFalse(resolved);

        (AnnexMarket.MarketKind kind, uint256 storedStrike, bool resolveAbove, uint256 resolvedPrice) =
            annex.getPriceMarket(id);
        assertEq(uint256(kind), uint256(AnnexMarket.MarketKind.PriceFeed));
        assertEq(storedStrike, strike);
        assertTrue(resolveAbove);
        assertEq(resolvedPrice, 0);
    }

    function test_RevertWhen_CreatePriceMarket_InvalidArgs() public {
        AnnexMarket noFeed = new AnnexMarket(address(musd), address(0), address(troveManager), FEE_BPS);
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.PriceFeedNotConfigured.selector);
        noFeed.createPriceMarket("BTC >= $80k?", "D", block.timestamp + DAY, LIQUIDITY, 80_000 ether, true);

        vm.prank(alice);
        vm.expectRevert(AnnexMarket.InvalidStrikePrice.selector);
        annex.createPriceMarket("BTC >= $0?", "D", block.timestamp + DAY, LIQUIDITY, 0, true);
    }

    function test_ResolvePriceMarket_AboveStrike_YesAtExactBoundary() public {
        uint256 id = _createPrice(alice, 80_000 ether, true);
        vm.warp(block.timestamp + DAY);
        priceFeed.setPrice(80_000 ether);

        // Anyone (carol, non-creator/non-owner) can settle from the oracle once expired
        vm.prank(carol);
        annex.resolvePriceMarket(id);

        (, , , , , , AnnexMarket.Outcome outcome, bool resolved) = annex.getMarketA(id);
        (, , , uint256 resolvedPrice) = annex.getPriceMarket(id);
        assertTrue(resolved);
        assertEq(uint256(outcome), uint256(AnnexMarket.Outcome.Yes));
        assertEq(resolvedPrice, 80_000 ether);
    }

    function test_ResolvePriceMarket_AboveStrike_NoBelowStrike() public {
        uint256 id = _createPrice(alice, 80_000 ether, true);
        vm.warp(block.timestamp + DAY + 1);
        priceFeed.setPrice(79_999 ether);

        vm.prank(bob);
        annex.resolvePriceMarket(id);

        (, , , , , , AnnexMarket.Outcome outcome, bool resolved) = annex.getMarketA(id);
        assertTrue(resolved);
        assertEq(uint256(outcome), uint256(AnnexMarket.Outcome.No));
    }

    function test_ResolvePriceMarket_BelowStrike_Boundary() public {
        uint256 idExact = _createPrice(alice, 70_000 ether, false);
        uint256 idBelow = _createPrice(alice, 70_000 ether, false);

        vm.warp(block.timestamp + DAY);
        priceFeed.setPrice(70_000 ether);
        annex.resolvePriceMarket(idExact);

        (, , , , , , AnnexMarket.Outcome exactOutcome,) = annex.getMarketA(idExact);
        assertEq(uint256(exactOutcome), uint256(AnnexMarket.Outcome.No), "exact strike is not strictly below");

        priceFeed.setPrice(69_999 ether);
        annex.resolvePriceMarket(idBelow);
        (, , , , , , AnnexMarket.Outcome belowOutcome,) = annex.getMarketA(idBelow);
        assertEq(uint256(belowOutcome), uint256(AnnexMarket.Outcome.Yes));
    }

    function test_RevertWhen_ResolvePriceMarket_BeforeExpiry() public {
        uint256 id = _createPrice(alice, 80_000 ether, true);
        vm.expectRevert(AnnexMarket.NotEndedYet.selector);
        annex.resolvePriceMarket(id); // even owner cannot resolve early
    }

    function test_RevertWhen_ResolvePriceMarket_StaleOracle() public {
        uint256 id = _createPrice(alice, 80_000 ether, true);
        vm.warp(block.timestamp + DAY);
        priceFeed.setStale(true);

        vm.expectRevert("PriceFeed: Oracle is stale.");
        annex.resolvePriceMarket(id);
    }

    function test_RevertWhen_ManualOverrideOnPriceFeedMarket() public {
        uint256 id = _createPrice(alice, 80_000 ether, true);
        vm.warp(block.timestamp + DAY + 1);

        // Neither creator nor protocol owner can override a PriceFeed market
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.PriceFeedMarketOnly.selector);
        annex.resolve(id, AnnexMarket.Outcome.Yes);

        vm.expectRevert(AnnexMarket.PriceFeedMarketOnly.selector);
        annex.resolve(id, AnnexMarket.Outcome.No);

        vm.expectRevert(AnnexMarket.PriceFeedMarketOnly.selector);
        annex.setResolver(id, bob);
    }

    function test_RevertWhen_ResolvePriceMarketOnManualMarket() public {
        vm.prank(alice);
        uint256 manualId = annex.createMarket("Manual?", "Subjective", "Mezo", block.timestamp + DAY, LIQUIDITY);
        vm.warp(block.timestamp + DAY + 1);

        vm.expectRevert(AnnexMarket.NotPriceFeedMarket.selector);
        annex.resolvePriceMarket(manualId);

        (AnnexMarket.MarketKind kind, uint256 strike, bool resolveAbove, uint256 resolvedPrice) =
            annex.getPriceMarket(manualId);
        assertEq(uint256(kind), uint256(AnnexMarket.MarketKind.Manual));
        assertEq(strike, 0);
        assertFalse(resolveAbove);
        assertEq(resolvedPrice, 0);
    }

    // ────────────────────────── Protocol Fee & Collateral Isolation ──────────────────────────

    function test_ProtocolFee_DeductedOnEntryAndIsolatedFromCollateral() public {
        uint256 id = _createPrice(alice, 75_000 ether, true);
        uint256 gross = 1_000 ether;
        uint256 expectedFee = (gross * FEE_BPS) / 10_000; // 3 MUSD
        uint256 expectedNet = gross - expectedFee; // 997 MUSD

        (uint256 quotedShares, uint256 quotedFee, uint256 quotedNet) =
            annex.getBuyQuoteWithFee(id, AnnexMarket.Outcome.Yes, gross);
        assertEq(quotedFee, expectedFee);
        assertEq(quotedNet, expectedNet);
        assertEq(annex.getBuyQuote(id, AnnexMarket.Outcome.Yes, gross), quotedShares);

        uint256 bobBefore = musd.balanceOf(bob);
        vm.prank(bob);
        vm.expectEmit(true, true, false, true);
        emit AnnexMarket.ProtocolFeeCollected(id, bob, gross, expectedFee, expectedNet);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, gross);

        assertEq(bobBefore - musd.balanceOf(bob), gross);
        assertEq(annex.yesBalances(id, bob), quotedShares);
        assertEq(annex.accruedFees(), expectedFee);
        assertEq(annex.totalLockedCollateral(), LIQUIDITY + expectedNet);
        assertEq(musd.balanceOf(address(annex)), LIQUIDITY + expectedNet + expectedFee);

        (, , uint256 totalColl, uint256 totalYes, uint256 totalNo, , ,) = annex.getMarketB(id);
        assertEq(totalColl, LIQUIDITY + expectedNet);
        assertEq(totalYes, totalColl);
        assertEq(totalNo, totalColl);
    }

    function test_ProtocolFee_RedeemPaysExactShownSharesAndClaimFeesNeverTouchesCollateral() public {
        uint256 id = _createPrice(alice, 75_000 ether, true);
        uint256 gross = 500 ether;
        (uint256 shownShares, uint256 shownFee,) = annex.getBuyQuoteWithFee(id, AnnexMarket.Outcome.Yes, gross);

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, gross);

        // Claiming fees BEFORE resolution succeeds only for owner and leaves full collateral intact
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.NotAuthorized.selector);
        annex.claimFees(bob);

        vm.expectRevert(AnnexMarket.ZeroAddress.selector);
        annex.claimFees(address(0));

        annex.claimFees(treasury);
        assertEq(musd.balanceOf(treasury), shownFee);
        assertEq(annex.accruedFees(), 0);
        assertEq(musd.balanceOf(address(annex)), annex.totalLockedCollateral());

        // Attempting to claim again reverts
        vm.expectRevert(AnnexMarket.NoAccruedFees.selector);
        annex.claimFees(treasury);

        // Settle market YES -> Bob redeems 1:1 exact shownShares -> Alice claims LP
        vm.warp(block.timestamp + DAY);
        priceFeed.setPrice(80_000 ether);
        annex.resolvePriceMarket(id);

        uint256 bobBeforeRedeem = musd.balanceOf(bob);
        vm.prank(bob);
        annex.redeem(id);
        assertEq(musd.balanceOf(bob) - bobBeforeRedeem, shownShares, "1:1 redemption must match shown quote");

        uint256 aliceBeforeLp = musd.balanceOf(alice);
        vm.prank(alice);
        annex.claimLp(id);
        assertGt(musd.balanceOf(alice) - aliceBeforeLp, 0);

        assertEq(annex.totalLockedCollateral(), 0);
        assertEq(musd.balanceOf(address(annex)), 0);
    }

    // ────────────────────────── Live Trove State View ──────────────────────────

    function test_UserTroveState_ReadsActiveTroveAndToleratesStaleFeed() public {
        troveManager.setTrove(
            bob,
            1, // active
            0.1 ether, // 0.1 BTC
            2_000 ether, // 2,000 MUSD principal
            20 ether, // 20 MUSD accrued interest
            6_727 ether // maxBorrowingCapacity
        );

        assertEq(annex.liveBtcPrice(), INITIAL_BTC_PRICE);

        (
            uint8 status,
            uint256 coll,
            uint256 debt,
            uint256 icr,
            uint256 maxBorrow,
            uint256 mcr,
            uint256 btcPrice
        ) = annex.getUserTroveState(bob);

        assertEq(status, 1);
        assertEq(coll, 0.1 ether);
        assertEq(debt, 2_020 ether);
        assertEq(maxBorrow, 6_727 ether);
        assertEq(mcr, 1.1e18);
        assertEq(btcPrice, INITIAL_BTC_PRICE);
        assertEq(icr, (0.1 ether * INITIAL_BTC_PRICE) / 2_020 ether);

        // Stale PriceFeed degrades cleanly for UI inspection without reverting trove debt/coll view
        priceFeed.setStale(true);
        (status, coll, debt, icr, maxBorrow, mcr, btcPrice) = annex.getUserTroveState(bob);
        assertEq(status, 1);
        assertEq(coll, 0.1 ether);
        assertEq(debt, 2_020 ether);
        assertEq(btcPrice, 0);
        assertEq(icr, 0);
    }

    // ────────────────────────── Fuzz: Solvency & Fee Isolation ──────────────────────────

    function testFuzz_Wave2_FeeAndSolvencyInvariantPreserved(
        uint8[6] memory sides,
        uint96[6] memory amounts,
        uint256 finalBtcPrice
    ) public {
        finalBtcPrice = bound(finalBtcPrice, 1_000 ether, 500_000 ether);
        uint256 id = _createPrice(alice, 74_000 ether, true);
        address[3] memory traders = [alice, bob, carol];

        for (uint256 i = 0; i < 6; i++) {
            uint256 amount = bound(uint256(amounts[i]), 1e15, 2_000 ether);
            AnnexMarket.Outcome side = (sides[i] & 1) == 0 ? AnnexMarket.Outcome.Yes : AnnexMarket.Outcome.No;
            address trader = traders[i % 3];

            vm.prank(trader);
            annex.buyShares(id, side, amount);

            (, , uint256 totalColl, uint256 totalYes, uint256 totalNo, , ,) = annex.getMarketB(id);
            assertEq(totalColl, totalYes, "totalCollateral == totalYes");
            assertEq(totalColl, totalNo, "totalCollateral == totalNo");
            assertEq(
                musd.balanceOf(address(annex)),
                annex.totalLockedCollateral() + annex.accruedFees(),
                "global MUSD invariant"
            );
        }

        // Claim fees before resolution and verify zero collateral impact
        uint256 expectedFees = annex.accruedFees();
        if (expectedFees > 0) {
            annex.claimFees(treasury);
            assertEq(musd.balanceOf(treasury), expectedFees);
            assertEq(musd.balanceOf(address(annex)), annex.totalLockedCollateral());
        }

        // Settle via PriceFeed & drain every winning share + LP share
        vm.warp(block.timestamp + DAY);
        priceFeed.setPrice(finalBtcPrice);
        annex.resolvePriceMarket(id);

        for (uint256 t = 0; t < 3; t++) {
            vm.prank(traders[t]);
            try annex.redeem(id) {} catch {}
        }

        vm.prank(alice);
        annex.claimLp(id);

        assertEq(annex.totalLockedCollateral(), 0, "all market collateral must reconcile cleanly");
        assertEq(musd.balanceOf(address(annex)), 0, "contract balance must be 0 after claims");
    }
}
