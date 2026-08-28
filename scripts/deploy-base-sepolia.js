const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const USER = process.env.USER_ADDRESS || "0xD1f63dD747267AdC430861E4eA0A68e15266a4D6";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Network chainId:", network.chainId.toString());
  console.log("Deployer:", deployer.address);

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(bal), "ETH");
  if (bal === 0n) {
    throw new Error(
      "Deployer has 0 Base Sepolia ETH. Get faucet funds first:\n" +
        "  https://www.alchemy.com/faucets/base-sepolia\n" +
        "  https://docs.base.org/docs/tools/network-faucets\n" +
        "  https://faucet.quicknode.com/base/sepolia"
    );
  }

  // 1. Mock USDC
  const ERC20 = await ethers.getContractFactory("xToken");
  const mockUSDC = await ERC20.deploy("USD Coin", "USDC", deployer.address);
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("✅ Mock USDC:", usdcAddress);

  const mintAmt = ethers.parseUnits("100000", 18);
  await (await mockUSDC.mint(deployer.address, mintAmt)).wait();
  if (USER.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await mockUSDC.mint(USER, mintAmt)).wait();
    console.log("✅ Minted 100000 USDC →", USER);
  } else {
    console.log("✅ Minted 100000 USDC → deployer");
  }

  // 2. ReferralRegistry
  const Ref = await ethers.getContractFactory("ReferralRegistry");
  const refRegistry = await Ref.deploy();
  await refRegistry.waitForDeployment();
  const refAddress = await refRegistry.getAddress();
  console.log("✅ ReferralRegistry:", refAddress);

  // 3. Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("✅ Treasury:", treasuryAddress);

  // 4. AssetPool
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

  // 5. Mock Yearn vault + adapter
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
  console.log("🔗 Adapter linked to pool");

  const contractsTs = `export const CONTRACTS = {
  assetPool: '${poolAddress}' as \`0x\${string}\`,
  usdc: '${usdcAddress}' as \`0x\${string}\`,
  referralRegistry: '${refAddress}' as \`0x\${string}\`,
};

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
] as const;

export const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;
`;

  const targets = [
    path.join(__dirname, "../ethereum-gold-terminal/src/lib/contracts.ts"),
    path.join(__dirname, "../frontend/lib/contracts.ts"),
  ];
  for (const p of targets) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) continue;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, contractsTs);
    console.log("⚡ Updated", p);
  }

  const deployment = {
    network: "baseSepolia",
    chainId: 84532,
    deployer: deployer.address,
    usdc: usdcAddress,
    referralRegistry: refAddress,
    treasury: treasuryAddress,
    assetPool: poolAddress,
    mockYearnVault: vaultAddress,
    yearnAdapter: adapterAddress,
  };
  fs.writeFileSync(
    path.join(__dirname, "../deployments-base-sepolia.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("📄 Wrote deployments-base-sepolia.json");
  console.log("\n✅ Base Sepolia deploy complete.");
  console.log("Switch MetaMask to Base Sepolia (chainId 84532), then hard-refresh the app.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
