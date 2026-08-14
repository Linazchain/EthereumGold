#!/bin/bash
set -e

echo "🚀 Creating EthereumGold Next.js Frontend with Wagmi & Viem..."

# 1. Create Frontend Directory Structure
mkdir -p frontend/app
mkdir -p frontend/lib
mkdir -p frontend/components

cd frontend

# 2. Generate package.json
cat << 'JSON' > package.json
{
  "name": "ethereumgold-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.28.0",
    "lucide-react": "^0.359.0",
    "next": "14.1.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "viem": "^2.8.0",
    "wagmi": "^2.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.0"
  }
}
JSON

# 3. Next.js & Tailwind Config
cat << 'JS' > next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;
JS

cat << 'JS' > tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        }
      }
    },
  },
  plugins: [],
}
JS

cat << 'CSS' > postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
CSS

# 4. Global CSS
cat << 'CSS' > app/globals.css
@tailwindcss base;
@tailwindcss components;
@tailwindcss utilities;

body {
  background-color: #0b0f17;
  color: #f3f4f6;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
CSS

# 5. Contract ABIs and Configuration (lib/contracts.ts)
cat << 'TS' > lib/contracts.ts
import { parseUnits } from "viem";

export const LOCAL_CONTRACTS = {
  assetPool: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Hardhat Default
  usdc: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  referralRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
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
TS

# 6. Wagmi & Query Provider (app/providers.tsx)
cat << 'TSX' > app/providers.tsx
'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { hardhat, mainnet } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [hardhat, mainnet],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(),
    [mainnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
TSX

# 7. Root Layout (app/layout.tsx)
cat << 'TSX' > app/layout.tsx
import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'EthereumGold Protocol',
  description: 'Sustainable Yield Protocol with Invariant Accounting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
TSX

# 8. Protocol Dashboard Page (app/page.tsx)
cat << 'TSX' > app/page.tsx
'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { LOCAL_CONTRACTS, ASSET_POOL_ABI, ERC20_ABI } from '../lib/contracts';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [referrer, setReferrer] = useState('');

  // Contract Reads
  const { data: totalAssets } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'totalAssets',
  });

  const { data: pricePerShare } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'pricePerShare',
  });

  const { data: userUSDC } = useReadContract({
    address: LOCAL_CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Contract Writes
  const { writeContract: approveUSDC, isPending: isApproving } = useWriteContract();
  const { writeContract: depositPool, isPending: isDepositing } = useWriteContract();
  const { writeContract: withdrawPool, isPending: isWithdrawing } = useWriteContract();

  const handleApprove = () => {
    if (!amount) return;
    approveUSDC({
      address: LOCAL_CONTRACTS.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [LOCAL_CONTRACTS.assetPool, parseUnits(amount, 18)],
    });
  };

  const handleDeposit = () => {
    if (!amount) return;
    const refAddr = referrer.startsWith('0x') ? (referrer as `0x${string}`) : '0x0000000000000000000000000000000000000000';
    depositPool({
      address: LOCAL_CONTRACTS.assetPool,
      abi: ASSET_POOL_ABI,
      functionName: 'deposit',
      args: [parseUnits(amount, 18), refAddr],
    });
  };

  const handleWithdraw = () => {
    if (!amount) return;
    withdrawPool({
      address: LOCAL_CONTRACTS.assetPool,
      abi: ASSET_POOL_ABI,
      functionName: 'withdraw',
      args: [parseUnits(amount, 18)],
    });
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Top Header */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-500">EthereumGold</h1>
          <p className="text-sm text-slate-400">Yield Protocol & Multi-Asset Vaults</p>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-4">
            <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <button
              onClick={() => disconnect()}
              className="text-xs text-red-400 hover:underline"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm"
          >
            Connect Wallet
          </button>
        )}
      </header>

      {/* Protocol Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Total Value Locked (TVL)</p>
          <p className="text-xl font-bold text-slate-100">
            {totalAssets ? `${formatUnits(totalAssets as bigint, 18)} USDC` : '0.00 USDC'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Share Price (xUSDC)</p>
          <p className="text-xl font-bold text-slate-100">
            {pricePerShare ? `${formatUnits(pricePerShare as bigint, 18)} USDC` : '1.00 USDC'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Your Wallet Balance</p>
          <p className="text-xl font-bold text-slate-100">
            {userUSDC ? `${formatUnits(userUSDC as bigint, 18)} USDC` : '0.00 USDC'}
          </p>
        </div>
      </div>

      {/* Interactive Vault Interface */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`pb-2 px-4 text-sm font-semibold border-b-2 ${
              activeTab === 'deposit'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-transparent text-slate-400'
            }`}
          >
            Deposit Asset
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`pb-2 px-4 text-sm font-semibold border-b-2 ${
              activeTab === 'withdraw'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-transparent text-slate-400'
            }`}
          >
            Withdraw Shares
          </button>
        </div>

        {activeTab === 'deposit' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Deposit Amount (USDC)</label>
              <input
                type="number"
                placeholder="100.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Referrer Address (Optional)</label>
              <input
                type="text"
                placeholder="0x..."
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleApprove}
                disabled={isApproving || !isConnected}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {isApproving ? 'Approving...' : '1. Approve USDC'}
              </button>
              <button
                onClick={handleDeposit}
                disabled={isDepositing || !isConnected}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-slate-950 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {isDepositing ? 'Depositing...' : '2. Deposit to Vault'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Shares to Burn (xUSDC)</label>
              <input
                type="number"
                placeholder="99.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-yellow-500"
              />
            </div>

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !isConnected}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-950 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {isWithdrawing ? 'Withdrawing...' : 'Burn xTokens & Redeem Assets'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
TSX

echo "📦 Installing Next.js & Viem/Wagmi dependencies..."
npm install --silent

echo "✅ Next.js frontend built successfully!"
