'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { isAddress, zeroAddress } from 'viem'
import { useAssetPool } from '@/hooks/useAssetPool'
import { CONTRACTS } from '@/lib/contracts'

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
    <span className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} aria-hidden />
  )
}
type ToastKind = 'success' | 'error' | 'info'

export default function Terminal() {
  const { address, isConnected, isConnecting: accountConnecting } = useAccount()
  const { connect, connectors, isPending: isConnectPending, error: connectError, reset: resetConnect } = useConnect()
  const { disconnect, isPending: isDisconnecting } = useDisconnect()
  const p = useAssetPool()

  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawShares, setWithdrawShares] = useState('')
  const [referrer, setReferrer] = useState('')
  const [registerRef, setRegisterRef] = useState('')
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const showToast = useCallback((msg: string, kind: ToastKind = 'info') => setToast({ msg, kind }), [])

  useEffect(() => {
    if (p.isApproved) { showToast('USDC approved', 'success'); p.refetchAllowance(); p.resetApprove() }
  }, [p.isApproved])
  useEffect(() => {
    if (p.isDeposited) { showToast('Deposit confirmed', 'success'); setDepositAmount(''); p.refetchAll(); p.resetDeposit() }
  }, [p.isDeposited])
  useEffect(() => {
    if (p.isWithdrawn) { showToast('Withdrawal confirmed', 'success'); setWithdrawShares(''); p.refetchAll(); p.resetWithdraw() }
  }, [p.isWithdrawn])
  useEffect(() => {
    if (p.isRegistered) { showToast('Referral registered', 'success'); setRegisterRef(''); p.refetchAll(); p.resetRegister() }
  }, [p.isRegistered])
  useEffect(() => {
    if (!connectError) return
    const msg = connectError.message || 'Failed'
    if (/rejected|denied|cancel/i.test(msg)) showToast('Connection rejected', 'error')
    else showToast(msg.slice(0, 120), 'error')
  }, [connectError])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (isConnected && !p.onSepolia && !p.isSwitching) {
      try { p.switchToSepolia() } catch {}
    }
  }, [isConnected, p.onSepolia, p.isSwitching])

  // Prefill referrer from ?ref=0x...
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search).get('ref')
    if (q && isAddress(q)) {
      setReferrer(q)
      setRegisterRef(q)
    }
  }, [])

  const hasWallet = typeof window !== 'undefined' && !!(window as unknown as { ethereum?: unknown }).ethereum
  const handleConnect = async () => {
    resetConnect(); setPressed('connect')
    try {
      if (!hasWallet) { showToast('No wallet detected', 'error'); return }
      const c = connectors[0]
      if (!c) { showToast('No connector', 'error'); return }
      await connect({ connector: c })
    } catch (e) {
      showToast((e as Error)?.message?.slice(0, 120) || 'Connect failed', 'error')
    } finally {
      setPressed(null)
    }
  }

  const depositPreview =
    parseFloat(depositAmount) > 0 && p.sharePrice > 0
      ? (parseFloat(depositAmount) / p.sharePrice) * (1 - p.depositFee / 10000)
      : 0
  const withdrawPreview =
    parseFloat(withdrawShares) > 0
      ? parseFloat(withdrawShares) * p.sharePrice * (1 - p.withdrawFee / 10000)
      : 0
  const estWeight =
    parseFloat(depositAmount) > 0
      ? (parseFloat(depositAmount) * (1 - p.depositFee / 10000) * p.multiplierBps) / 10000
      : 0

  const handleDeposit = () => {
    if (!p.onSepolia) { p.switchToSepolia(); showToast('Switch to Sepolia', 'error'); return }
    if (!depositAmount || p.isBusy || p.paused || parseFloat(depositAmount) <= 0) return
    if (p.needsApproval(depositAmount)) { p.approve(depositAmount); return }
    const ref = referrer && isAddress(referrer) ? (referrer as `0x${string}`) : zeroAddress
    p.deposit(depositAmount, ref)
  }
  const handleWithdraw = () => {
    if (!p.onSepolia) { p.switchToSepolia(); showToast('Switch to Sepolia', 'error'); return }
    if (!withdrawShares || p.isBusy || parseFloat(withdrawShares) <= 0) return
    p.withdraw(withdrawShares)
  }
  const handleRegister = () => {
    if (!p.onSepolia) { p.switchToSepolia(); showToast('Switch to Sepolia', 'error'); return }
    if (!registerRef || !isAddress(registerRef)) { showToast('Enter a valid referrer address', 'error'); return }
    if (address && registerRef.toLowerCase() === address.toLowerCase()) {
      showToast('Cannot refer yourself', 'error'); return
    }
    if (p.hasReferrer) { showToast('Referral already set (immutable)', 'error'); return }
    p.registerReferral(registerRef as `0x${string}`)
  }
  const copyLink = async () => {
    if (!address) return
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${address}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      showToast('Referral link copied', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Copy failed', 'error')
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
            <p className="text-muted text-sm">Sepolia · Referral Boost</p>
          </div>
          <button type="button" onClick={handleConnect} disabled={connecting}
            className={`w-full py-4 font-semibold rounded-xl flex items-center justify-center gap-2 ${
              connecting ? 'bg-gold/70 text-black' : 'bg-gold text-black hover:bg-[#FFD21F]'
            }`}>
            {connecting ? <><Spinner /> Connecting…</> : 'Connect Wallet'}
          </button>
        </div>
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm border bg-[#111] border-white/10">{toast.msg}</div>
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
          <button type="button" onClick={() => disconnect()} disabled={isDisconnecting}
            className="text-xs text-muted px-3 py-1.5 rounded-full bg-white/5 flex items-center gap-2">
            {isDisconnecting ? <Spinner className="w-3 h-3" /> : null}
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        </div>
      </header>

      {!p.onSepolia && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="rounded-xl border border-gold/30 bg-gold/10 p-4 flex flex-col gap-3">
            <p className="text-sm text-gold">Wrong network — switch to <strong>Sepolia</strong>.</p>
            <button type="button" onClick={() => p.switchToSepolia()} disabled={p.isSwitching}
              className="py-3 bg-gold text-black font-bold rounded-xl flex items-center justify-center gap-2">
              {p.isSwitching ? <><Spinner /> Switching…</> : 'Switch to Sepolia'}
            </button>
          </div>
        </div>
      )}

      <main className="px-4 pb-10 max-w-lg mx-auto">
        {/* Actual balance */}
        <section className="py-8 text-center">
          <div className="text-xs text-muted mb-2 tracking-wider">ACTUAL BALANCE</div>
          <div className="text-4xl font-bold text-gold">
            ${p.portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-muted mt-2">{p.shares.toFixed(4)} GOLD</div>
          <div className="grid grid-cols-3 gap-2 mt-6">
            <div className="rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">Share Price</div>
              <div className="text-base font-semibold">${p.sharePrice.toFixed(4)}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">TVL</div>
              <div className="text-base font-semibold">${p.tvl.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">USDC</div>
              <div className="text-base font-semibold">{p.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          <button type="button" onClick={() => p.refetchAll()} className="mt-3 text-xs text-muted hover:text-gold">Refresh</button>
        </section>

        {/* Referral Boost panel */}
        <section className="mb-8 rounded-xl border border-gold/20 bg-gradient-to-b from-gold/10 to-transparent p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted tracking-wider">REFERRAL BOOST</div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-muted">
              {p.isReferred ? 'Referred' : p.isReferrer ? 'Referrer' : 'Normal'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-gold">{p.boostLabel}</span>
            <span className="text-sm text-muted">{p.boostPct}</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-muted">
              <span>Payout weight (virtual)</span>
              <span className="text-white font-medium">${p.payoutWeight.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Positions</span>
              <span className="text-white">{p.positionCount}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>People you referred</span>
              <span className="text-white">{p.referralCount}</span>
            </div>
            {p.hasReferrer && p.myReferrer && (
              <div className="flex justify-between text-muted">
                <span>Your referrer</span>
                <a className="text-gold font-mono" href={`https://sepolia.etherscan.io/address/${p.myReferrer}`} target="_blank" rel="noreferrer">
                  {p.myReferrer.slice(0, 6)}…{p.myReferrer.slice(-4)}
                </a>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-2 leading-relaxed">
            Boost is virtual payout weight only. It does not change withdrawable principal or the 1% fees.
            1× normal · 5× if you referred someone · 10× if you were referred.
          </p>

          {/* Copy invite link */}
          <button type="button" onClick={copyLink}
            className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 flex items-center justify-center gap-2">
            {copied ? 'Copied ✓' : 'Copy my referral link'}
          </button>

          {/* Register referrer (standalone) */}
          {!p.hasReferrer ? (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <label className="block text-xs text-muted">Register a referrer (before or with deposit)</label>
              <div className="bg-black/40 rounded-lg p-3">
                <input
                  type="text"
                  value={registerRef}
                  onChange={(e) => setRegisterRef(e.target.value)}
                  placeholder="0x referrer address"
                  disabled={p.isBusy || !p.onSepolia}
                  className="bg-transparent text-sm text-white w-full focus:outline-none font-mono"
                />
              </div>
              <button type="button" onClick={handleRegister}
                disabled={!p.onSepolia || p.isBusy || !registerRef || !isAddress(registerRef)}
                className="w-full py-3 rounded-lg bg-gold/90 text-black font-semibold text-sm disabled:opacity-30 flex items-center justify-center gap-2">
                {p.isRegistering && <Spinner />}
                {p.isRegistering ? 'Registering…' : 'Register referral'}
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-white/5 text-xs text-muted">
              Referral locked — cannot be changed.
            </div>
          )}
        </section>

        {/* Deposit */}
        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">AMOUNT (USDC)</label>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <input type="number" inputMode="decimal" value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00"
                disabled={p.isBusy || !p.onSepolia}
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none" />
              <button type="button" className="text-xs text-gold mr-2"
                onClick={() => setDepositAmount(p.balance > 0 ? String(p.balance) : '')}>MAX</button>
              <span className="text-sm text-muted">USDC</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Fee: {(p.depositFee / 100).toFixed(2)}%</span>
              <span>Receive: {depositPreview.toFixed(4)} GOLD</span>
            </div>
            {parseFloat(depositAmount) > 0 && (
              <div className="flex justify-between mt-1 text-xs text-gold/80">
                <span>Est. payout weight ({p.boostLabel})</span>
                <span>${estWeight.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          {!p.hasReferrer && (
            <>
              <label className="block text-xs text-muted mb-2 mt-4">REFERRER ON DEPOSIT (optional)</label>
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                <input type="text" value={referrer} onChange={(e) => setReferrer(e.target.value)}
                  placeholder="0x... — locks 10× for new positions"
                  disabled={p.isBusy || !p.onSepolia}
                  className="bg-transparent text-sm text-white w-full focus:outline-none font-mono" />
              </div>
            </>
          )}

          <button type="button" onClick={handleDeposit}
            disabled={!p.onSepolia || !depositAmount || p.isBusy || !!p.paused || parseFloat(depositAmount) <= 0}
            className="w-full mt-1 py-4 bg-gold text-black font-bold rounded-xl disabled:opacity-30 flex items-center justify-center gap-2">
            {(p.isApproving || p.isDepositing) && <Spinner />}
            {!p.onSepolia ? 'Switch network'
              : p.paused ? 'Paused'
              : p.isApproving ? 'Approving…'
              : p.isDepositing ? 'Depositing…'
              : p.needsApproval(depositAmount) && parseFloat(depositAmount) > 0 ? 'Approve USDC'
              : 'Deposit'}
          </button>
        </section>

        {/* Withdraw */}
        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">SHARES (GOLD)</label>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <input type="number" inputMode="decimal" value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)} placeholder="0.00"
                disabled={p.isBusy || !p.onSepolia}
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none" />
              <button type="button" className="text-xs text-gold mr-2"
                onClick={() => setWithdrawShares(p.shares > 0 ? String(p.shares) : '')}>MAX</button>
              <span className="text-sm text-muted">GOLD</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Fee: {(p.withdrawFee / 100).toFixed(2)}%</span>
              <span>Receive: ${withdrawPreview.toFixed(2)}</span>
            </div>
          </div>
          <button type="button" onClick={handleWithdraw}
            disabled={!p.onSepolia || !withdrawShares || p.isBusy || parseFloat(withdrawShares) <= 0}
            className="w-full mt-3 py-4 bg-white/5 text-white font-bold rounded-xl disabled:opacity-30 flex items-center justify-center gap-2">
            {p.isWithdrawing && <Spinner />}
            {p.isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
          </button>
        </section>

        <section className="flex items-center justify-between py-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${!p.onSepolia ? 'bg-red-400' : p.paused ? 'bg-muted-2' : p.yieldActive ? 'bg-gold animate-pulse' : 'bg-muted-2'}`} />
            <span className="text-xs text-muted">
              {!p.onSepolia ? 'Wrong network' : `Yield ${p.paused ? 'Paused' : p.yieldActive ? 'Active' : 'Inactive'} · Sepolia`}
            </span>
          </div>
          <a className="text-xs text-muted hover:text-gold font-mono"
            href={`https://sepolia.etherscan.io/address/${CONTRACTS.assetPool}`}
            target="_blank" rel="noreferrer">Pool ↗</a>
        </section>
      </main>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm border max-w-sm ${
          toast.kind === 'error' ? 'bg-[#1a0a0a] border-red-500/40 text-red-300'
            : toast.kind === 'success' ? 'bg-[#0a1a0a] border-emerald-500/40 text-emerald-300'
            : 'bg-[#111] border-white/10 text-white'
        }`}>{toast.msg}</div>
      )}
    </div>
  )
}
