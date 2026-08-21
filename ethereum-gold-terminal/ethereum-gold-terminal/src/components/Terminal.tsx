'use client'

import { useState, useEffect } from 'react'
import { useAssetPool } from '@/hooks/useAssetPool'
import { useWalletStore } from '@/store/walletStore'

export default function Terminal() {
  const { connected, address, connect, disconnect } = useWalletStore()
  const {
    balance,
    shares,
    sharePrice,
    tvl,
    depositFee,
    withdrawFee,
    paused,
    deposit,
    withdraw,
    approve,
    allowance,
  } = useAssetPool()

  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawShares, setWithdrawShares] = useState('')
  const [txState, setTxState] = useState<'idle' | 'approving' | 'depositing' | 'withdrawing'>('idle')

  const portfolioValue = shares * sharePrice
  const depositPreview = parseFloat(depositAmount) > 0 
    ? (parseFloat(depositAmount) / sharePrice) * (1 - depositFee / 10000) 
    : 0
  const withdrawPreview = parseFloat(withdrawShares) > 0 
    ? parseFloat(withdrawShares) * sharePrice * (1 - withdrawFee / 10000) 
    : 0

  const handleDeposit = async () => {
    if (!depositAmount || txState !== 'idle') return
    const amount = parseFloat(depositAmount)
    if (amount <= 0 || amount > balance) return
    
    setTxState('approving')
    await approve(amount)
    setTxState('depositing')
    await deposit(amount)
    setDepositAmount('')
    setTxState('idle')
  }

  const handleWithdraw = async () => {
    if (!withdrawShares || txState !== 'idle') return
    const shareAmount = parseFloat(withdrawShares)
    if (shareAmount <= 0 || shareAmount > shares) return
    
    setTxState('withdrawing')
    await withdraw(shareAmount)
    setWithdrawShares('')
    setTxState('idle')
  }

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6">
        <div className="flex flex-col items-center gap-8">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
            <span className="text-gold text-2xl font-bold">G</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Ethereum Gold</h1>
          <p className="text-muted text-sm text-center">Minimal financial terminal</p>
          <button
            onClick={connect}
            className="w-full max-w-xs py-4 bg-gold text-black font-semibold rounded-xl active:scale-95 transition-transform"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/5">
        <div className="px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
          <button className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">G</span>
            <span className="text-sm font-semibold text-white">Gold Terminal</span>
          </button>
          <button
            onClick={disconnect}
            className="text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-full bg-white/5"
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-8 max-w-lg mx-auto">
        {/* Portfolio Display */}
        <section className="py-8">
          <div className="text-center">
            <div className="text-xs text-muted mb-2">YOUR BALANCE</div>
            <div className="text-4xl font-bold text-gold tracking-tight">
              ${portfolioValue.toFixed(2)}
            </div>
            <div className="text-sm text-muted mt-2">
              {shares.toFixed(3)} GOLD
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-8">
            <div className="text-center">
              <div className="text-xs text-muted-2 mb-1">Share Price</div>
              <div className="text-base font-semibold text-white">${sharePrice.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-2 mb-1">TVL</div>
              <div className="text-base font-semibold text-white">${(tvl / 1000000).toFixed(1)}M</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-2 mb-1">USDC</div>
              <div className="text-base font-semibold text-white">${balance.toFixed(2)}</div>
            </div>
          </div>
        </section>

        {/* Action Tabs */}
        <section className="flex gap-2 mb-6">
          <button className="flex-1 py-3 bg-gold text-black font-semibold rounded-xl text-sm">
            Deposit
          </button>
          <button className="flex-1 py-3 bg-white/5 text-white font-semibold rounded-xl text-sm">
            Withdraw
          </button>
        </section>

        {/* Deposit Panel */}
        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">AMOUNT (USDC)</label>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none"
              />
              <span className="text-sm text-muted">USDC</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Fee: {(depositFee / 100).toFixed(2)}%</span>
              <span>Receive: {depositPreview.toFixed(3)} GOLD</span>
            </div>
          </div>
          <button
            onClick={handleDeposit}
            disabled={!depositAmount || txState !== 'idle'}
            className="w-full mt-3 py-4 bg-gold text-black font-bold rounded-xl disabled:opacity-30 active:scale-95 transition-all"
          >
            {txState === 'approving' ? 'Approving...' : 
             txState === 'depositing' ? 'Depositing...' : 
             'Deposit'}
          </button>
        </section>

        {/* Withdraw Panel */}
        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">SHARES (GOLD)</label>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none"
              />
              <span className="text-sm text-muted">GOLD</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Fee: {(withdrawFee / 100).toFixed(2)}%</span>
              <span>Receive: ${withdrawPreview.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!withdrawShares || txState !== 'idle'}
            className="w-full mt-3 py-4 bg-white/5 text-white font-bold rounded-xl disabled:opacity-30 active:scale-95 transition-all"
          >
            {txState === 'withdrawing' ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </section>

        {/* Pool Info */}
        <section className="flex items-center justify-between py-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${paused ? 'bg-muted-2' : 'bg-gold animate-pulse'}`} />
            <span className="text-xs text-muted">Yield {paused ? 'Paused' : 'Active'}</span>
          </div>
          <div className="text-xs text-muted">
            {address?.slice(0, 8)}...{address?.slice(-6)}
          </div>
        </section>
      </main>
    </div>
  )
}
