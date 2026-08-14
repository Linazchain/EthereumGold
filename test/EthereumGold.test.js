const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EthereumGold Protocol Invariants & State Machine", function () {
  let owner, alice, bob, treasury;
  let mockUSDC, mockVault, adapter, pool, referralRegistry;

  beforeEach(async function () {
    [owner, alice, bob, treasury] = await ethers.getSigners();

    // 1. Deploy ERC20 Asset
    const ERC20 = await ethers.getContractFactory("xToken");
    mockUSDC = await ERC20.deploy("USD Coin", "USDC", owner.address);

    await mockUSDC.mint(alice.address, ethers.parseUnits("1000", 18));
    await mockUSDC.mint(bob.address, ethers.parseUnits("1000", 18));
    await mockUSDC.mint(owner.address, ethers.parseUnits("1000", 18));

    // 2. Deploy Registries and Pool
    const Ref = await ethers.getContractFactory("ReferralRegistry");
    referralRegistry = await Ref.deploy();

    const Pool = await ethers.getContractFactory("AssetPool");
    pool = await Pool.deploy(
      await mockUSDC.getAddress(),
      "xUSDC Token",
      "xUSDC",
      await referralRegistry.getAddress(),
      treasury.address
    );

    // 3. Deploy Mock Vault & Adapter
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

  it("Invariant 1: Deposit fees & share minting work as expected", async function () {
    const depositAmount = ethers.parseUnits("100", 18);
    await mockUSDC.connect(alice).approve(await pool.getAddress(), depositAmount);
    await pool.connect(alice).deposit(depositAmount, bob.address);

    const xTokenAddr = await pool.shareToken();
    const xToken = await ethers.getContractAt("xToken", xTokenAddr);

    expect(await mockUSDC.balanceOf(treasury.address)).to.equal(ethers.parseUnits("1", 18));
    expect(await xToken.balanceOf(alice.address)).to.equal(ethers.parseUnits("99", 18));
    expect(await referralRegistry.referrerOf(alice.address)).to.equal(bob.address);
  });

  it("Invariant 4: Yield increases share value without diluting shares", async function () {
    // Alice deposits 100 USDC -> 99 xUSDC minted
    const depositAmount = ethers.parseUnits("100", 18);
    await mockUSDC.connect(alice).approve(await pool.getAddress(), depositAmount);
    await pool.connect(alice).deposit(depositAmount, ethers.ZeroAddress);

    const initialPrice = await pool.pricePerShare();
    expect(initialPrice).to.equal(ethers.parseUnits("1", 18)); // 1:1 initial

    // Simulate external Yearn yield: Direct transfer 50 USDC into Yearn Vault
    await mockUSDC.connect(owner).transfer(await mockVault.getAddress(), ethers.parseUnits("50", 18));

    // Price per share must increase after yield exists
    const newPrice = await pool.pricePerShare();
    expect(newPrice).to.be.gt(initialPrice);
  });

  it("State Machine: Paused pool rejects deposits", async function () {
    await pool.pause();

    const depositAmount = ethers.parseUnits("100", 18);
    await mockUSDC.connect(alice).approve(await pool.getAddress(), depositAmount);

    await expect(
      pool.connect(alice).deposit(depositAmount, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(pool, "EnforcedPause");
  });
});
