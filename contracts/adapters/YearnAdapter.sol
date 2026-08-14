// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IYearnVault {
    function deposit(uint256 amount, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function totalAssets() external view returns (uint256);
}

contract YearnAdapter {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    IYearnVault public immutable vault;
    address public immutable pool;

    modifier onlyPool() {
        require(msg.sender == pool, "Only Pool allowed");
        _;
    }

    constructor(address _asset, address _vault, address _pool) {
        asset = IERC20(_asset);
        vault = IYearnVault(_vault);
        pool = _pool;
    }

    function deposit(uint256 amount) external onlyPool returns (uint256 shares) {
        asset.safeTransferFrom(msg.sender, address(this), amount);
        asset.safeIncreaseAllowance(address(vault), amount);
        return vault.deposit(amount, address(this));
    }

    function withdraw(uint256 shares, address receiver) external onlyPool returns (uint256 assets) {
        return vault.redeem(shares, receiver, address(this));
    }

    function totalBalance() external view returns (uint256) {
        return vault.totalAssets();
    }
}
