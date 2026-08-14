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
