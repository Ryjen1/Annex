// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ITroveManager} from "../../src/AnnexMarket.sol";

/// @notice Configurable mock of Mezo's TroveManager for unit tests.
contract MockTroveManager is ITroveManager {
    struct TroveData {
        uint8 status;
        uint256 coll;
        uint256 principal;
        uint256 interest;
        uint256 maxBorrowingCapacity;
    }

    uint256 public constant override MCR = 1.1e18;
    mapping(address => TroveData) private troves;

    function setTrove(
        address borrower,
        uint8 status,
        uint256 coll,
        uint256 principal,
        uint256 interest,
        uint256 maxBorrowingCapacity
    ) external {
        troves[borrower] = TroveData({
            status: status,
            coll: coll,
            principal: principal,
            interest: interest,
            maxBorrowingCapacity: maxBorrowingCapacity
        });
    }

    function getTroveStatus(address _borrower) external view returns (uint8) {
        return troves[_borrower].status;
    }

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
        )
    {
        TroveData memory t = troves[_borrower];
        return (t.coll, t.principal, t.interest, 0, 0, 0);
    }

    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256) {
        TroveData memory t = troves[_borrower];
        uint256 debt = t.principal + t.interest;
        if (debt == 0) return type(uint256).max;
        return (t.coll * _price) / debt;
    }

    function getTroveMaxBorrowingCapacity(address _borrower) external view returns (uint256) {
        return troves[_borrower].maxBorrowingCapacity;
    }
}
