// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./IERC20.sol";

interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}

interface ITroveManager {
    function getTroveStatus(address _borrower) external view returns (uint8);
    function getEntireDebtAndColl(address _borrower)
        external
        view
        returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        );
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
    function getTroveMaxBorrowingCapacity(address _borrower) external view returns (uint256);
    function MCR() external view returns (uint256);
}

/// @title AnnexMarket
/// @notice Permissionless binary prediction markets settled in MUSD on Mezo.
///         Each market uses a constant-product AMM (x*y=k) between YES and NO
///         outcome shares, in the classic conditional-token style.
///
///         Trade mechanics: after a disclosed entry protocol fee (`feeBps`, paid in
///         MUSD and tracked separately in `accruedFees`), the net deposit `a` is
///         split into a complete set (`a` YES + `a` NO). The counter-side half is
///         handed to the pool as counter-collateral, which releases shares of the
///         desired side to the buyer while preserving k. The buyer keeps the
///         desired half of the split, ending long `(a + swapOut)` shares.
///
///         Solvency invariants (exact at all times):
///             per-market: totalCollateral == totalYes == totalNo
///             global:     musd.balanceOf(address(this)) >= totalLockedCollateral + accruedFees
///         Every winning share redeems strictly 1:1 for MUSD with zero exit fee.
///
///         Resolution paths are strictly separated:
///           - MarketKind.Manual: subjective events resolved by designated resolver or owner.
///           - MarketKind.PriceFeed: objective BTC/USD markets settled permissionlessly
///             at or after `endTime` from Mezo's canonical PriceFeed oracle with no
///             manual or admin override.
contract AnnexMarket {
    // ────────────────────────── Types ──────────────────────────

    enum Outcome {
        None, // 0 — unresolved
        Yes, // 1
        No // 2
    }

    enum MarketKind {
        Manual, // 0 — resolved by creator/designated resolver or owner
        PriceFeed // 1 — permissionlessly resolved via Mezo BTC/USD PriceFeed
    }

    struct Market {
        string question;
        string description;
        string category;
        uint256 endTime;
        address creator;
        address resolver;
        // AMM reserves (shares sitting in the pool)
        uint256 reserveYes;
        uint256 reserveNo;
        uint256 k; // invariant product reserveYes * reserveNo
        // Totals across AMM + user balances
        uint256 totalYes; // total YES shares in existence
        uint256 totalNo; // total NO shares in existence
        uint256 totalCollateral; // total net MUSD collateral assigned to this market
        // LP
        uint256 lpTotalSupply;
        // Resolution
        Outcome outcome;
        bool resolved;
    }

    struct PriceMarketConfig {
        MarketKind kind;
        uint256 strikePrice; // 18-decimal USD strike price from Mezo PriceFeed
        bool resolveAbove; // true: YES if price >= strikePrice; false: YES if price < strikePrice
        uint256 resolvedPrice; // recorded oracle price at settlement
    }

    // ────────────────────────── Constants & Storage ──────────────────────────

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 200; // hard cap: 2.00%

    IERC20 public immutable musd;
    IPriceFeed public immutable priceFeed;
    ITroveManager public immutable troveManager;
    uint256 public immutable feeBps;
    address public owner;

    uint256 public nextMarketId;
    mapping(uint256 => Market) private markets;
    mapping(uint256 => PriceMarketConfig) private priceMarkets;

    // marketId => user => shares
    mapping(uint256 => mapping(address => uint256)) public yesBalances;
    mapping(uint256 => mapping(address => uint256)) public noBalances;
    mapping(uint256 => mapping(address => uint256)) public lpBalances;

    // Separate global accounting between redeemable market collateral and protocol fees
    uint256 public totalLockedCollateral;
    uint256 public accruedFees;

    uint256 internal _locked = 1;

    // ────────────────────────── Events ──────────────────────────

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        string description,
        string category,
        uint256 endTime,
        uint256 initialLiquidity
    );
    event PriceMarketCreated(uint256 indexed marketId, uint256 strikePrice, bool resolveAbove);
    event SharesBought(
        uint256 indexed marketId,
        address indexed buyer,
        Outcome outcome,
        uint256 musdIn,
        uint256 sharesOut
    );
    event ProtocolFeeCollected(
        uint256 indexed marketId,
        address indexed buyer,
        uint256 grossAmount,
        uint256 fee,
        uint256 netAmount
    );
    event MarketResolved(uint256 indexed marketId, Outcome outcome, address indexed resolver);
    event PriceMarketResolved(
        uint256 indexed marketId,
        Outcome outcome,
        uint256 resolvedPrice,
        address indexed caller
    );
    event Redeemed(uint256 indexed marketId, address indexed user, uint256 amount);
    event LpClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event FeesClaimed(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ────────────────────────── Errors ──────────────────────────

    error EmptyQuestion();
    error EndTimeInPast();
    error ZeroLiquidity();
    error ZeroAmount();
    error ZeroAddress();
    error FeeTooHigh();
    error PriceFeedNotConfigured();
    error InvalidStrikePrice();
    error NotPriceFeedMarket();
    error PriceFeedMarketOnly();
    error NoAccruedFees();
    error MarketEnded();
    error MarketNotResolved();
    error AlreadyResolved();
    error NotAuthorized();
    error NotEndedYet();
    error InvalidOutcome();
    error ZeroOutput();
    error NoWinningShares();
    error NoLpShares();
    error MarketNotFound();
    error ReentrantCall();

    // ────────────────────────── Modifier ──────────────────────────

    modifier nonReentrant() {
        if (_locked != 1) revert ReentrantCall();
        _locked = 2;
        _;
        _locked = 1;
    }

    // ────────────────────────── Constructor ──────────────────────────

    constructor(address _musd, address _priceFeed, address _troveManager, uint256 _feeBps) {
        if (_musd == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        musd = IERC20(_musd);
        priceFeed = IPriceFeed(_priceFeed);
        troveManager = ITroveManager(_troveManager);
        feeBps = _feeBps;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ────────────────────────── Admin ──────────────────────────

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert NotAuthorized();
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setResolver(uint256 marketId, address resolver) external {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
        if (priceMarkets[marketId].kind == MarketKind.PriceFeed) revert PriceFeedMarketOnly();
        if (msg.sender != m.creator && msg.sender != owner) revert NotAuthorized();
        m.resolver = resolver;
    }

    /// @notice Withdraw accumulated protocol fees without ever touching market collateral.
    /// @param to Recipient address for claimed fees.
    function claimFees(address to) external nonReentrant {
        if (msg.sender != owner) revert NotAuthorized();
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = accruedFees;
        if (amount == 0) revert NoAccruedFees();
        accruedFees = 0;
        if (!musd.transfer(to, amount)) {
            revert();
        }
        emit FeesClaimed(to, amount);
    }

    // ────────────────────────── Core: Create ──────────────────────────

    /// @notice Create a subjective binary prediction market resolved by creator/resolver/owner.
    /// @param question          Short yes/no question
    /// @param description       Longer description with resolution criteria
    /// @param category          "Mezo", "Crypto", "BTC Price", or "Other"
    /// @param endTime           Unix timestamp after which the market can be resolved
    /// @param initialLiquidity  MUSD (1e18 = 1 MUSD) used to seed equal YES/NO reserves
    /// @return marketId         ID of the newly created market
    function createMarket(
        string calldata question,
        string calldata description,
        string calldata category,
        uint256 endTime,
        uint256 initialLiquidity
    ) external nonReentrant returns (uint256 marketId) {
        marketId = _initMarket(question, description, category, endTime, initialLiquidity, msg.sender);
    }

    /// @notice Create an objective BTC/USD price market resolved permissionlessly by Mezo PriceFeed.
    /// @param question          Short yes/no question (e.g. "BTC >= $80,000 at expiry?")
    /// @param description       Longer description with strike and oracle details
    /// @param endTime           Unix timestamp at/after which anyone can call resolvePriceMarket
    /// @param initialLiquidity  MUSD (1e18 = 1 MUSD) used to seed equal YES/NO reserves
    /// @param strikePrice       Target BTC/USD price scaled to 1e18
    /// @param resolveAbove      True: YES if PriceFeed >= strikePrice; False: YES if PriceFeed < strikePrice
    /// @return marketId         ID of the newly created oracle-resolved market
    function createPriceMarket(
        string calldata question,
        string calldata description,
        uint256 endTime,
        uint256 initialLiquidity,
        uint256 strikePrice,
        bool resolveAbove
    ) external nonReentrant returns (uint256 marketId) {
        if (address(priceFeed) == address(0)) revert PriceFeedNotConfigured();
        if (strikePrice == 0) revert InvalidStrikePrice();

        marketId = _initMarket(
            question,
            description,
            "BTC Price",
            endTime,
            initialLiquidity,
            address(priceFeed)
        );
        priceMarkets[marketId] = PriceMarketConfig({
            kind: MarketKind.PriceFeed,
            strikePrice: strikePrice,
            resolveAbove: resolveAbove,
            resolvedPrice: 0
        });
        emit PriceMarketCreated(marketId, strikePrice, resolveAbove);
    }

    function _initMarket(
        string calldata question,
        string calldata description,
        string memory category,
        uint256 endTime,
        uint256 initialLiquidity,
        address resolver
    ) internal returns (uint256 marketId) {
        if (bytes(question).length == 0) revert EmptyQuestion();
        if (endTime <= block.timestamp) revert EndTimeInPast();
        if (initialLiquidity == 0) revert ZeroLiquidity();

        marketId = nextMarketId++;
        Market storage m = markets[marketId];
        m.question = question;
        m.description = description;
        m.category = category;
        m.endTime = endTime;
        m.creator = msg.sender;
        m.resolver = resolver;

        // Pull initial liquidity from creator
        if (!musd.transferFrom(msg.sender, address(this), initialLiquidity)) {
            revert();
        }

        // Seed AMM: mint equal YES + NO shares into reserves.
        // One YES + one NO is always backed by exactly 1 MUSD (the pair collateral).
        m.reserveYes = initialLiquidity;
        m.reserveNo = initialLiquidity;
        m.k = initialLiquidity * initialLiquidity;
        m.totalYes = initialLiquidity;
        m.totalNo = initialLiquidity;
        m.totalCollateral = initialLiquidity;
        totalLockedCollateral += initialLiquidity;

        // LP shares = initial liquidity, all to creator
        m.lpTotalSupply = initialLiquidity;
        lpBalances[marketId][msg.sender] = initialLiquidity;

        emit MarketCreated(marketId, msg.sender, question, description, category, endTime, initialLiquidity);
    }

    // ────────────────────────── Core: Buy ──────────────────────────

    /// @notice Buy YES or NO shares with MUSD via the constant-product AMM.
    /// @dev    After taking the disclosed entry protocol fee (`feeBps`), the net deposit
    ///         is split into a complete set; the opposite half seeds the pool as
    ///         counter-collateral and the pool releases the desired side. The buyer keeps
    ///         the desired-side half of the split, so net deposit `a` yields `a + swapOut`.
    /// @param marketId   Market to trade on
    /// @param outcome    Outcome.Yes or Outcome.No
    /// @param musdAmount Gross MUSD sent by buyer (1e18 = 1 MUSD)
    function buyShares(uint256 marketId, Outcome outcome, uint256 musdAmount)
        external
        nonReentrant
    {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
        if (m.resolved) revert AlreadyResolved();
        if (musdAmount == 0) revert ZeroAmount();
        if (block.timestamp >= m.endTime) revert MarketEnded();
        if (outcome != Outcome.Yes && outcome != Outcome.No) revert InvalidOutcome();

        (uint256 fee, uint256 netAmount) = _splitFee(musdAmount);
        if (netAmount == 0) revert ZeroAmount();

        // Pull gross MUSD from buyer, isolating protocol fee from pool collateral
        if (!musd.transferFrom(msg.sender, address(this), musdAmount)) {
            revert();
        }
        accruedFees += fee;
        m.totalCollateral += netAmount;
        totalLockedCollateral += netAmount;

        uint256 sharesOut;
        if (outcome == Outcome.Yes) {
            uint256 newReserveYes;
            uint256 newReserveNo;
            (sharesOut, newReserveYes, newReserveNo) = _quoteNetShares(
                m.reserveYes,
                m.reserveNo,
                m.k,
                netAmount
            );
            if (sharesOut == 0) revert ZeroOutput();
            m.reserveYes = newReserveYes;
            m.reserveNo = newReserveNo;
            m.totalYes += netAmount;
            m.totalNo += netAmount;
            yesBalances[marketId][msg.sender] += sharesOut;
        } else {
            uint256 newReserveNo;
            uint256 newReserveYes;
            (sharesOut, newReserveNo, newReserveYes) = _quoteNetShares(
                m.reserveNo,
                m.reserveYes,
                m.k,
                netAmount
            );
            if (sharesOut == 0) revert ZeroOutput();
            m.reserveNo = newReserveNo;
            m.reserveYes = newReserveYes;
            m.totalYes += netAmount;
            m.totalNo += netAmount;
            noBalances[marketId][msg.sender] += sharesOut;
        }

        emit SharesBought(marketId, msg.sender, outcome, musdAmount, sharesOut);
        if (fee > 0) {
            emit ProtocolFeeCollected(marketId, msg.sender, musdAmount, fee, netAmount);
        }
    }

    function _splitFee(uint256 grossAmount) internal view returns (uint256 fee, uint256 netAmount) {
        fee = (grossAmount * feeBps) / BPS_DENOMINATOR;
        netAmount = grossAmount - fee;
    }

    function _quoteNetShares(
        uint256 reserveDesired,
        uint256 reserveOpposite,
        uint256 k,
        uint256 netAmount
    ) internal pure returns (uint256 sharesOut, uint256 newReserveDesired, uint256 newReserveOpposite) {
        newReserveOpposite = reserveOpposite + netAmount;
        newReserveDesired = k / newReserveOpposite;
        sharesOut = netAmount + (reserveDesired - newReserveDesired);
    }

    // ────────────────────────── Core: Resolve ──────────────────────────

    /// @notice Resolve a manual market after its end time has passed (owner may resolve early).
    ///         Reverts for PriceFeed markets so subjective resolvers cannot override the oracle.
    /// @param marketId  Market to resolve
    /// @param outcome   Outcome.Yes or Outcome.No
    function resolve(uint256 marketId, Outcome outcome) external {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
        if (priceMarkets[marketId].kind == MarketKind.PriceFeed) revert PriceFeedMarketOnly();
        if (m.resolved) revert AlreadyResolved();
        if (msg.sender != m.resolver && msg.sender != owner) revert NotAuthorized();
        if (block.timestamp < m.endTime && msg.sender != owner) revert NotEndedYet();
        if (outcome != Outcome.Yes && outcome != Outcome.No) revert InvalidOutcome();

        m.outcome = outcome;
        m.resolved = true;
        emit MarketResolved(marketId, outcome, msg.sender);
    }

    /// @notice Permissionlessly resolve a BTC/USD PriceFeed market at or after its expiry.
    /// @param marketId  PriceFeed market to settle using Mezo's live PriceFeed oracle
    function resolvePriceMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
        PriceMarketConfig storage cfg = priceMarkets[marketId];
        if (cfg.kind != MarketKind.PriceFeed) revert NotPriceFeedMarket();
        if (m.resolved) revert AlreadyResolved();
        if (block.timestamp < m.endTime) revert NotEndedYet();
        if (address(priceFeed) == address(0)) revert PriceFeedNotConfigured();

        uint256 currentPrice = priceFeed.fetchPrice();
        bool isYes = cfg.resolveAbove
            ? currentPrice >= cfg.strikePrice
            : currentPrice < cfg.strikePrice;
        Outcome winningOutcome = isYes ? Outcome.Yes : Outcome.No;

        cfg.resolvedPrice = currentPrice;
        m.outcome = winningOutcome;
        m.resolved = true;

        emit MarketResolved(marketId, winningOutcome, msg.sender);
        emit PriceMarketResolved(marketId, winningOutcome, currentPrice, msg.sender);
    }

    // ────────────────────────── Core: Redeem ──────────────────────────

    /// @notice Redeem winning shares for MUSD (1:1, zero exit fee) after the market is resolved.
    /// @param marketId  Market to redeem from
    function redeem(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
        if (!m.resolved) revert MarketNotResolved();

        uint256 winningShares;
        if (m.outcome == Outcome.Yes) {
            winningShares = yesBalances[marketId][msg.sender];
            yesBalances[marketId][msg.sender] = 0;
        } else {
            winningShares = noBalances[marketId][msg.sender];
            noBalances[marketId][msg.sender] = 0;
        }
        if (winningShares == 0) revert NoWinningShares();

        totalLockedCollateral -= winningShares;
        if (!musd.transfer(msg.sender, winningShares)) {
            revert();
        }
        emit Redeemed(marketId, msg.sender, winningShares);
    }

    // ────────────────────────── Core: LP Claim ──────────────────────────

    /// @notice After resolution, LPs claim their share of the AMM's value (zero exit fee).
    ///         LP value = winning reserve shares + surplus (backing for worthless losing shares).
    /// @param marketId  Market to claim LP proceeds from
    function claimLp(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
        if (!m.resolved) revert MarketNotResolved();

        uint256 lpShares = lpBalances[marketId][msg.sender];
        if (lpShares == 0) revert NoLpShares();
        lpBalances[marketId][msg.sender] = 0;

        // Winning reserve (shares in AMM on the winning side — each worth 1 MUSD)
        uint256 winningReserve =
            m.outcome == Outcome.Yes ? m.reserveYes : m.reserveNo;

        // Surplus = collateral - total winning shares (backing for now-worthless losing shares)
        uint256 totalWinning = m.outcome == Outcome.Yes ? m.totalYes : m.totalNo;
        // totalCollateral >= totalWinning by invariant — safe subtraction
        uint256 surplus = m.totalCollateral - totalWinning;
        uint256 totalLpValue = winningReserve + surplus;
        uint256 payout = (lpShares * totalLpValue) / m.lpTotalSupply;

        if (payout > 0) {
            totalLockedCollateral -= payout;
            if (!musd.transfer(msg.sender, payout)) {
                revert();
            }
        }
        emit LpClaimed(marketId, msg.sender, payout);
    }

    // ────────────────────────── Views ──────────────────────────

    /// @notice Marginal price of YES in MUSD (1e18 = 1.0 MUSD).
    ///         Derived from the AMM reserves: priceYes = reserveNo / (reserveYes + reserveNo).
    function getYesPrice(uint256 marketId) public view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 sum = m.reserveYes + m.reserveNo;
        if (sum == 0) return 0;
        return (m.reserveNo * 1e18) / sum;
    }

    /// @notice Marginal price of NO in MUSD (1e18 = 1.0 MUSD).
    function getNoPrice(uint256 marketId) public view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 sum = m.reserveYes + m.reserveNo;
        if (sum == 0) return 0;
        return (m.reserveYes * 1e18) / sum;
    }

    /// @notice Preview shares received, entry protocol fee, and net pool collateral for a trade.
    ///         Every share returned is backed 1:1 and redeems for 1.00 MUSD on win (zero exit fee).
    function getBuyQuoteWithFee(uint256 marketId, Outcome outcome, uint256 musdAmount)
        public
        view
        returns (uint256 sharesOut, uint256 fee, uint256 netAmount)
    {
        Market storage m = markets[marketId];
        if (m.creator == address(0) || musdAmount == 0) return (0, 0, 0);
        if (outcome != Outcome.Yes && outcome != Outcome.No) return (0, 0, 0);

        (fee, netAmount) = _splitFee(musdAmount);
        if (netAmount == 0) return (0, fee, 0);

        if (outcome == Outcome.Yes) {
            (sharesOut,,) = _quoteNetShares(m.reserveYes, m.reserveNo, m.k, netAmount);
        } else {
            (sharesOut,,) = _quoteNetShares(m.reserveNo, m.reserveYes, m.k, netAmount);
        }
    }

    /// @notice Preview how many net shares you receive for a gross MUSD amount after fee.
    function getBuyQuote(uint256 marketId, Outcome outcome, uint256 musdAmount)
        external
        view
        returns (uint256 sharesOut)
    {
        (sharesOut,,) = getBuyQuoteWithFee(marketId, outcome, musdAmount);
    }

    /// @notice Oracle configuration and settlement price for a market.
    function getPriceMarket(uint256 marketId)
        external
        view
        returns (MarketKind kind, uint256 strikePrice, bool resolveAbove, uint256 resolvedPrice)
    {
        PriceMarketConfig storage cfg = priceMarkets[marketId];
        return (cfg.kind, cfg.strikePrice, cfg.resolveAbove, cfg.resolvedPrice);
    }

    /// @notice Live BTC/USD price (18 decimals) from Mezo's canonical PriceFeed.
    function liveBtcPrice() external view returns (uint256) {
        if (address(priceFeed) == address(0)) revert PriceFeedNotConfigured();
        return priceFeed.fetchPrice();
    }

    /// @notice Read a user's live Mezo Trove state from TroveManager + PriceFeed.
    /// @dev    Safely tolerates stale PriceFeed reads for UI display (icr = 0, btcPrice = 0).
    function getUserTroveState(address user)
        external
        view
        returns (
            uint8 status,
            uint256 coll,
            uint256 debt,
            uint256 icr,
            uint256 maxBorrowingCapacity,
            uint256 mcr,
            uint256 btcPrice
        )
    {
        if (address(priceFeed) != address(0)) {
            try priceFeed.fetchPrice() returns (uint256 p) {
                btcPrice = p;
            } catch {}
        }

        if (address(troveManager) != address(0)) {
            status = troveManager.getTroveStatus(user);
            (uint256 _coll, uint256 _principal, uint256 _interest,,,) =
                troveManager.getEntireDebtAndColl(user);
            coll = _coll;
            debt = _principal + _interest;
            maxBorrowingCapacity = troveManager.getTroveMaxBorrowingCapacity(user);
            mcr = troveManager.MCR();
            if (status == 1 && btcPrice > 0 && debt > 0) {
                icr = troveManager.getCurrentICR(user, btcPrice);
            }
        }
    }

    /// @notice Full market info — split into two calls to avoid stack-too-deep.
    function getMarketA(uint256 marketId)
        external
        view
        returns (
            string memory question,
            string memory description,
            string memory category,
            uint256 endTime,
            address creator,
            address resolver,
            Outcome outcome,
            bool resolved
        )
    {
        Market storage m = markets[marketId];
        return (
            m.question,
            m.description,
            m.category,
            m.endTime,
            m.creator,
            m.resolver,
            m.outcome,
            m.resolved
        );
    }

    function getMarketB(uint256 marketId)
        external
        view
        returns (
            uint256 reserveYes,
            uint256 reserveNo,
            uint256 totalCollateral,
            uint256 totalYes,
            uint256 totalNo,
            uint256 lpTotalSupply,
            uint256 yesPrice,
            uint256 noPrice
        )
    {
        Market storage m = markets[marketId];
        return (
            m.reserveYes,
            m.reserveNo,
            m.totalCollateral,
            m.totalYes,
            m.totalNo,
            m.lpTotalSupply,
            getYesPrice(marketId),
            getNoPrice(marketId)
        );
    }

    /// @notice A user's position in a market (YES shares, NO shares, LP shares).
    function getUserPosition(uint256 marketId, address user)
        external
        view
        returns (uint256 yesShares, uint256 noShares, uint256 lpShares)
    {
        return (yesBalances[marketId][user], noBalances[marketId][user], lpBalances[marketId][user]);
    }

    /// @notice Total number of markets created so far.
    function marketCount() external view returns (uint256) {
        return nextMarketId;
    }
}
