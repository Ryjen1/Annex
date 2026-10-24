// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "../../src/IERC20.sol";
import {AnnexMarket} from "../../src/AnnexMarket.sol";

/// @dev ERC20 that fires a nested call back into AnnexMarket.buyShares from inside
///      transferFrom, to exercise the reentrancy guard.
contract ReentrantMUSD is IERC20 {
    address public target;
    uint256 public marketId;
    bool public armed;
    bool public blocked;
    bytes public lastError;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor() {
        _totalSupply = 0;
    }

    function setTarget(address t) external {
        target = t;
    }

    function setMarketId(uint256 id) external {
        marketId = id;
    }

    function arm() external {
        armed = true;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (armed) {
            armed = false;
            (bool ok, bytes memory err) = target.call(
                abi.encodeWithSelector(
                    AnnexMarket.buyShares.selector, marketId, uint8(1), uint256(1)
                )
            );
            blocked = !ok;
            lastError = err;
        }
        uint256 allowed = _allowances[from][msg.sender];
        require(allowed >= amount, "ReentrantMUSD: insufficient allowance");
        _allowances[from][msg.sender] = allowed - amount;
        _balances[from] -= amount;
        _balances[to] += amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        _totalSupply += amount;
        _balances[to] += amount;
    }
}
