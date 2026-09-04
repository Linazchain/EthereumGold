const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const USER = process.env.USER_ADDRESS || "0xD1f63dD747267AdC430861E4eA0A68e15266a4D6";

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Network: Sepolia (11155111)");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(bal), "ETH");
  if (bal === 0n) throw new Error("Deployer has 0 Sepolia ETH");

  // Mock USDC (18 decimals) with mint
  const ERC20 = await ethers.getContractFactory("xToken");
  // xToken needs (name, symbol, owner) — use deployer as temporary owner then mint
  const mockUSDC = await ERC20.deploy("USD Coin", "USDC", deployer.address);
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("✅ Mock USDC:", usdcAddress);

  const mintAmt = ethers.parseUnits("100000", 18);
  await (await mockUSDC.mint(deployer.address, mintAmt)).wait();
  if (USER.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await mockUSDC.mint(USER, mintAmt)).wait();
    console.log("✅ Minted 100000 USDC →", USER);
  }

  const Ref = await ethers.getContractFactory("ReferralRegistry");
  const refRegistry = await Ref.deploy();
  await refRegistry.waitForDeployment();
  const refAddress = await refRegistry.getAddress();
  console.log("✅ ReferralRegistry:", refAddress);

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("✅ Treasury:", treasuryAddress);

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
  console.log("✅ AssetPool:", poolAddress);

  const shareToken = await pool.shareToken();
  console.log("✅ Share token (xUSDC):", shareToken);

  const Vault = await ethers.getContractFactory("MockYearnVault");
  const mockVault = await Vault.deploy(usdcAddress);
  await mockVault.waitForDeployment();
  const vaultAddress = await mockVault.getAddress();
  console.log("✅ MockYearnVault:", vaultAddress);

  const Adapter = await ethers.getContractFactory("YearnAdapter");
  const adapter = await Adapter.deploy(usdcAddress, vaultAddress, poolAddress);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ YearnAdapter:", adapterAddress);

  await (await pool.setYieldAdapter(adapterAddress)).wait();
  console.log("🔗 Adapter linked");

  const deployment = {
    network: "sepolia",
    chainId: 11155111,
    deployer: deployer.address,
    userFunded: USER,
    usdc: usdcAddress,
    referralRegistry: refAddress,
    treasury: treasuryAddress,
    assetPool: poolAddress,
    shareToken,
    mockYearnVault: vaultAddress,
    yearnAdapter: adapterAddress,
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployments-sepolia-boost.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("📄 deployments-sepolia-boost.json written");

  const contractsTs = `export const CHAIN_ID = 11155111 as const // Sepolia

export const CONTRACTS = {
  assetPool: '${poolAddress}' as \`0x\${string}\`,
  usdc: '${usdcAddress}' as \`0x\${string}\`,
  referralRegistry: '${refAddress}' as \`0x\${string}\`,
  shareToken: '${shareToken}' as \`0x\${string}\`,
}

export const USDC_DECIMALS = 18
export const SHARE_DECIMALS = 18

export const ASSET_POOL_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'referrer', type: 'address' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'shareAmount', type: 'uint256' }], outputs: [] },
  { name: 'totalAssets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'pricePerShare', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'shareToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'depositFeeBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'withdrawFeeBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'yieldAdapter', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { name: 'userPayoutWeight', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalPayoutWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'positionCount', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getPosition', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [
    { name: 'principal', type: 'uint256' }, { name: 'payoutWeight', type: 'uint256' }, { name: 'multiplierBps', type: 'uint256' }, { name: 'shares', type: 'uint256' }, { name: 'active', type: 'bool' }
  ] },
] as const

export const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const

export const REFERRAL_REGISTRY_ABI = [
  { name: 'registerReferral', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'referrer', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'referrerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'isReferred', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'isReferrer', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'referralCount', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'multiplierBpsFor', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const
`

  const targets = [
    path.join(__dirname, "../ethereum-gold-terminal/src/lib/contracts.ts"),
    path.join(__dirname, "../frontend/lib/contracts.ts"),
  ];
  for (const p of targets) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) continue;
    fs.writeFileSync(p, contractsTs);
    console.log("⚡ Updated", p);
  }

  console.log("\n✅ Sepolia boost deploy complete.");
  console.log(JSON.stringify(deployment, null, 2));
  console.log("\nPaste deployments-sepolia-boost.json in chat after push, then we redeploy Vercel.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
