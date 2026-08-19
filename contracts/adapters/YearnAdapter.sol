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

    /// @notice Withdraw a specific amount of underlying assets from the Yearn vault
    /// @param assets The amount of underlying assets to withdraw
    /// @param receiver Address that will receive the assets
    /// @return The actual amount of assets withdrawn
    function withdraw(uint256 assets, address receiver) external onlyPool returns (uint256) {
        if (assets == 0) return 0;

        uint256 totalVaultAssets = vault.totalAssets();
        uint256 ourShares = IERC20(address(vault)).balanceOf(address(this));

        if (totalVaultAssets == 0 || ourShares == 0) return 0;

        // Calculate the number of vault shares needed to get `assets` of underlying
        // We use a slight buffer for rounding (add 1) to avoid under-withdrawal
        uint256 sharesToRedeem = (assets * ourShares) / totalVaultAssets;
        if (sharesToRedeem * totalVaultAssets < assets * ourShares) {
            sharesToRedeem += 1; // ceiling division for safety
        }
        if (sharesToRedeem > ourShares) {
            sharesToRedeem = ourShares;
        }

        return vault.redeem(sharesToRedeem, receiver, address(this));
    }

    function totalBalance() external view returns (uint256) {
        return vault.totalAssets();
    }
}
