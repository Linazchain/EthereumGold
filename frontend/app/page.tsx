'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, formatUnits, zeroAddress, isAddress } from 'viem';
import {
  LOCAL_CONTRACTS,
  ASSET_POOL_ABI,
  ERC20_ABI,
  REFERRAL_REGISTRY_ABI,
} from '../lib/contracts';

const DECIMALS = 18;

function formatNum(val: bigint | undefined, decimals = 4): string {
  if (val === undefined) return '—';
  const n = Number(formatUnits(val, DECIMALS));
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}

function formatUsd(val: bigint | undefined): string {
  if (val === undefined) return '$0.00';
  const n = Number(formatUnits(val, DECIMALS));
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncate(addr?: string) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');
  const [referrer, setReferrer] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // ─── Reads ───────────────────────────────────────────────
  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'totalAssets',
  });

  const { data: pricePerShare, refetch: refetchPrice } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'pricePerShare',
  });

  const { data: depositFeeBps } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'depositFeeBps',
  });

  const { data: withdrawFeeBps } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'withdrawFeeBps',
  });

  const { data: shareTokenAddr } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'shareToken',
  });

  const { data: yieldAdapter } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'yieldAdapter',
  });

  const { data: isPaused } = useReadContract({
    address: LOCAL_CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'paused',
  });

  const { data: userUsdc, refetch: refetchUsdc } = useReadContract({
    address: LOCAL_CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: LOCAL_CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, LOCAL_CONTRACTS.assetPool] : undefined,
  });

  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: shareTokenAddr as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address && shareTokenAddr ? [address] : undefined,
  });

  const { data: totalShares } = useReadContract({
    address: shareTokenAddr as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
  });

  const { data: myReferrer } = useReadContract({
    address: LOCAL_CONTRACTS.referralRegistry,
    abi: REFERRAL_REGISTRY_ABI,
    functionName: 'referrerOf',
    args: address ? [address] : undefined,
  });

  // ─── Writes ──────────────────────────────────────────────
  const {
    writeContract: approveWrite,
    data: approveHash,
    isPending: isApproving,
    reset: resetApprove,
  } = useWriteContract();

  const {
    writeContract: depositWrite,
    data: depositHash,
    isPending: isDepositing,
    reset: resetDeposit,
  } = useWriteContract();

  const {
    writeContract: withdrawWrite,
    data: withdrawHash,
    isPending: isWithdrawing,
    reset: resetWithdraw,
  } = useWriteContract();

  const { isLoading: isConfirmingApprove, isSuccess: isApproved } =
    useWaitForTransactionReceipt({ hash: approveHash });

  const { isLoading: isConfirmingDeposit, isSuccess: isDeposited } =
    useWaitForTransactionReceipt({ hash: depositHash });

  const { isLoading: isConfirmingWithdraw, isSuccess: isWithdrawn } =
    useWaitForTransactionReceipt({ hash: withdrawHash });

  // Refetch + toast after successful txs
  useEffect(() => {
    if (isApproved) {
      showToast('USDC approved successfully', 'success');
      refetchAllowance();
      resetApprove();
    }
  }, [isApproved]);

  useEffect(() => {
    if (isDeposited) {
      showToast('Deposit confirmed!', 'gold');
      refetchUsdc();
      refetchShares();
      refetchTotalAssets();
      refetchPrice();
      refetchAllowance();
      setDepositAmount('');
      resetDeposit();
    }
  }, [isDeposited]);

  useEffect(() => {
    if (isWithdrawn) {
      showToast('Withdrawal confirmed!', 'gold');
      refetchUsdc();
      refetchShares();
      refetchTotalAssets();
      refetchPrice();
      setWithdrawShares('');
      resetWithdraw();
    }
  }, [isWithdrawn]);

  function showToast(msg: string, type: string) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ─── Derived values ──────────────────────────────────────
  const depositFeePct = depositFeeBps !== undefined ? Number(depositFeeBps) / 100 : 1;
  const withdrawFeePct = withdrawFeeBps !== undefined ? Number(withdrawFeeBps) / 100 : 1;

  const depositCalc = useMemo(() => {
    const amt = parseFloat(depositAmount) || 0;
    if (amt <= 0 || !pricePerShare) return { receive: 0, fee: 0 };
    const fee = amt * (Number(depositFeeBps || 100n) / 10000);
    const net = amt - fee;
    const pps = Number(formatUnits(pricePerShare, DECIMALS));
    const shares = pps > 0 ? net / pps : net;
    return { receive: shares, fee };
  }, [depositAmount, pricePerShare, depositFeeBps]);

  const withdrawCalc = useMemo(() => {
    const sh = parseFloat(withdrawShares) || 0;
    if (sh <= 0 || !pricePerShare) return { receive: 0, fee: 0 };
    const pps = Number(formatUnits(pricePerShare, DECIMALS));
    const gross = sh * pps;
    const fee = gross * (Number(withdrawFeeBps || 100n) / 10000);
    return { receive: gross - fee, fee };
  }, [withdrawShares, pricePerShare, withdrawFeeBps]);

  const needsApproval = useMemo(() => {
    if (!depositAmount || !allowance) return true;
    try {
      return allowance < parseUnits(depositAmount || '0', DECIMALS);
    } catch {
      return true;
    }
  }, [depositAmount, allowance]);

  const portfolioValue =
    userShares && pricePerShare
      ? (Number(formatUnits(userShares, DECIMALS)) *
          Number(formatUnits(pricePerShare, DECIMALS)))
      : 0;

  const yieldActive = yieldAdapter && yieldAdapter !== zeroAddress;

  // ─── Handlers ────────────────────────────────────────────
  const handleApprove = () => {
    if (!depositAmount || !isConnected) return;
    approveWrite({
      address: LOCAL_CONTRACTS.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [LOCAL_CONTRACTS.assetPool, parseUnits(depositAmount, DECIMALS)],
    });
  };

  const handleDeposit = () => {
    if (!depositAmount || !isConnected) return;
    const ref =
      referrer && isAddress(referrer)
        ? (referrer as `0x${string}`)
        : zeroAddress;
    depositWrite({
      address: LOCAL_CONTRACTS.assetPool,
      abi: ASSET_POOL_ABI,
      functionName: 'deposit',
      args: [parseUnits(depositAmount, DECIMALS), ref],
    });
  };

  const handleWithdraw = () => {
    if (!withdrawShares || !isConnected) return;
    withdrawWrite({
      address: LOCAL_CONTRACTS.assetPool,
      abi: ASSET_POOL_ABI,
      functionName: 'withdraw',
      args: [parseUnits(withdrawShares, DECIMALS)],
    });
  };

  const setMaxDeposit = () => {
    if (userUsdc) setDepositAmount(formatUnits(userUsdc, DECIMALS));
  };

  const setMaxWithdraw = () => {
    if (userShares) setWithdrawShares(formatUnits(userShares, DECIMALS));
  };

  const isBusy =
    isApproving ||
    isDepositing ||
    isWithdrawing ||
    isConfirmingApprove ||
    isConfirmingDeposit ||
    isConfirmingWithdraw;

  // ─── Render ──────────────────────────────────────────────
  return (
    <>
      <style jsx global>{`
        .eg-container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
        .eg-header {
          position: sticky; top: 0; z-index: 100;
          background: rgba(10,10,10,0.92); backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border); padding: 16px 0;
        }
        .eg-header-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .eg-logo { display: flex; align-items: center; gap: 10px; }
        .eg-logo-mark {
          width: 32px; height: 32px; border-radius: 6px;
          background: linear-gradient(135deg, var(--gold), #8B6914);
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; font-size: 15px; color: var(--black);
        }
        .eg-logo-text { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
        .eg-logo-text span { color: var(--gold); }
        .eg-network {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px;
          font-size: 12px; font-weight: 500; color: var(--muted); background: var(--surface);
        }
        .eg-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--success);
          animation: eg-pulse 2s infinite;
        }
        @keyframes eg-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .eg-btn-connect {
          padding: 8px 16px; border: 1px solid var(--gold); border-radius: 6px;
          background: transparent; color: var(--gold); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: var(--transition);
        }
        .eg-btn-connect:hover { background: var(--gold); color: var(--black); box-shadow: 0 0 20px var(--gold-glow); }
        .eg-btn-connect.connected {
          border-color: var(--border); color: var(--muted); background: var(--surface);
        }
        .eg-main { padding: 32px 0 64px; display: flex; flex-direction: column; gap: 28px; }
        .eg-section-label {
          font-size: 11px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase;
          color: var(--muted-2); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
        }
        .eg-section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .eg-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 28px; transition: var(--transition);
        }
        .eg-portfolio-top { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px; margin-bottom: 24px; }
        .eg-portfolio-value { font-size: 48px; font-weight: 800; letter-spacing: -1.5px; color: var(--gold); line-height: 1.1; }
        .eg-shares-value { font-size: 24px; font-weight: 700; }
        .eg-shares-value .unit { font-size: 14px; font-weight: 500; color: var(--muted); }
        .eg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; padding-top: 20px; border-top: 1px solid var(--border); }
        .eg-stat-label { font-size: 11px; font-weight: 500; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.6px; }
        .eg-stat-value { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
        .eg-stat-value.gold { color: var(--gold); }
        .eg-vault-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 768px) { .eg-vault-actions { grid-template-columns: 1fr; } .eg-portfolio-value { font-size: 36px; } }
        .eg-panel {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 24px; display: flex; flex-direction: column; gap: 16px;
        }
        .eg-panel:hover { border-color: var(--border-hover); }
        .eg-panel-title { font-size: 16px; font-weight: 700; }
        .eg-panel-title.gold { color: var(--gold); }
        .eg-badge {
          font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 4px;
          letter-spacing: 0.5px; text-transform: uppercase;
        }
        .eg-badge.deposit { background: rgba(240,185,11,0.1); color: var(--gold); }
        .eg-badge.withdraw { background: rgba(140,140,140,0.1); color: var(--muted); }
        .eg-input-label { font-size: 12px; font-weight: 500; color: var(--muted); display: flex; justify-content: space-between; }
        .eg-balance-link { font-size: 11px; color: var(--muted-2); cursor: pointer; }
        .eg-balance-link:hover { color: var(--gold); }
        .eg-input-wrap {
          display: flex; align-items: center; gap: 8px;
          background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px;
          padding: 0 14px; transition: var(--transition);
        }
        .eg-input-wrap:focus-within { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold-glow); }
        .eg-input {
          flex: 1; background: transparent; border: none; color: var(--white);
          font-size: 18px; font-weight: 600; padding: 12px 0; outline: none; min-width: 0;
        }
        .eg-input::placeholder { color: var(--muted-2); font-weight: 400; font-size: 15px; }
        .eg-symbol {
          font-size: 13px; font-weight: 600; color: var(--muted); padding: 4px 8px;
          background: var(--surface-3); border-radius: 4px;
        }
        .eg-symbol.gold { color: var(--gold); background: rgba(240,185,11,0.08); }
        .eg-fee-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
        .eg-receive {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 14px; background: var(--surface-2); border: 1px solid var(--border);
          border-radius: 6px; font-size: 13px; color: var(--muted);
        }
        .eg-receive-amt { font-weight: 700; font-size: 16px; color: var(--white); }
        .eg-receive-amt.gold { color: var(--gold); }
        .eg-btn {
          padding: 12px 16px; border: none; border-radius: 6px; font-size: 14px; font-weight: 700;
          cursor: pointer; transition: var(--transition); width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .eg-btn.gold { background: var(--gold); color: var(--black); }
        .eg-btn.gold:hover:not(:disabled) { background: #FFD21F; box-shadow: 0 0 30px var(--gold-glow); transform: translateY(-1px); }
        .eg-btn.outline { background: transparent; border: 1px solid var(--gold); color: var(--gold); }
        .eg-btn.outline:hover:not(:disabled) { background: rgba(240,185,11,0.08); }
        .eg-btn.neutral { background: var(--surface-3); color: var(--muted); border: 1px solid var(--border); }
        .eg-btn.neutral:hover:not(:disabled) { border-color: var(--border-hover); color: var(--white); }
        .eg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .eg-spinner {
          width: 16px; height: 16px; border: 2px solid currentColor; border-top-color: transparent;
          border-radius: 50%; animation: eg-spin 0.7s linear infinite;
        }
        @keyframes eg-spin { to { transform: rotate(360deg); } }
        .eg-yield-status {
          display: flex; align-items: center; gap: 10px; padding-top: 16px;
          border-top: 1px solid var(--border); font-size: 13px; color: var(--muted);
        }
        .eg-yield-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .eg-yield-dot.active { background: var(--gold); animation: eg-pulse 2s infinite; }
        .eg-yield-dot.inactive { background: var(--muted-2); }
        .eg-toast {
          position: fixed; bottom: 24px; right: 24px; z-index: 1000;
          background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px;
          padding: 12px 16px; font-size: 13px; font-weight: 500;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 10px;
          min-width: 260px; animation: eg-toast-in 0.3s ease-out;
        }
        .eg-toast.success { border-left: 3px solid var(--success); }
        .eg-toast.gold { border-left: 3px solid var(--gold); }
        .eg-toast.error { border-left: 3px solid var(--danger); }
        @keyframes eg-toast-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .eg-footer {
          border-top: 1px solid var(--border); padding: 24px 0; text-align: center;
          font-size: 12px; color: var(--muted-2);
        }
        .eg-footer a { color: var(--muted); text-decoration: none; margin: 0 8px; }
        .eg-footer a:hover { color: var(--gold); }
        .eg-ref-note { font-size: 11px; color: var(--muted-2); margin-top: -8px; }
      `}</style>

      {/* Header */}
      <header className="eg-header">
        <div className="eg-container eg-header-inner">
          <div className="eg-logo">
            <div className="eg-logo-mark">AU</div>
            <div className="eg-logo-text">
              Ethereum <span>Gold</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="eg-network">
              <span className="eg-dot" />
              <span>Local / Mainnet</span>
            </div>
            {isConnected ? (
              <button className="eg-btn-connect connected" onClick={() => disconnect()}>
                {truncate(address)}
              </button>
            ) : (
              <button
                className="eg-btn-connect"
                onClick={() => connect({ connector: connectors[0] })}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="eg-main">
        <div className="eg-container">
          {/* Portfolio */}
          <section className="eg-card">
            <div className="eg-section-label">Your Portfolio</div>
            <div className="eg-portfolio-top">
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Total Value</div>
                <div className="eg-portfolio-value">
                  {isConnected ? formatUsd(undefined) /* computed below */ : '$0.00'}
                  {isConnected && (
                    <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--gold)' }}>
                      ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Your Shares</div>
                <div className="eg-shares-value">
                  {isConnected ? formatNum(userShares) : '0.000'}{' '}
                  <span className="unit">GOLD</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 4 }}>
                  {isConnected ? truncate(address) : 'Not connected'}
                </div>
              </div>
            </div>
            <div className="eg-grid">
              <div>
                <div className="eg-stat-label">Share Price</div>
                <div className="eg-stat-value gold">{formatUsd(pricePerShare)}</div>
              </div>
              <div>
                <div className="eg-stat-label">Pool TVL</div>
                <div className="eg-stat-value">{formatUsd(totalAssets)}</div>
              </div>
              <div>
                <div className="eg-stat-label">Total Shares</div>
                <div className="eg-stat-value">{formatNum(totalShares, 2)}</div>
              </div>
              <div>
                <div className="eg-stat-label">USDC Balance</div>
                <div className="eg-stat-value">{isConnected ? formatNum(userUsdc) : '—'}</div>
              </div>
            </div>
            {isConnected && myReferrer && myReferrer !== zeroAddress && (
              <div className="eg-ref-note" style={{ marginTop: 16 }}>
                Referred by: {truncate(myReferrer)}
              </div>
            )}
          </section>

          {/* Deposit + Withdraw */}
          <section className="eg-vault-actions">
            {/* Deposit */}
            <div className="eg-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eg-panel-title gold">Deposit</span>
                <span className="eg-badge deposit">USDC → GOLD</span>
              </div>

              <div>
                <div className="eg-input-label">
                  <span>Amount (USDC)</span>
                  <span className="eg-balance-link" onClick={setMaxDeposit}>
                    Balance: {isConnected ? formatNum(userUsdc) : '—'}
                  </span>
                </div>
                <div className="eg-input-wrap">
                  <input
                    className="eg-input"
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    disabled={!isConnected || isBusy}
                  />
                  <span className="eg-symbol">USDC</span>
                </div>
              </div>

              <div>
                <div className="eg-input-label">
                  <span>Referrer (optional)</span>
                </div>
                <div className="eg-input-wrap">
                  <input
                    className="eg-input"
                    style={{ fontSize: 14, fontWeight: 500 }}
                    type="text"
                    placeholder="0x..."
                    value={referrer}
                    onChange={(e) => setReferrer(e.target.value)}
                    disabled={!isConnected || isBusy}
                  />
                </div>
              </div>

              <div className="eg-fee-row">
                <span>Deposit Fee</span>
                <span style={{ fontWeight: 600, color: 'var(--white)' }}>{depositFeePct.toFixed(2)}%</span>
              </div>

              <div className="eg-receive">
                <span>You will receive</span>
                <span className="eg-receive-amt gold">
                  {depositCalc.receive > 0 ? depositCalc.receive.toFixed(4) : '0.000'} GOLD
                </span>
              </div>

              {needsApproval && isConnected && parseFloat(depositAmount) > 0 ? (
                <button
                  className="eg-btn outline"
                  onClick={handleApprove}
                  disabled={isBusy || !!isPaused}
                >
                  {(isApproving || isConfirmingApprove) && <span className="eg-spinner" />}
                  {isApproving || isConfirmingApprove ? 'Approving...' : 'Approve USDC'}
                </button>
              ) : (
                <button
                  className="eg-btn gold"
                  onClick={handleDeposit}
                  disabled={
                    !isConnected ||
                    isBusy ||
                    !!isPaused ||
                    !depositAmount ||
                    parseFloat(depositAmount) <= 0 ||
                    needsApproval
                  }
                >
                  {(isDepositing || isConfirmingDeposit) && <span className="eg-spinner" />}
                  {isDepositing || isConfirmingDeposit
                    ? 'Depositing...'
                    : isPaused
                    ? 'Paused'
                    : 'Deposit'}
                  <span>→</span>
                </button>
              )}
            </div>

            {/* Withdraw */}
            <div className="eg-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eg-panel-title">Withdraw</span>
                <span className="eg-badge withdraw">GOLD → USDC</span>
              </div>

              <div>
                <div className="eg-input-label">
                  <span>Shares (GOLD)</span>
                  <span className="eg-balance-link" onClick={setMaxWithdraw}>
                    Balance: {isConnected ? formatNum(userShares) : '—'}
                  </span>
                </div>
                <div className="eg-input-wrap">
                  <input
                    className="eg-input"
                    type="number"
                    placeholder="0.00"
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    disabled={!isConnected || isBusy}
                  />
                  <span className="eg-symbol gold">GOLD</span>
                </div>
              </div>

              <div className="eg-fee-row">
                <span>Withdrawal Fee</span>
                <span style={{ fontWeight: 600, color: 'var(--white)' }}>{withdrawFeePct.toFixed(2)}%</span>
              </div>

              <div className="eg-receive">
                <span>You will receive</span>
                <span className="eg-receive-amt">
                  ${withdrawCalc.receive > 0 ? withdrawCalc.receive.toFixed(2) : '0.00'}
                </span>
              </div>

              <button
                className="eg-btn neutral"
                onClick={handleWithdraw}
                disabled={
                  !isConnected ||
                  isBusy ||
                  !withdrawShares ||
                  parseFloat(withdrawShares) <= 0
                }
              >
                {(isWithdrawing || isConfirmingWithdraw) && <span className="eg-spinner" />}
                {isWithdrawing || isConfirmingWithdraw ? 'Withdrawing...' : 'Withdraw'}
                <span>→</span>
              </button>
            </div>
          </section>

          {/* Pool Info */}
          <section className="eg-card">
            <div className="eg-section-label">Pool Information</div>
            <div className="eg-grid" style={{ borderTop: 'none', paddingTop: 0 }}>
              <div>
                <div className="eg-stat-label">TVL</div>
                <div className="eg-stat-value">{formatUsd(totalAssets)}</div>
              </div>
              <div>
                <div className="eg-stat-label">Share Price</div>
                <div className="eg-stat-value gold">{formatUsd(pricePerShare)}</div>
              </div>
              <div>
                <div className="eg-stat-label">Total Shares</div>
                <div className="eg-stat-value">{formatNum(totalShares, 2)}</div>
              </div>
              <div>
                <div className="eg-stat-label">Deposit Fee</div>
                <div className="eg-stat-value" style={{ fontSize: 15 }}>
                  {depositFeePct.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="eg-stat-label">Withdrawal Fee</div>
                <div className="eg-stat-value" style={{ fontSize: 15 }}>
                  {withdrawFeePct.toFixed(2)}%
                </div>
              </div>
            </div>
            <div className="eg-yield-status">
              <span className={`eg-yield-dot ${yieldActive ? 'active' : 'inactive'}`} />
              <span>
                Yield Status:{' '}
                <strong style={{ color: yieldActive ? 'var(--gold)' : 'var(--muted)' }}>
                  {yieldActive ? 'Active' : 'Inactive'}
                </strong>
              </span>
            </div>
          </section>
        </div>
      </main>

      <footer className="eg-footer">
        <div className="eg-container">
          © 2026 Ethereum Gold ·{' '}
          <a href="https://github.com/Linazchain/EthereumGold" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>

      {toast && (
        <div className={`eg-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : '⚡'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}
