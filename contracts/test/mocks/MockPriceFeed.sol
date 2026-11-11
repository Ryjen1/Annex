// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPriceFeed} from "../../src/AnnexMarket.sol";

/// @notice Configurable mock of Mezo's canonical PriceFeed (18-decimal BTC/USD).
contract MockPriceFeed is IPriceFeed {
    uint256 private _price;
    bool public stale;

    constructor(uint256 initialPrice) {
        _price = initialPrice;
    }

    function setPrice(uint256 newPrice) external {
        _price = newPrice;
        stale = false;
    }

    function setStale(bool isStale) external {
        stale = isStale;
    }

    function fetchPrice() external view returns (uint256) {
        if (stale) revert("PriceFeed: Oracle is stale.");
        return _price;
    }
}
