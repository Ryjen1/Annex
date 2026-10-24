// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./IERC20.sol";

/// @title AnnexMarket
/// @notice Permissionless binary prediction markets settled in MUSD on Mezo.
///         Each market uses a constant-product AMM (x*y=k) between YES and NO
///         outcome shares, in the classic conditional-token style.
///
///         Trade mechanics: a deposit of `a` MUSD is split into a complete set
///         (a YES + a NO). The counter-side half is handed to the pool as
///         counter-collateral, which releases shares of the desired side to the
///         buyer while preserving k. The buyer keeps the other half of the
///         split, so a buyer of YES ends up long (a + swapOut) YES.
///
///         Because the split mints exactly one YES and one NO per MUSD held,
///         the pool stays exactly solvent:
///             totalCollateral == totalYes == totalNo
///         and whichever side wins, every winning share is backed 1:1 by MUSD.
///
///         Prices are marginal prices of the pool:
///             priceYes = reserveNo / (reserveYes + reserveNo)
///         which is also the true cost of one YES share at the margin, so the
///         quoted price always matches what a trade actually pays.
contract AnnexMarket {
    // ────────────────────────── Types ──────────────────────────

    enum Outcome {
        None, // 0 — unresolved
        Yes, // 1
        No // 2
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
        uint256 totalCollateral; // total MUSD held for this market
        // LP
        uint256 lpTotalSupply;
        // Resolution
        Outcome outcome;
        bool resolved;
    }

    // ────────────────────────── Storage ──────────────────────────

    IERC20 public immutable musd;
    address public owner;

    uint256 public nextMarketId;
    mapping(uint256 => Market) private markets;

    // marketId => user => shares
    mapping(uint256 => mapping(address => uint256)) public yesBalances;
    mapping(uint256 => mapping(address => uint256)) public noBalances;
    mapping(uint256 => mapping(address => uint256)) public lpBalances;

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
    event SharesBought(
        uint256 indexed marketId,
        address indexed buyer,
        Outcome outcome,
        uint256 musdIn,
        uint256 sharesOut
    );
    event MarketResolved(uint256 indexed marketId, Outcome outcome, address indexed resolver);
    event Redeemed(uint256 indexed marketId, address indexed user, uint256 amount);
    event LpClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ────────────────────────── Errors ──────────────────────────

    error EmptyQuestion();
    error EndTimeInPast();
    error ZeroLiquidity();
    error ZeroAmount();
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

    constructor(address _musd) {
        musd = IERC20(_musd);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ────────────────────────── Admin ──────────────────────────

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert NotAuthorized();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setResolver(uint256 marketId, address resolver) external {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
        if (msg.sender != m.creator && msg.sender != owner) revert NotAuthorized();
        m.resolver = resolver;
    }

    // ────────────────────────── Core: Create ──────────────────────────

    /// @notice Create a new binary prediction market and seed the AMM with initial liquidity.
    /// @param question      Short yes/no question (e.g. "BTC above $100k on Nov 1?")
    /// @param description   Longer description with resolution criteria
    /// @param category      "BTC Price", "Mezo", "Crypto", or "Other"
    /// @param endTime       Unix timestamp after which the market can be resolved
    /// @param initialLiquidity  MUSD (1e18 = 1 MUSD) used to seed equal YES/NO reserves
    /// @return marketId     ID of the newly created market
    function createMarket(
        string calldata question,
        string calldata description,
        string calldata category,
        uint256 endTime,
        uint256 initialLiquidity
    ) external returns (uint256 marketId) {
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
        m.resolver = msg.sender;

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

        // LP shares = initial liquidity, all to creator
        m.lpTotalSupply = initialLiquidity;
        lpBalances[marketId][msg.sender] = initialLiquidity;

        emit MarketCreated(marketId, msg.sender, question, description, category, endTime, initialLiquidity);
    }

    // ────────────────────────── Core: Buy ──────────────────────────

    /// @notice Buy YES or NO shares with MUSD via the constant-product AMM.
    /// @dev    The deposit is split into a complete set; the opposite half seeds the
    ///         pool as counter-collateral and the pool releases the desired side.
    ///         The buyer keeps the desired-side half of the split, so buying `a` MUSD
    ///         of YES yields `a + swapOut` YES shares.
    /// @param marketId   Market to trade on
    /// @param outcome    Outcome.Yes or Outcome.No
    /// @param musdAmount Amount of MUSD to spend (1e18 = 1 MUSD)
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

        // Pull MUSD from buyer
        if (!musd.transferFrom(msg.sender, address(this), musdAmount)) {
            revert();
        }
        m.totalCollateral += musdAmount;

        uint256 sharesOut;
        if (outcome == Outcome.Yes) {
            // The deposited MUSD is split into a complete set: `musdAmount` YES + `musdAmount` NO.
            // The NO half is the counter-collateral handed to the pool, which releases YES shares
            // to the buyer (k preserved by the swap). The buyer keeps the YES half of the split.
            uint256 newReserveNo = m.reserveNo + musdAmount;
            uint256 newReserveYes = m.k / newReserveNo;
            uint256 swapOut = m.reserveYes - newReserveYes;
            sharesOut = musdAmount + swapOut;
            if (sharesOut == 0) revert ZeroOutput();
            m.reserveNo = newReserveNo;
            m.reserveYes = newReserveYes;
            m.totalNo += musdAmount;
            m.totalYes += musdAmount;
            yesBalances[marketId][msg.sender] += sharesOut;
        } else {
            // Mirror image: the split's NO half stays with the buyer, the YES half is the
            // counter-collateral that makes the pool release NO shares.
            uint256 newReserveYes = m.reserveYes + musdAmount;
            uint256 newReserveNo = m.k / newReserveYes;
            uint256 swapOut = m.reserveNo - newReserveNo;
            sharesOut = musdAmount + swapOut;
            if (sharesOut == 0) revert ZeroOutput();
            m.reserveYes = newReserveYes;
            m.reserveNo = newReserveNo;
            m.totalYes += musdAmount;
            m.totalNo += musdAmount;
            noBalances[marketId][msg.sender] += sharesOut;
        }

        emit SharesBought(marketId, msg.sender, outcome, musdAmount, sharesOut);
    }

    // ────────────────────────── Core: Resolve ──────────────────────────

    /// @notice Resolve a market after its end time has passed.
    /// @param marketId  Market to resolve
    /// @param outcome   Outcome.Yes or Outcome.No
    function resolve(uint256 marketId, Outcome outcome) external {
        Market storage m = markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
        if (m.resolved) revert AlreadyResolved();
        if (msg.sender != m.resolver && msg.sender != owner) revert NotAuthorized();
        if (block.timestamp < m.endTime && msg.sender != owner) revert NotEndedYet();
        if (outcome != Outcome.Yes && outcome != Outcome.No) revert InvalidOutcome();

        m.outcome = outcome;
        m.resolved = true;
        emit MarketResolved(marketId, outcome, msg.sender);
    }

    // ────────────────────────── Core: Redeem ──────────────────────────

    /// @notice Redeem winning shares for MUSD (1:1) after the market is resolved.
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

        if (!musd.transfer(msg.sender, winningShares)) {
            revert();
        }
        emit Redeemed(marketId, msg.sender, winningShares);
    }

    // ────────────────────────── Core: LP Claim ──────────────────────────

    /// @notice After resolution, LPs claim their share of the AMM's value.
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

    /// @notice Preview how many shares you'd receive for a given MUSD amount.
    ///         Includes the complete-set half minted from the deposit plus the pool's swap output.
    function getBuyQuote(uint256 marketId, Outcome outcome, uint256 musdAmount)
        external
        view
        returns (uint256 sharesOut)
    {
        Market storage m = markets[marketId];
        if (outcome == Outcome.Yes) {
            uint256 newReserveNo = m.reserveNo + musdAmount;
            uint256 newReserveYes = m.k / newReserveNo;
            sharesOut = musdAmount + (m.reserveYes - newReserveYes);
        } else {
            uint256 newReserveYes = m.reserveYes + musdAmount;
            uint256 newReserveNo = m.k / newReserveYes;
            sharesOut = musdAmount + (m.reserveNo - newReserveNo);
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
