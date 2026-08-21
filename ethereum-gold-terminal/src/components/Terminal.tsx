'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { isAddress, zeroAddress } from 'viem'
import { useAssetPool } from '@/hooks/useAssetPool'

function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="13" stroke="#F0B90B" strokeWidth="2.5" />
      <line x1="7" y1="25" x2="25" y2="7" stroke="#F0B90B" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Terminal() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const pool = useAssetPool()
  const {
    balance,
    shares,
    sharePrice,
    tvl,
    depositFee,
    withdrawFee,
    paused,
    yieldActive,
    portfolioValue,
    needsApproval,
    approve,
    deposit,
    withdraw,
    isBusy,
    isApproving,
    isDepositing,
    isWithdrawing,
    isApproved,
    isDeposited,
    isWithdrawn,
    resetApprove,
    resetDeposit,
    resetWithdraw,
    refetchAll,
    refetchAllowance,
  } = pool

  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawShares, setWithdrawShares] = useState('')
  const [referrer, setReferrer] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (isApproved) {
      setToast('USDC approved')
      refetchAllowance()
      resetApprove()
    }
  }, [isApproved])

  useEffect(() => {
    if (isDeposited) {
      setToast('Deposit confirmed')
      setDepositAmount('')
      refetchAll()
      resetDeposit()
    }
  }, [isDeposited])

  useEffect(() => {
    if (isWithdrawn) {
      setToast('Withdrawal confirmed')
      setWithdrawShares('')
      refetchAll()
      resetWithdraw()
    }
  }, [isWithdrawn])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const depositPreview =
    parseFloat(depositAmount) > 0 && sharePrice > 0
      ? (parseFloat(depositAmount) / sharePrice) * (1 - depositFee / 10000)
      : 0
  const withdrawPreview =
    parseFloat(withdrawShares) > 0
      ? parseFloat(withdrawShares) * sharePrice * (1 - withdrawFee / 10000)
      : 0

  const handleDeposit = () => {
    if (!depositAmount || isBusy || paused) return
    const amt = parseFloat(depositAmount)
    if (amt <= 0) return
    if (needsApproval(depositAmount)) {
      approve(depositAmount)
      return
    }
    const ref =
      referrer && isAddress(referrer) ? (referrer as `0x${string}`) : zeroAddress
    deposit(depositAmount, ref)
  }

  const handleWithdraw = () => {
    if (!withdrawShares || isBusy) return
    const sh = parseFloat(withdrawShares)
    if (sh <= 0) return
    withdraw(withdrawShares)
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6">
        <div className="flex flex-col items-center gap-8">
          <LogoMark size={48} />
          <h1 className="text-2xl font-bold text-white">Liquid Yield</h1>
          <p className="text-muted text-sm text-center">Connect to interact with the vault</p>
          <button
            onClick={() => connect({ connector: injected() })}
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
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/5">
        <div className="px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="text-sm font-semibold text-white">Liquid Yield</span>
          </div>
          <button
            onClick={() => disconnect()}
            className="text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-full bg-white/5"
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        </div>
      </header>

      <main className="px-4 pb-8 max-w-lg mx-auto">
        <section className="py-8">
          <div className="text-center">
            <div className="text-xs text-muted mb-2">YOUR BALANCE</div>
            <div className="text-4xl font-bold text-gold tracking-tight">
              ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted mt-2">{shares.toFixed(4)} GOLD</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-8">
            <div className="text-center">
              <div className="text-xs text-muted-2 mb-1">Share Price</div>
              <div className="text-base font-semibold text-white">${sharePrice.toFixed(4)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-2 mb-1">TVL</div>
              <div className="text-base font-semibold text-white">
                ${tvl.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-2 mb-1">USDC</div>
              <div className="text-base font-semibold text-white">{balance.toFixed(2)}</div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">AMOUNT (USDC)</label>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                disabled={isBusy}
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none"
              />
              <button
                type="button"
                className="text-xs text-gold mr-2"
                onClick={() => setDepositAmount(balance > 0 ? String(balance) : '')}
              >
                MAX
              </button>
              <span className="text-sm text-muted">USDC</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Fee: {(depositFee / 100).toFixed(2)}%</span>
              <span>Receive: {depositPreview.toFixed(4)} GOLD</span>
            </div>
          </div>

          <label className="block text-xs text-muted mb-2 mt-4">REFERRER (optional)</label>
          <div className="bg-white/5 rounded-xl p-3 mb-3">
            <input
              type="text"
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="0x..."
              disabled={isBusy}
              className="bg-transparent text-sm text-white w-full focus:outline-none font-mono"
            />
          </div>

          <button
            onClick={handleDeposit}
            disabled={!depositAmount || isBusy || !!paused || parseFloat(depositAmount) <= 0}
            className="w-full mt-1 py-4 bg-gold text-black font-bold rounded-xl disabled:opacity-30 active:scale-95 transition-all"
          >
            {paused
              ? 'Paused'
              : isApproving
              ? 'Approving...'
              : isDepositing
              ? 'Depositing...'
              : needsApproval(depositAmount) && parseFloat(depositAmount) > 0
              ? 'Approve USDC'
              : 'Deposit'}
          </button>
        </section>

        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">SHARES (GOLD)</label>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder="0.00"
                disabled={isBusy}
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none"
              />
              <button
                type="button"
                className="text-xs text-gold mr-2"
                onClick={() => setWithdrawShares(shares > 0 ? String(shares) : '')}
              >
                MAX
              </button>
              <span className="text-sm text-muted">GOLD</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Fee: {(withdrawFee / 100).toFixed(2)}%</span>
              <span>Receive: ${withdrawPreview.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!withdrawShares || isBusy || parseFloat(withdrawShares) <= 0}
            className="w-full mt-3 py-4 bg-white/5 text-white font-bold rounded-xl disabled:opacity-30 active:scale-95 transition-all"
          >
            {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </section>

        <section className="flex items-center justify-between py-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                paused ? 'bg-muted-2' : yieldActive ? 'bg-gold animate-pulse' : 'bg-muted-2'
              }`}
            />
            <span className="text-xs text-muted">
              Yield {paused ? 'Paused' : yieldActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="text-xs text-muted">
            {address?.slice(0, 8)}...{address?.slice(-6)}
          </div>
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-surface border border-white/10 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
