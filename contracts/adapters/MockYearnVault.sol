// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockYearnVault is ERC20 {
    IERC20 public immutable asset;

    constructor(address _asset) ERC20("Yearn Vault Share", "yvToken") {
        asset = IERC20(_asset);
    }

    function deposit(uint256 amount, address receiver) external returns (uint256 shares) {
        asset.transferFrom(msg.sender, address(this), amount);
        shares = amount; // 1:1 initial mock ratio
        _mint(receiver, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        _burn(owner, shares);
        assets = shares; // Simplified 1:1 redemption
        asset.transfer(receiver, assets);
    }

    function totalAssets() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}
