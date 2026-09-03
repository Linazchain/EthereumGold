const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying EthereumGold Protocol with account:", deployer.address);

  // 1. Deploy Mock USDC Asset
  const ERC20 = await ethers.getContractFactory("xToken");
  const mockUSDC = await ERC20.deploy("USD Coin", "USDC", deployer.address);
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("✅ Mock USDC deployed to:", usdcAddress);

  // Mint 10,000 USDC to deployer for local testing
  await mockUSDC.mint(deployer.address, ethers.parseUnits("10000", 18));

  // 2. Deploy Referral Registry
  const Ref = await ethers.getContractFactory("ReferralRegistry");
  const refRegistry = await Ref.deploy();
  await refRegistry.waitForDeployment();
  const refAddress = await refRegistry.getAddress();
  console.log("✅ ReferralRegistry deployed to:", refAddress);

  // 3. Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("✅ Treasury deployed to:", treasuryAddress);

  // 4. Deploy Asset Pool
  const Pool = await ethers.getContractFactory("AssetPool");
  const pool = await Pool.deploy(
    usdcAddress,
    "xUSDC Token",
    "xUSDC",
    refAddress,
    treasuryAddress
  );
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("✅ AssetPool (USDC) deployed to:", poolAddress);

  // 5. Deploy Mock Yearn Vault & Adapter
  const Vault = await ethers.getContractFactory("MockYearnVault");
  const mockVault = await Vault.deploy(usdcAddress);
  await mockVault.waitForDeployment();
  const vaultAddress = await mockVault.getAddress();

  const Adapter = await ethers.getContractFactory("YearnAdapter");
  const adapter = await Adapter.deploy(usdcAddress, vaultAddress, poolAddress);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ YearnAdapter deployed to:", adapterAddress);

  // 6. Link Adapter to Pool
  await pool.setYieldAdapter(adapterAddress);
  console.log("🔗 Yield Adapter linked to AssetPool");

  // Auto-sync addresses to frontend/lib/contracts.ts
  const frontendContractsPath = path.join(__dirname, "../frontend/lib/contracts.ts");
  if (fs.existsSync(frontendContractsPath)) {
    const contractsConfig = `export const LOCAL_CONTRACTS = {
  assetPool: "${poolAddress}",
  usdc: "${usdcAddress}",
  referralRegistry: "${refAddress}",
};

export const ASSET_POOL_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "referrer", type: "address" }
    ],
    outputs: []
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "shareAmount", type: "uint256" }],
    outputs: []
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "pricePerShare",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "shareToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
] as const;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export const REFERRAL_REGISTRY_ABI = [
  {
    name: "referrerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "registerReferral",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "referrer", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;
`;
    fs.writeFileSync(frontendContractsPath, contractsConfig);
    console.log("⚡ Dynamic addresses synced to frontend/lib/contracts.ts!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
