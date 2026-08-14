#!/bin/bash

# 1. Update YearnAdapter.sol to accept _pool in constructor
cat << 'SOL' > contracts/adapters/YearnAdapter.sol
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
SOL

# 2. Update test suite to pass pool address to Adapter deployment
cat << 'JS' > test/EthereumGold.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EthereumGold Protocol Economic Invariants", function () {
  let owner, alice, bob, treasury;
  let mockUSDC, mockVault, adapter, pool, referralRegistry;

  beforeEach(async function () {
    [owner, alice, bob, treasury] = await ethers.getSigners();

    // 1. Deploy ERC20 Asset
    const ERC20 = await ethers.getContractFactory("xToken");
    mockUSDC = await ERC20.deploy("USD Coin", "USDC", owner.address);

    // Mint USDC to Alice & Bob
    await mockUSDC.mint(alice.address, ethers.parseUnits("1000", 18));
    await mockUSDC.mint(bob.address, ethers.parseUnits("1000", 18));

    // 2. Deploy Referral Registry
    const Ref = await ethers.getContractFactory("ReferralRegistry");
    referralRegistry = await Ref.deploy();

    // 3. Deploy Asset Pool
    const Pool = await ethers.getContractFactory("AssetPool");
    pool = await Pool.deploy(
      await mockUSDC.getAddress(),
      "xUSDC Token",
      "xUSDC",
      await referralRegistry.getAddress(),
      treasury.address
    );

    // 4. Deploy Mock Yearn Vault & Adapter with Pool address
    const Vault = await ethers.getContractFactory("MockYearnVault");
    mockVault = await Vault.deploy(await mockUSDC.getAddress());

    const Adapter = await ethers.getContractFactory("YearnAdapter");
    adapter = await Adapter.deploy(
      await mockUSDC.getAddress(),
      await mockVault.getAddress(),
      await pool.getAddress()
    );

    await pool.setYieldAdapter(await adapter.getAddress());
  });

  it("Invariant 1: Deposits enforce 1% fee and backing equality", async function () {
    const depositAmount = ethers.parseUnits("100", 18);
    await mockUSDC.connect(alice).approve(await pool.getAddress(), depositAmount);

    await pool.connect(alice).deposit(depositAmount, bob.address);

    const xTokenAddr = await pool.shareToken();
    const xToken = await ethers.getContractAt("xToken", xTokenAddr);

    // Treasury received 1% (1 USDC)
    expect(await mockUSDC.balanceOf(treasury.address)).to.equal(ethers.parseUnits("1", 18));

    // Alice received 99 xUSDC
    expect(await xToken.balanceOf(alice.address)).to.equal(ethers.parseUnits("99", 18));

    // Referral registered correctly
    expect(await referralRegistry.referrerOf(alice.address)).to.equal(bob.address);
  });

  it("Invariant 2: No user can withdraw more assets than their share", async function () {
    const depositAmount = ethers.parseUnits("100", 18);
    await mockUSDC.connect(alice).approve(await pool.getAddress(), depositAmount);
    await pool.connect(alice).deposit(depositAmount, ethers.ZeroAddress);

    const xTokenAddr = await pool.shareToken();
    const xToken = await ethers.getContractAt("xToken", xTokenAddr);

    // Attempting to withdraw more than owned fails
    const aliceShares = await xToken.balanceOf(alice.address);
    await expect(pool.connect(alice).withdraw(aliceShares + 1n)).to.be.revertedWith("Excessive shares");
  });
});
JS

echo "✅ Patch applied!"
