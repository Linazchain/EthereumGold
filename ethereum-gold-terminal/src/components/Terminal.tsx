'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { isAddress, zeroAddress } from 'viem'
import { useAssetPool } from '@/hooks/useAssetPool'

function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13" stroke="#F0B90B" strokeWidth="2.5" />
      <line x1="7" y1="25" x2="25" y2="7" stroke="#F0B90B" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
      aria-hidden
    />
  )
}

type ToastKind = 'success' | 'error' | 'info'

export default function Terminal() {
  const { address, isConnected, isConnecting: accountConnecting } = useAccount()
  const { connect, connectors, isPending: isConnectPending, error: connectError, reset: resetConnect } =
    useConnect()
  const { disconnect, isPending: isDisconnecting } = useDisconnect()

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
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)

  const showToast = useCallback((msg: string, kind: ToastKind = 'info') => {
    setToast({ msg, kind })
  }, [])

  useEffect(() => {
    if (isApproved) {
      showToast('USDC approved', 'success')
      refetchAllowance()
      resetApprove()
    }
  }, [isApproved])

  useEffect(() => {
    if (isDeposited) {
      showToast('Deposit confirmed', 'success')
      setDepositAmount('')
      refetchAll()
      resetDeposit()
    }
  }, [isDeposited])

  useEffect(() => {
    if (isWithdrawn) {
      showToast('Withdrawal confirmed', 'success')
      setWithdrawShares('')
      refetchAll()
      resetWithdraw()
    }
  }, [isWithdrawn])

  useEffect(() => {
    if (connectError) {
      const msg = connectError.message || 'Failed to connect wallet'
      if (/rejected|denied|cancel/i.test(msg)) {
        showToast('Connection rejected', 'error')
      } else if (/provider|not found|no ethereum/i.test(msg)) {
        showToast('No wallet found — install MetaMask', 'error')
      } else {
        showToast(msg.slice(0, 120), 'error')
      }
    }
  }, [connectError])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const hasWallet =
    typeof window !== 'undefined' &&
    !!(window as unknown as { ethereum?: unknown }).ethereum

  const handleConnect = async () => {
    resetConnect()
    setPressed('connect')
    try {
      if (!hasWallet) {
        showToast('No wallet detected. Install MetaMask or open in a wallet browser.', 'error')
        return
      }
      const connector = connectors[0]
      if (!connector) {
        showToast('No connector available', 'error')
        return
      }
      await connect({ connector })
    } catch (e) {
      const err = e as Error
      showToast(err?.message?.slice(0, 120) || 'Connect failed', 'error')
    } finally {
      setPressed(null)
    }
  }

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
    if (parseFloat(depositAmount) <= 0) return
    setPressed('deposit')
    try {
      if (needsApproval(depositAmount)) {
        approve(depositAmount)
        return
      }
      const ref =
        referrer && isAddress(referrer) ? (referrer as `0x${string}`) : zeroAddress
      deposit(depositAmount, ref)
    } finally {
      setTimeout(() => setPressed(null), 400)
    }
  }

  const handleWithdraw = () => {
    if (!withdrawShares || isBusy) return
    if (parseFloat(withdrawShares) <= 0) return
    setPressed('withdraw')
    try {
      withdraw(withdrawShares)
    } finally {
      setTimeout(() => setPressed(null), 400)
    }
  }

  const connecting = isConnectPending || accountConnecting || pressed === 'connect'

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6">
        <div className="flex flex-col items-center gap-8 w-full max-w-xs">
          <LogoMark size={48} />
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">Liquid Yield</h1>
            <p className="text-muted text-sm">Connect a wallet to use the vault</p>
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className={`w-full py-4 font-semibold rounded-xl transition-all flex items-center justify-center gap-2
              ${connecting
                ? 'bg-gold/70 text-black cursor-wait'
                : 'bg-gold text-black hover:bg-[#FFD21F] active:scale-[0.97] shadow-[0_0_24px_rgba(240,185,11,0.25)]'
              } disabled:opacity-70`}
          >
            {connecting ? (
              <>
                <Spinner />
                Connecting…
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>

          {!hasWallet && (
            <p className="text-xs text-muted-2 text-center leading-relaxed">
              No browser wallet detected. Install{' '}
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="text-gold underline"
              >
                MetaMask
              </a>{' '}
              or open this page inside your wallet app.
            </p>
          )}

          {connectError && (
            <p className="text-xs text-red-400 text-center">{connectError.shortMessage || connectError.message}</p>
          )}
        </div>

        {toast && (
          <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm shadow-lg border max-w-sm
              ${toast.kind === 'error' ? 'bg-[#1a0a0a] border-red-500/40 text-red-300' : ''}
              ${toast.kind === 'success' ? 'bg-[#0a1a0a] border-emerald-500/40 text-emerald-300' : ''}
              ${toast.kind === 'info' ? 'bg-[#111] border-white/10 text-white' : ''}
            `}
          >
            {toast.msg}
          </div>
        )}
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
            type="button"
            onClick={() => disconnect()}
            disabled={isDisconnecting}
            className="text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-full bg-white/5 active:scale-95 flex items-center gap-2"
          >
            {isDisconnecting ? <Spinner className="w-3 h-3" /> : null}
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        </div>
      </header>

      <main className="px-4 pb-8 max-w-lg mx-auto">
        <section className="py-8">
          <div className="text-center">
            <div className="text-xs text-muted mb-2 tracking-wider">YOUR BALANCE</div>
            <div className="text-4xl font-bold text-gold tracking-tight">
              ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted mt-2">{shares.toFixed(4)} GOLD</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-8">
            <div className="text-center rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">Share Price</div>
              <div className="text-base font-semibold text-white">${sharePrice.toFixed(4)}</div>
            </div>
            <div className="text-center rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">TVL</div>
              <div className="text-base font-semibold text-white">
                ${tvl.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">USDC</div>
              <div className="text-base font-semibold text-white">{balance.toFixed(2)}</div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">AMOUNT (USDC)</label>
          <div className="bg-white/5 rounded-xl p-4 focus-within:ring-1 focus-within:ring-gold/40 transition">
            <div className="flex items-center justify-between">
              <input
                type="number"
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                disabled={isBusy}
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                className="text-xs text-gold mr-2 font-semibold active:opacity-70"
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
          <div className="bg-white/5 rounded-xl p-3 mb-3 focus-within:ring-1 focus-within:ring-gold/40">
            <input
              type="text"
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="0x..."
              disabled={isBusy}
              className="bg-transparent text-sm text-white w-full focus:outline-none font-mono disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={handleDeposit}
            disabled={!depositAmount || isBusy || !!paused || parseFloat(depositAmount) <= 0}
            className="w-full mt-1 py-4 bg-gold text-black font-bold rounded-xl disabled:opacity-30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-[#FFD21F]"
          >
            {(isApproving || isDepositing) && <Spinner />}
            {paused
              ? 'Paused'
              : isApproving
              ? 'Approving…'
              : isDepositing
              ? 'Depositing…'
              : needsApproval(depositAmount) && parseFloat(depositAmount) > 0
              ? 'Approve USDC'
              : 'Deposit'}
          </button>
        </section>

        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">SHARES (GOLD)</label>
          <div className="bg-white/5 rounded-xl p-4 focus-within:ring-1 focus-within:ring-white/20">
            <div className="flex items-center justify-between">
              <input
                type="number"
                inputMode="decimal"
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder="0.00"
                disabled={isBusy}
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                className="text-xs text-gold mr-2 font-semibold active:opacity-70"
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
            type="button"
            onClick={handleWithdraw}
            disabled={!withdrawShares || isBusy || parseFloat(withdrawShares) <= 0}
            className="w-full mt-3 py-4 bg-white/5 text-white font-bold rounded-xl disabled:opacity-30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-white/10"
          >
            {isWithdrawing && <Spinner />}
            {isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
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
          <div className="text-xs text-muted font-mono">
            {address?.slice(0, 8)}…{address?.slice(-6)}
          </div>
        </section>
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm shadow-lg border max-w-sm
            ${toast.kind === 'error' ? 'bg-[#1a0a0a] border-red-500/40 text-red-300' : ''}
            ${toast.kind === 'success' ? 'bg-[#0a1a0a] border-emerald-500/40 text-emerald-300' : ''}
            ${toast.kind === 'info' ? 'bg-[#111] border-white/10 text-white' : ''}
          `}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
