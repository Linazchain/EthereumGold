'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { isAddress, zeroAddress } from 'viem'
import { useAssetPool } from '@/hooks/useAssetPool'
import { CONTRACTS } from '@/lib/contracts'

const EXPLORER = 'https://sepolia.etherscan.io'

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

function fmt(n: number, digits = 2) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export default function Terminal() {
  const { address, isConnected, isConnecting: accountConnecting } = useAccount()
  const { connect, connectors, isPending: isConnectPending, error: connectError, reset: resetConnect } =
    useConnect()
  const { disconnect, isPending: isDisconnecting } = useDisconnect()
  const p = useAssetPool()

  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawShares, setWithdrawShares] = useState('')
  const [referrer, setReferrer] = useState('')
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind; href?: string } | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const lastWriteError = useRef<string | null>(null)
  const lastSwitchError = useRef<string | null>(null)
  const pendingDepositAfterApprove = useRef(false)
  const autoSwitchAttempted = useRef(false)
  const depositAmountRef = useRef(depositAmount)
  const referrerRef = useRef(referrer)
  depositAmountRef.current = depositAmount
  referrerRef.current = referrer

  const showToast = useCallback((msg: string, kind: ToastKind = 'info', href?: string) => {
    setToast({ msg, kind, href })
  }, [])

  const ensureSepolia = useCallback(async () => {
    if (p.onSepolia) return true
    const ok = await p.switchToSepolia()
    if (!ok) {
      showToast(
        p.switchError || 'Could not switch to Sepolia — select it in your wallet',
        'error'
      )
      return false
    }
    return true
  }, [p, showToast])

  useEffect(() => {
    if (!p.writeError) {
      lastWriteError.current = null
      return
    }
    if (p.writeError === lastWriteError.current) return
    lastWriteError.current = p.writeError
    pendingDepositAfterApprove.current = false
    showToast(p.writeError, 'error')
  }, [p.writeError, showToast])

  useEffect(() => {
    if (!p.switchError) {
      lastSwitchError.current = null
      return
    }
    if (p.switchError === lastSwitchError.current) return
    lastSwitchError.current = p.switchError
    showToast(p.switchError, 'error')
  }, [p.switchError, showToast])

  useEffect(() => {
    if (!p.isApproved) return
    const amount = depositAmountRef.current
    const refRaw = referrerRef.current
    p.refetchAllowance().then(() => {
      p.resetApprove()
      if (pendingDepositAfterApprove.current && amount && parseFloat(amount) > 0) {
        pendingDepositAfterApprove.current = false
        const ref =
          refRaw && isAddress(refRaw) ? (refRaw as `0x${string}`) : zeroAddress
        showToast('USDC approved — depositing…', 'info')
        p.deposit(amount, ref)
      } else {
        showToast(
          'USDC approved',
          'success',
          p.approveHash ? `${EXPLORER}/tx/${p.approveHash}` : undefined
        )
      }
    })
  }, [p.isApproved])

  useEffect(() => {
    if (!p.isDeposited) return
    showToast(
      'Deposit confirmed',
      'success',
      p.depositHash ? `${EXPLORER}/tx/${p.depositHash}` : undefined
    )
    setDepositAmount('')
    pendingDepositAfterApprove.current = false
    p.refetchAll()
    p.resetDeposit()
  }, [p.isDeposited])

  useEffect(() => {
    if (!p.isWithdrawn) return
    showToast(
      'Withdrawal confirmed',
      'success',
      p.withdrawHash ? `${EXPLORER}/tx/${p.withdrawHash}` : undefined
    )
    setWithdrawShares('')
    p.refetchAll()
    p.resetWithdraw()
  }, [p.isWithdrawn])

  useEffect(() => {
    if (!p.isRegistered) return
    showToast(
      'Referral registered',
      'success',
      p.registerHash ? `${EXPLORER}/tx/${p.registerHash}` : undefined
    )
    p.refetchAll()
    p.resetRegister()
  }, [p.isRegistered])

  useEffect(() => {
    if (!connectError) return
    const msg = connectError.message || 'Failed'
    if (/rejected|denied|cancel/i.test(msg)) showToast('Connection rejected', 'error')
    else showToast(msg.slice(0, 120), 'error')
  }, [connectError, showToast])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // One auto-switch attempt per session when wrong network
  useEffect(() => {
    if (!isConnected || p.onSepolia || p.isSwitching || autoSwitchAttempted.current) return
    autoSwitchAttempted.current = true
    void (async () => {
      const ok = await p.switchToSepolia()
      if (!ok) {
        showToast(
          p.switchError || 'Could not auto-switch to Sepolia — use the button below',
          'error'
        )
      }
    })()
  }, [isConnected, p.onSepolia, p.isSwitching])

  useEffect(() => {
    if (p.onSepolia) autoSwitchAttempted.current = false
  }, [p.onSepolia])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search).get('ref')
    if (q && isAddress(q)) setReferrer(q)
  }, [])

  const hasWallet =
    typeof window !== 'undefined' &&
    !!(window as unknown as { ethereum?: unknown }).ethereum

  const handleConnect = async () => {
    resetConnect()
    setPressed('connect')
    try {
      if (!hasWallet) {
        showToast('No wallet detected', 'error')
        return
      }
      const c = connectors[0]
      if (!c) {
        showToast('No connector', 'error')
        return
      }
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

  const depositTooHigh = p.exceedsUsdcBalance(depositAmount)
  const withdrawTooHigh = p.exceedsShareBalance(withdrawShares)

  const handleDeposit = async () => {
    p.clearWriteErrors?.()
    if (!(await ensureSepolia())) return
    if (!depositAmount || p.isBusy || p.paused) return
    if (parseFloat(depositAmount) <= 0) {
      showToast('Enter an amount greater than 0', 'error')
      return
    }
    if (p.exceedsUsdcBalance(depositAmount)) {
      showToast('Amount exceeds your USDC balance', 'error')
      return
    }
    if (p.needsApproval(depositAmount)) {
      pendingDepositAfterApprove.current = true
      p.approve(depositAmount)
      return
    }
    const ref =
      referrer && isAddress(referrer) ? (referrer as `0x${string}`) : zeroAddress
    p.deposit(depositAmount, ref)
  }

  const handleWithdraw = async () => {
    p.clearWriteErrors?.()
    if (!(await ensureSepolia())) return
    if (!withdrawShares || p.isBusy) return
    if (parseFloat(withdrawShares) <= 0) {
      showToast('Enter shares greater than 0', 'error')
      return
    }
    if (p.exceedsShareBalance(withdrawShares)) {
      showToast('Amount exceeds your GOLD balance', 'error')
      return
    }
    p.withdraw(withdrawShares)
  }

  const handleRegister = async () => {
    p.clearWriteErrors?.()
    if (!(await ensureSepolia())) return
    if (!referrer || !isAddress(referrer)) {
      showToast('Enter a valid referrer address', 'error')
      return
    }
    if (address && referrer.toLowerCase() === address.toLowerCase()) {
      showToast('Cannot refer yourself', 'error')
      return
    }
    if (p.hasReferrer) {
      showToast('Referral already set (immutable)', 'error')
      return
    }
    p.registerReferral(referrer as `0x${string}`)
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
  const loadingBal = p.isLoadingBalances

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6">
        <div className="flex flex-col items-center gap-8 w-full max-w-xs">
          <LogoMark size={48} />
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">Liquid Yield</h1>
            <p className="text-muted text-sm">Sepolia · Referral Boost</p>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className={`w-full py-4 font-semibold rounded-xl flex items-center justify-center gap-2 ${
              connecting ? 'bg-gold/70 text-black' : 'bg-gold text-black hover:bg-[#FFD21F]'
            }`}
          >
            {connecting ? (
              <>
                <Spinner /> Connecting…
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>
        </div>
        {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
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
            className="text-xs text-muted px-3 py-1.5 rounded-full bg-white/5 flex items-center gap-2"
          >
            {isDisconnecting ? <Spinner className="w-3 h-3" /> : null}
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        </div>
      </header>

      {!p.onSepolia && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="rounded-xl border border-gold/30 bg-gold/10 p-4 flex flex-col gap-3">
            <p className="text-sm text-gold">
              Wrong network — switch to <strong>Sepolia</strong> (chain ID 11155111).
            </p>
            {p.switchError && (
              <p className="text-xs text-red-400">{p.switchError}</p>
            )}
            <button
              type="button"
              onClick={async () => {
                const ok = await p.switchToSepolia()
                if (!ok) {
                  showToast(
                    p.switchError ||
                      'Switch failed — open your wallet and select Sepolia manually',
                    'error'
                  )
                } else {
                  showToast('Switched to Sepolia', 'success')
                }
              }}
              disabled={p.isSwitching}
              className="py-3 bg-gold text-black font-bold rounded-xl flex items-center justify-center gap-2"
            >
              {p.isSwitching ? (
                <>
                  <Spinner /> Switching…
                </>
              ) : (
                'Switch to Sepolia'
              )}
            </button>
          </div>
        </div>
      )}

      <main className="px-4 pb-10 max-w-lg mx-auto">
        <section className="py-8 text-center">
          <div className="text-xs text-muted mb-1 tracking-wider">WITHDRAWABLE (ACTUAL)</div>
          <div className="text-[10px] text-muted-2 mb-2">Share value · not boost weight</div>
          <div className="text-4xl font-bold text-gold">
            {loadingBal ? (
              <span className="inline-flex items-center gap-2 text-2xl text-muted">
                <Spinner /> Loading…
              </span>
            ) : (
              `$${fmt(p.portfolioValue)}`
            )}
          </div>
          <div className="text-sm text-muted mt-2">
            {loadingBal ? '—' : `${p.shares.toFixed(4)} GOLD`}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-6">
            <div className="rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">Share Price</div>
              <div className="text-base font-semibold">
                {loadingBal ? '…' : `$${p.sharePrice.toFixed(4)}`}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">TVL</div>
              <div className="text-base font-semibold">
                {loadingBal ? '…' : `$${fmt(p.tvl, 0)}`}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] py-3">
              <div className="text-xs text-muted-2 mb-1">Wallet USDC</div>
              <div className="text-base font-semibold">
                {loadingBal ? '…' : fmt(p.balance)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => p.refetchAll()}
            className="mt-3 text-xs text-muted hover:text-gold"
          >
            Refresh
          </button>
        </section>

        <section className="mb-8 rounded-xl border border-gold/20 bg-gradient-to-b from-gold/10 to-transparent p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted tracking-wider">REFERRAL STATUS</div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-muted">
              {p.isReferred
                ? 'Referred (10× new deposits)'
                : p.isReferrer
                  ? 'Referrer (5×)'
                  : 'Normal (1×)'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-gold">{p.boostLabel}</span>
            <span className="text-sm text-muted">{p.boostPct} on new positions</span>
          </div>
          <div className="rounded-lg bg-black/30 p-3 space-y-2 text-xs">
            <div className="flex justify-between text-muted">
              <span>Virtual payout weight</span>
              <span className="text-white font-medium">
                {loadingBal ? '…' : `$${fmt(p.payoutWeight)}`}
              </span>
            </div>
            <p className="text-[10px] text-muted-2 leading-relaxed">
              Weight is for ranking / future yield share only. It does{' '}
              <span className="text-gold">not</span> increase what you can withdraw.
              Withdrawable amount is always your GOLD × share price (minus 1% fee).
            </p>
            <div className="flex justify-between text-muted pt-1">
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
                <a
                  className="text-gold font-mono"
                  href={`${EXPLORER}/address/${p.myReferrer}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.myReferrer.slice(0, 6)}…{p.myReferrer.slice(-4)}
                </a>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={copyLink}
            className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10"
          >
            {copied ? 'Copied ✓' : 'Copy my referral link'}
          </button>

          {!p.hasReferrer ? (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <label className="block text-xs text-muted">
                Referrer (optional) — used for register & deposit
              </label>
              <div className="bg-black/40 rounded-lg p-3">
                <input
                  type="text"
                  value={referrer}
                  onChange={(e) => setReferrer(e.target.value)}
                  placeholder="0x…"
                  disabled={p.isBusy || !p.onSepolia}
                  className="bg-transparent text-sm text-white w-full focus:outline-none font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleRegister}
                disabled={!p.onSepolia || p.isBusy || !referrer || !isAddress(referrer)}
                className="w-full py-3 rounded-lg bg-gold/90 text-black font-semibold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {p.isRegistering && <Spinner />}
                {p.isRegistering ? 'Registering…' : 'Register referral only'}
              </button>
              <p className="text-[10px] text-muted-2">
                Or leave the address filled and deposit — referral locks on deposit if not set yet.
              </p>
            </div>
          ) : (
            <div className="pt-2 border-t border-white/5 text-xs text-muted">
              Referral locked — cannot be changed.
            </div>
          )}
        </section>

        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">AMOUNT (USDC)</label>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                disabled={p.isBusy || !p.onSepolia}
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none"
              />
              <button
                type="button"
                className="text-xs text-gold mr-2"
                onClick={() => setDepositAmount(p.balance > 0 ? String(p.balance) : '')}
              >
                MAX
              </button>
              <span className="text-sm text-muted">USDC</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Fee: {(p.depositFee / 100).toFixed(2)}%</span>
              <span>Receive: {depositPreview.toFixed(4)} GOLD</span>
            </div>
            {parseFloat(depositAmount) > 0 && (
              <div className="flex justify-between mt-1 text-xs text-gold/80">
                <span>Est. virtual weight ({p.boostLabel})</span>
                <span>${fmt(estWeight)}</span>
              </div>
            )}
            {depositTooHigh && (
              <p className="mt-2 text-xs text-red-400">Exceeds your USDC balance</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleDeposit}
            disabled={
              !p.onSepolia ||
              !depositAmount ||
              p.isBusy ||
              !!p.paused ||
              parseFloat(depositAmount) <= 0 ||
              depositTooHigh
            }
            className="w-full mt-3 py-4 bg-gold text-black font-bold rounded-xl disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {(p.isApproving || p.isDepositing) && <Spinner />}
            {!p.onSepolia
              ? 'Switch network'
              : p.paused
                ? 'Paused'
                : depositTooHigh
                  ? 'Insufficient USDC'
                  : p.isApproving
                    ? 'Approving…'
                    : p.isDepositing
                      ? 'Depositing…'
                      : p.needsApproval(depositAmount) && parseFloat(depositAmount) > 0
                        ? 'Approve & Deposit'
                        : 'Deposit'}
          </button>
        </section>

        <section className="mb-8">
          <label className="block text-xs text-muted mb-2">SHARES (GOLD)</label>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                inputMode="decimal"
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder="0.00"
                disabled={p.isBusy || !p.onSepolia}
                className="bg-transparent text-2xl font-semibold text-white w-full focus:outline-none"
              />
              <button
                type="button"
                className="text-xs text-gold mr-2"
                onClick={() => setWithdrawShares(p.shares > 0 ? String(p.shares) : '')}
              >
                MAX
              </button>
              <span className="text-sm text-muted">GOLD</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Fee: {(p.withdrawFee / 100).toFixed(2)}%</span>
              <span>Receive: ${withdrawPreview.toFixed(2)}</span>
            </div>
            {withdrawTooHigh && (
              <p className="mt-2 text-xs text-red-400">Exceeds your GOLD balance</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={
              !p.onSepolia ||
              !withdrawShares ||
              p.isBusy ||
              parseFloat(withdrawShares) <= 0 ||
              withdrawTooHigh
            }
            className="w-full mt-3 py-4 bg-white/5 text-white font-bold rounded-xl disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {p.isWithdrawing && <Spinner />}
            {withdrawTooHigh
              ? 'Insufficient GOLD'
              : p.isWithdrawing
                ? 'Withdrawing…'
                : 'Withdraw'}
          </button>
        </section>

        <section className="flex items-center justify-between py-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                !p.onSepolia
                  ? 'bg-red-400'
                  : p.paused
                    ? 'bg-muted-2'
                    : p.yieldActive
                      ? 'bg-gold animate-pulse'
                      : 'bg-muted-2'
              }`}
            />
            <span className="text-xs text-muted">
              {!p.onSepolia
                ? 'Wrong network'
                : `Yield ${p.paused ? 'Paused' : p.yieldActive ? 'Active' : 'Inactive'} · Sepolia`}
            </span>
          </div>
          <a
            className="text-xs text-muted hover:text-gold font-mono"
            href={`${EXPLORER}/address/${CONTRACTS.assetPool}`}
            target="_blank"
            rel="noreferrer"
          >
            Pool ↗
          </a>
        </section>
      </main>

      {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

function ToastBanner({
  toast,
  onClose,
}: {
  toast: { msg: string; kind: ToastKind; href?: string }
  onClose: () => void
}) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm border max-w-sm shadow-lg ${
        toast.kind === 'error'
          ? 'bg-[#1a0a0a] border-red-500/40 text-red-300'
          : toast.kind === 'success'
            ? 'bg-[#0a1a0a] border-emerald-500/40 text-emerald-300'
            : 'bg-[#111] border-white/10 text-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div>{toast.msg}</div>
          {toast.href && (
            <a
              href={toast.href}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] underline opacity-80 hover:opacity-100 mt-1 inline-block"
            >
              View on Etherscan ↗
            </a>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-xs opacity-60 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  )
}
