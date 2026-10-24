// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {AnnexMarket} from "../src/AnnexMarket.sol";
import {MockMUSD} from "../src/MockMUSD.sol";
import {ReentrantMUSD} from "./mocks/ReentrantMUSD.sol";

contract AnnexMarketTest is Test {
    AnnexMarket internal annex;
    MockMUSD internal musd;

    address internal alice;
    address internal bob;
    address internal carol;

    uint256 internal constant LIQUIDITY = 1_000 ether;
    uint256 internal constant DAY = 1 days;
    uint256 internal constant ONE = 1e18;

    /// @dev Seed constant product of each market, captured at creation.
    mapping(uint256 => uint256) internal ks;

    function setUp() public {
        musd = new MockMUSD();
        annex = new AnnexMarket(address(musd));

        alice = makeAddr("alice");
        bob = makeAddr("bob");
        carol = makeAddr("carol");

        _fund(alice, 1_000_000 ether);
        _fund(bob, 1_000_000 ether);
        _fund(carol, 1_000_000 ether);
    }

    // ────────────────────────── helpers ──────────────────────────

    function _fund(address who, uint256 amount) internal {
        musd.mint(who, amount);
        vm.prank(who);
        musd.approve(address(annex), type(uint256).max);
    }

    function _create(address creator, uint256 liquidity) internal returns (uint256 id) {
        vm.prank(creator);
        id = annex.createMarket(
            "Will BTC close above 100k?",
            "Resolves YES if the daily close is above 100k USD.",
            "BTC Price",
            block.timestamp + DAY,
            liquidity
        );
        (uint256 reserveYes, uint256 reserveNo,,,,,,) = _market(id);
        ks[id] = reserveYes * reserveNo;
    }

    function _create() internal returns (uint256 id) {
        id = _create(alice, LIQUIDITY);
    }

    function _market(uint256 id)
        internal
        view
        returns (
            uint256 reserveYes,
            uint256 reserveNo,
            uint256 collateral,
            uint256 totalYes,
            uint256 totalNo,
            uint256 lpSupply,
            uint256 priceYes,
            uint256 priceNo
        )
    {
        (reserveYes, reserveNo, collateral, totalYes, totalNo, lpSupply, priceYes, priceNo) =
            annex.getMarketB(id);
    }

    /// @dev Core solvency + accounting invariants that must hold after every operation.
    function _assertInvariants(uint256 id) internal view {
        (uint256 reserveYes, uint256 reserveNo, uint256 collateral, uint256 totalYes, uint256 totalNo,, uint256 priceYes, uint256 priceNo) =
            _market(id);

        // 1. Solvency: the market can always pay out every winning share 1:1.
        assertGe(collateral, totalYes, "collateral < totalYes");
        assertGe(collateral, totalNo, "collateral < totalNo");

        // 2. Constant product is preserved (up to integer rounding dust).
        uint256 product = reserveYes * reserveNo;
        assertLe(product, ks[id], "k must not increase");
        assertLt(ks[id] - product, reserveNo, "rounding dust too large");

        // 3. Prices are complementary and inside (0, 1).
        assertLe(priceYes, ONE);
        assertLe(priceNo, ONE);
        assertApproxEqAbs(priceYes + priceNo, ONE, 2, "prices not complementary");

        // 4. Share supply accounting: user balances + pool reserves == total supply.
        uint256 userYes = annex.yesBalances(id, alice) + annex.yesBalances(id, bob)
            + annex.yesBalances(id, carol);
        uint256 userNo = annex.noBalances(id, alice) + annex.noBalances(id, bob)
            + annex.noBalances(id, carol);
        assertEq(userYes + reserveYes, totalYes, "YES supply mismatch");
        assertEq(userNo + reserveNo, totalNo, "NO supply mismatch");
    }

    /// @dev The marginal cost of one share must equal the quoted price, otherwise
    ///      the UI would advertise a price the protocol does not honour.
    function _assertQuoteMatchesPrice(uint256 id, AnnexMarket.Outcome outcome) internal view {
        uint256 probe = 1e15; // 0.001 MUSD
        uint256 quote = annex.getBuyQuote(id, outcome, probe);
        uint256 price = outcome == AnnexMarket.Outcome.Yes ? annex.getYesPrice(id) : annex.getNoPrice(id);
        assertGt(price, 0, "zero price");
        // marginal shares per MUSD = 1 / price
        uint256 expected = (probe * ONE) / price;
        assertApproxEqRel(quote, expected, 0.01e18, "quote does not match quoted price");
    }

    // ────────────────────────── create ──────────────────────────

    function test_CreateMarket_StoresState() public {
        uint256 endTime = block.timestamp + DAY;
        vm.prank(alice);
        uint256 id = annex.createMarket("Q?", "D", "Crypto", endTime, LIQUIDITY);
        ks[id] = LIQUIDITY * LIQUIDITY;

        assertEq(annex.marketCount(), 1);

        (
            string memory question,
            string memory description,
            string memory category,
            uint256 endTimeOut,
            address creator,
            address resolver,
            AnnexMarket.Outcome outcome,
            bool resolved
        ) = annex.getMarketA(id);

        assertEq(question, "Q?");
        assertEq(description, "D");
        assertEq(category, "Crypto");
        assertEq(endTimeOut, endTime);
        assertEq(creator, alice);
        assertEq(resolver, alice);
        assertEq(uint8(outcome), uint8(AnnexMarket.Outcome.None));
        assertFalse(resolved);

        (uint256 reserveYes, uint256 reserveNo, uint256 collateral, uint256 totalYes, uint256 totalNo, uint256 lpSupply,,) =
            _market(id);
        assertEq(reserveYes, LIQUIDITY);
        assertEq(reserveNo, LIQUIDITY);
        assertEq(collateral, LIQUIDITY);
        assertEq(totalYes, LIQUIDITY);
        assertEq(totalNo, LIQUIDITY);
        assertEq(lpSupply, LIQUIDITY);
        assertEq(annex.lpBalances(id, alice), LIQUIDITY);
        assertEq(musd.balanceOf(address(annex)), LIQUIDITY);

        _assertInvariants(id);
    }

    function test_CreateMarket_EmitsEvent() public {
        uint256 endTime = block.timestamp + DAY;
        vm.expectEmit(true, true, true, true);
        emit AnnexMarket.MarketCreated(0, alice, "Q?", "D", "Crypto", endTime, LIQUIDITY);
        vm.prank(alice);
        annex.createMarket("Q?", "D", "Crypto", endTime, LIQUIDITY);
    }

    function test_RevertWhen_CreateMarket_EmptyQuestion() public {
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.EmptyQuestion.selector);
        annex.createMarket("", "D", "Crypto", block.timestamp + DAY, LIQUIDITY);
    }

    function test_RevertWhen_CreateMarket_EndTimeInPast() public {
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.EndTimeInPast.selector);
        annex.createMarket("Q?", "D", "Crypto", block.timestamp - 1, LIQUIDITY);
    }

    function test_RevertWhen_CreateMarket_EndTimeIsNow() public {
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.EndTimeInPast.selector);
        annex.createMarket("Q?", "D", "Crypto", block.timestamp, LIQUIDITY);
    }

    function test_RevertWhen_CreateMarket_ZeroLiquidity() public {
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.ZeroLiquidity.selector);
        annex.createMarket("Q?", "D", "Crypto", block.timestamp + DAY, 0);
    }

    function test_RevertWhen_CreateMarket_NoAllowance() public {
        address dave = makeAddr("dave");
        musd.mint(dave, 100 ether);
        vm.prank(dave);
        vm.expectRevert("ERC20: insufficient allowance");
        annex.createMarket("Q?", "D", "Crypto", block.timestamp + DAY, LIQUIDITY);
    }

    function test_RevertWhen_CreateMarket_InsufficientBalance() public {
        address dave = makeAddr("dave");
        vm.prank(dave);
        musd.approve(address(annex), type(uint256).max);
        vm.prank(dave);
        vm.expectRevert("ERC20: insufficient balance");
        annex.createMarket("Q?", "D", "Crypto", block.timestamp + DAY, LIQUIDITY);
    }

    function test_CreateMarket_IdsAreSequential() public {
        uint256 a = _create(alice, LIQUIDITY);
        uint256 b = _create(bob, LIQUIDITY);
        assertEq(a, 0);
        assertEq(b, 1);
        assertEq(annex.marketCount(), 2);
    }

    // ────────────────────────── buy ──────────────────────────

    function test_BuyYes_UpdatesReservesAndBalances() public {
        uint256 id = _create();
        uint256 amount = 100 ether;

        uint256 quote = annex.getBuyQuote(id, AnnexMarket.Outcome.Yes, amount);

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, amount);

        assertEq(annex.yesBalances(id, bob), quote);
        assertEq(annex.noBalances(id, bob), 0);
        assertEq(musd.balanceOf(address(annex)), LIQUIDITY + amount);

        (uint256 reserveYes, uint256 reserveNo, uint256 collateral, uint256 totalYes, uint256 totalNo,,,) = _market(id);
        assertEq(reserveNo, LIQUIDITY + amount, "NO reserve must absorb the counter-collateral");
        assertLt(reserveYes, LIQUIDITY, "YES reserve must shrink");
        assertEq(collateral, LIQUIDITY + amount);
        assertEq(totalYes, LIQUIDITY + amount);
        assertEq(totalNo, LIQUIDITY + amount);

        _assertInvariants(id);
    }

    function test_BuyYes_RaisesYesPrice() public {
        uint256 id = _create();
        uint256 priceBefore = annex.getYesPrice(id);

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);

        assertGt(annex.getYesPrice(id), priceBefore, "YES price must rise");
        assertLt(annex.getNoPrice(id), ONE - priceBefore, "NO price must fall");
    }

    function test_BuyNo_LowersYesPrice() public {
        uint256 id = _create();
        uint256 priceBefore = annex.getYesPrice(id);

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.No, 100 ether);

        assertLt(annex.getYesPrice(id), priceBefore, "YES price must fall");
        assertGt(annex.getNoPrice(id), ONE - priceBefore, "NO price must rise");
    }

    function test_BuyYes_PreservesConstantProduct() public {
        uint256 id = _create();
        (uint256 reserveYes,,,,,,,) = _market(id);
        uint256 k = reserveYes * reserveYes; // seeded symmetric

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 250 ether);

        (uint256 newReserveYes, uint256 newReserveNo,,,,,,) = _market(id);
        assertLe(newReserveYes * newReserveNo, k, "k must not increase");
        assertLt(k - (newReserveYes * newReserveNo), newReserveNo, "rounding dust too large");
    }

    function test_Buy_QuoteMatchesQuotedPrice() public {
        uint256 id = _create();
        _assertQuoteMatchesPrice(id, AnnexMarket.Outcome.Yes);
        _assertQuoteMatchesPrice(id, AnnexMarket.Outcome.No);

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 300 ether);

        _assertQuoteMatchesPrice(id, AnnexMarket.Outcome.Yes);
        _assertQuoteMatchesPrice(id, AnnexMarket.Outcome.No);
    }

    function test_Buy_ExecutionPriceLiesBetweenPreAndPostPrice() public {
        uint256 id = _create();
        uint256 priceBefore = annex.getYesPrice(id);
        uint256 amount = 100 ether;

        uint256 quote = annex.getBuyQuote(id, AnnexMarket.Outcome.Yes, amount);
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, amount);
        uint256 priceAfter = annex.getYesPrice(id);

        uint256 avgPrice = (amount * ONE) / quote;
        assertGe(avgPrice, priceBefore, "avg price below pre-trade price");
        assertLe(avgPrice, priceAfter, "avg price above post-trade price");
    }

    function test_Buy_BuyerIsNeverSystematicallyShort() public {
        // Regression guard: at the pool's pre-trade price the buyer must not pay
        // more than the fair price of the shares received.
        uint256 id = _create();
        uint256 priceBefore = annex.getYesPrice(id); // 0.5e18

        uint256 amount = 100 ether;
        uint256 quote = annex.getBuyQuote(id, AnnexMarket.Outcome.Yes, amount);
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, amount);

        // Expected value of the position at the pre-trade price.
        uint256 expectedValue = (quote * priceBefore) / ONE;
        assertLe(expectedValue, amount, "buyer pays more than fair value");
        // ...and the shortfall is bounded by the pool's spread, not by a 2x factor.
        assertGt(expectedValue * 100, amount * 95, "buyer lost more than 5% to slippage");
    }

    function test_Buy_MultipleBuyers_Accumulate() public {
        uint256 id = _create();

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);
        vm.prank(carol);
        annex.buyShares(id, AnnexMarket.Outcome.No, 50 ether);
        vm.prank(alice);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 25 ether);

        assertGt(annex.yesBalances(id, bob), 0);
        assertGt(annex.noBalances(id, carol), 0);
        assertGt(annex.yesBalances(id, alice), 0);
        assertEq(musd.balanceOf(address(annex)), LIQUIDITY + 175 ether);

        _assertInvariants(id);
    }

    function test_Buy_EmitsEvent() public {
        uint256 id = _create();
        uint256 amount = 100 ether;
        uint256 quote = annex.getBuyQuote(id, AnnexMarket.Outcome.Yes, amount);

        vm.expectEmit(true, true, true, true);
        emit AnnexMarket.SharesBought(id, bob, AnnexMarket.Outcome.Yes, amount, quote);
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, amount);
    }

    function test_RevertWhen_Buy_ZeroAmount() public {
        uint256 id = _create();
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.ZeroAmount.selector);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 0);
    }

    function test_RevertWhen_Buy_InvalidOutcome() public {
        uint256 id = _create();
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.InvalidOutcome.selector);
        annex.buyShares(id, AnnexMarket.Outcome.None, 1 ether);
    }

    function test_RevertWhen_Buy_MarketNotFound() public {
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.MarketNotFound.selector);
        annex.buyShares(99, AnnexMarket.Outcome.Yes, 1 ether);
    }

    function test_RevertWhen_Buy_MarketEnded() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.MarketEnded.selector);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 1 ether);
    }

    function test_RevertWhen_Buy_AlreadyResolved() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.AlreadyResolved.selector);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 1 ether);
    }

    function test_RevertWhen_Buy_NoAllowance() public {
        uint256 id = _create();
        address dave = makeAddr("dave");
        musd.mint(dave, 100 ether);
        vm.prank(dave);
        vm.expectRevert("ERC20: insufficient allowance");
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 1 ether);
    }

    function test_Buy_MinimalLiquidityMarket() public {
        uint256 id = _create(alice, 1);
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 1 ether);
        _assertInvariants(id);
    }

    // ────────────────────────── resolve ──────────────────────────

    function test_Resolve_ByResolver() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.No);

        (, , , , , , AnnexMarket.Outcome outcome, bool resolved) = annex.getMarketA(id);
        assertTrue(resolved);
        assertEq(uint8(outcome), uint8(AnnexMarket.Outcome.No));
    }

    function test_Resolve_ByOwner() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        annex.resolve(id, AnnexMarket.Outcome.Yes); // annex owner is this test contract
        (, , , , , , , bool resolved) = annex.getMarketA(id);
        assertTrue(resolved);
    }

    function test_Resolve_ByDesignatedResolver() public {
        uint256 id = _create();
        vm.prank(alice);
        annex.setResolver(id, carol);
        vm.warp(block.timestamp + DAY);
        vm.prank(carol);
        annex.resolve(id, AnnexMarket.Outcome.Yes);
        (, , , , , , , bool resolved) = annex.getMarketA(id);
        assertTrue(resolved);
    }

    function test_RevertWhen_Resolve_NotAuthorized() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.NotAuthorized.selector);
        annex.resolve(id, AnnexMarket.Outcome.Yes);
    }

    function test_RevertWhen_Resolve_NotEndedYet() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.NotEndedYet.selector);
        annex.resolve(id, AnnexMarket.Outcome.Yes);
    }

    function test_Resolve_OwnerMayResolveEarly() public {
        uint256 id = _create();
        annex.resolve(id, AnnexMarket.Outcome.Yes); // owner bypasses the end-time check
        (, , , , , , , bool resolved) = annex.getMarketA(id);
        assertTrue(resolved);
    }

    function test_RevertWhen_Resolve_Twice() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.AlreadyResolved.selector);
        annex.resolve(id, AnnexMarket.Outcome.No);
    }

    function test_RevertWhen_Resolve_InvalidOutcome() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.InvalidOutcome.selector);
        annex.resolve(id, AnnexMarket.Outcome.None);
    }

    function test_RevertWhen_Resolve_MarketNotFound() public {
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.MarketNotFound.selector);
        annex.resolve(99, AnnexMarket.Outcome.Yes);
    }

    function test_SetResolver() public {
        uint256 id = _create();
        vm.prank(alice);
        annex.setResolver(id, bob);
        (,,,,, address resolver,,) = annex.getMarketA(id);
        assertEq(resolver, bob);

        vm.prank(carol);
        vm.expectRevert(AnnexMarket.NotAuthorized.selector);
        annex.setResolver(id, carol);

        // protocol owner may override
        annex.setResolver(id, carol);
        (,,,,, address resolver2,,) = annex.getMarketA(id);
        assertEq(resolver2, carol);
    }

    function test_TransferOwnership() public {
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.NotAuthorized.selector);
        annex.transferOwnership(bob);

        annex.transferOwnership(bob);
        assertEq(annex.owner(), bob);
    }

    // ────────────────────────── redeem ──────────────────────────

    function test_Redeem_PaysOneToOne() public {
        uint256 id = _create();
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);
        uint256 shares = annex.yesBalances(id, bob);

        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);

        uint256 before = musd.balanceOf(bob);
        vm.prank(bob);
        annex.redeem(id);

        assertEq(musd.balanceOf(bob) - before, shares, "redeem must pay 1:1");
        assertEq(annex.yesBalances(id, bob), 0, "balance must be zeroed");
    }

    function test_RevertWhen_Redeem_LosingSide() public {
        uint256 id = _create();
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);

        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.No);

        vm.prank(bob);
        vm.expectRevert(AnnexMarket.NoWinningShares.selector);
        annex.redeem(id);
    }

    function test_RevertWhen_Redeem_NotResolved() public {
        uint256 id = _create();
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.MarketNotResolved.selector);
        annex.redeem(id);
    }

    function test_RevertWhen_Redeem_NoShares() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);
        vm.prank(bob);
        vm.expectRevert(AnnexMarket.NoWinningShares.selector);
        annex.redeem(id);
    }

    function test_Redeem_EmitsEvent() public {
        uint256 id = _create();
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);
        uint256 shares = annex.yesBalances(id, bob);

        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);

        vm.expectEmit(true, true, true, true);
        emit AnnexMarket.Redeemed(id, bob, shares);
        vm.prank(bob);
        annex.redeem(id);
    }

    // ────────────────────────── lp claim ──────────────────────────

    function test_ClaimLp_PaysPoolValueAndZeroesBalance() public {
        uint256 id = _create();
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);

        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);

        (uint256 reserveYes,, uint256 collateral, uint256 totalYes,,,,) = _market(id);
        uint256 expectedPayout = reserveYes + (collateral - totalYes);

        uint256 before = musd.balanceOf(alice);
        vm.prank(alice);
        annex.claimLp(id);

        assertEq(annex.lpBalances(id, alice), 0, "LP balance must be zeroed");
        assertEq(musd.balanceOf(alice) - before, expectedPayout, "LP takes the whole pool value");
    }

    function test_ClaimLp_RevertsWithoutLpShares() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);

        vm.prank(bob);
        vm.expectRevert(AnnexMarket.NoLpShares.selector);
        annex.claimLp(id);
    }

    function test_RevertWhen_ClaimLp_NotResolved() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.MarketNotResolved.selector);
        annex.claimLp(id);
    }

    function test_RevertWhen_ClaimLp_Twice() public {
        uint256 id = _create();
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);
        vm.prank(alice);
        annex.claimLp(id);
        vm.prank(alice);
        vm.expectRevert(AnnexMarket.NoLpShares.selector);
        annex.claimLp(id);
    }

    // ────────────────────────── lifecycle ──────────────────────────

    function test_FullLifecycle_YesWins() public {
        uint256 id = _create();

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);
        vm.prank(carol);
        annex.buyShares(id, AnnexMarket.Outcome.No, 50 ether);

        uint256 bobShares = annex.yesBalances(id, bob);
        uint256 carolNoShares = annex.noBalances(id, carol);

        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);

        uint256 bobBefore = musd.balanceOf(bob);
        vm.prank(bob);
        annex.redeem(id);
        assertEq(musd.balanceOf(bob) - bobBefore, bobShares);

        // carol lost: her NO shares are worthless
        vm.prank(carol);
        vm.expectRevert(AnnexMarket.NoWinningShares.selector);
        annex.redeem(id);

        uint256 lpBefore = musd.balanceOf(alice);
        vm.prank(alice);
        annex.claimLp(id);
        uint256 lpPayout = musd.balanceOf(alice) - lpBefore;

        // everything is distributed, nothing stranded
        assertEq(musd.balanceOf(address(annex)), 0, "collateral stranded");
        assertEq(bobShares + lpPayout, LIQUIDITY + 150 ether, "conservation");
    }

    function test_FullLifecycle_NoWins() public {
        uint256 id = _create();

        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);
        vm.prank(carol);
        annex.buyShares(id, AnnexMarket.Outcome.No, 50 ether);

        uint256 bobShares = annex.yesBalances(id, bob);
        uint256 carolNoShares = annex.noBalances(id, carol);

        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.No);

        uint256 carolBefore = musd.balanceOf(carol);
        vm.prank(carol);
        annex.redeem(id);
        assertEq(musd.balanceOf(carol) - carolBefore, carolNoShares);

        vm.prank(bob);
        vm.expectRevert(AnnexMarket.NoWinningShares.selector);
        annex.redeem(id);

        uint256 lpBefore = musd.balanceOf(alice);
        vm.prank(alice);
        annex.claimLp(id);
        uint256 lpPayout = musd.balanceOf(alice) - lpBefore;

        assertEq(musd.balanceOf(address(annex)), 0, "collateral stranded");
        assertEq(carolNoShares + lpPayout, LIQUIDITY + 150 ether, "conservation");
        assertGt(bobShares, 0);
    }

    function test_ResolutionPaysExactlyTotalCollateral() public {
        uint256 id = _create();
        vm.prank(bob);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 100 ether);
        vm.prank(carol);
        annex.buyShares(id, AnnexMarket.Outcome.Yes, 250 ether);

        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);

        uint256 paid = 0;
        address[3] memory actors = [alice, bob, carol];
        for (uint256 i = 0; i < actors.length; i++) {
            uint256 before = musd.balanceOf(actors[i]);
            if (annex.yesBalances(id, actors[i]) > 0) {
                vm.prank(actors[i]);
                annex.redeem(id);
            }
            if (annex.lpBalances(id, actors[i]) > 0) {
                vm.prank(actors[i]);
                annex.claimLp(id);
            }
            paid += musd.balanceOf(actors[i]) - before;
        }
        assertEq(paid, LIQUIDITY + 350 ether, "all collateral must be paid out");
        assertEq(musd.balanceOf(address(annex)), 0);
    }

    // ────────────────────────── reentrancy ──────────────────────────

    function test_ReentrancyGuard_BlocksNestedBuy() public {
        ReentrantMUSD token = new ReentrantMUSD();
        AnnexMarket market = new AnnexMarket(address(token));
        token.setTarget(address(market));
        token.setMarketId(0);

        token.mint(alice, 1_000 ether);
        vm.prank(alice);
        token.approve(address(market), type(uint256).max);
        vm.prank(alice);
        market.createMarket("Q?", "D", "Crypto", block.timestamp + DAY, 100 ether);

        token.arm();
        vm.prank(alice);
        market.buyShares(0, AnnexMarket.Outcome.Yes, 10 ether);

        assertTrue(token.blocked(), "nested buyShares should have been blocked");
        assertEq(bytes4(token.lastError()), AnnexMarket.ReentrantCall.selector);
        // the outer call still completed normally
        assertGt(market.yesBalances(0, alice), 0);
    }

    // ────────────────────────── fuzz ──────────────────────────

    function testFuzz_SolvencyAndConservationPreserved(
        uint8[6] calldata outcomeSeed,
        uint96[6] calldata amountSeed
    ) public {
        uint256 id = _create();
        address[3] memory actors = [alice, bob, carol];
        uint256 spent = 0;

        for (uint256 i = 0; i < 6; i++) {
            uint256 amount = (uint256(amountSeed[i]) % 5_000) + 1;
            AnnexMarket.Outcome outcome =
                outcomeSeed[i] % 2 == 0 ? AnnexMarket.Outcome.Yes : AnnexMarket.Outcome.No;
            address who = actors[i % actors.length];

            vm.prank(who);
            annex.buyShares(id, outcome, amount);
            spent += amount;
            _assertInvariants(id);
        }

        // Resolve and let everyone cash out — the market must be exactly solvent.
        vm.warp(block.timestamp + DAY);
        vm.prank(alice);
        annex.resolve(id, AnnexMarket.Outcome.Yes);

        uint256 paid = 0;
        for (uint256 i = 0; i < actors.length; i++) {
            uint256 before = musd.balanceOf(actors[i]);
            if (annex.yesBalances(id, actors[i]) > 0) {
                vm.prank(actors[i]);
                annex.redeem(id);
            }
            if (annex.lpBalances(id, actors[i]) > 0) {
                vm.prank(actors[i]);
                annex.claimLp(id);
            }
            paid += musd.balanceOf(actors[i]) - before;
        }
        assertEq(paid, LIQUIDITY + spent, "conservation");
        assertEq(musd.balanceOf(address(annex)), 0, "collateral stranded");
    }

    function testFuzz_QuoteAlwaysMatchesPrice(uint128 amountSeed) public {
        uint256 id = _create();
        uint256 amount = (uint256(amountSeed) % 10_000) + 1;

        uint256 quote = annex.getBuyQuote(id, AnnexMarket.Outcome.Yes, amount);
        uint256 price = annex.getYesPrice(id);
        // effective price of the position must never be below the quoted price
        uint256 effective = (amount * ONE) / quote;
        assertGe(effective, price - 1, "executed below quoted price");
    }
}
