require("@nomicfoundation/hardhat-toolbox");

const PK = process.env.PRIVATE_KEY;
const BASE_SEPOLIA_RPC =
  process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: BASE_SEPOLIA_RPC,
      accounts: PK ? [PK] : [],
      chainId: 84532,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: PK ? [PK] : [],
      chainId: 11155111,
    },
  },
};
