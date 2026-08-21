'use client'

import { useMemo } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseUnits, formatUnits, zeroAddress } from 'viem'
import { CONTRACTS, ASSET_POOL_ABI, ERC20_ABI } from '@/lib/contracts'

const DECIMALS = 18

export function useAssetPool() {
  const { address, isConnected } = useAccount()

  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'totalAssets',
  })

  const { data: pricePerShare, refetch: refetchPrice } = useReadContract({
    address: CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'pricePerShare',
  })

  const { data: depositFeeBps } = useReadContract({
    address: CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'depositFeeBps',
  })

  const { data: withdrawFeeBps } = useReadContract({
    address: CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'withdrawFeeBps',
  })

  const { data: shareTokenAddr } = useReadContract({
    address: CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'shareToken',
  })

  const { data: yieldAdapter } = useReadContract({
    address: CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'yieldAdapter',
  })

  const { data: isPaused } = useReadContract({
    address: CONTRACTS.assetPool,
    abi: ASSET_POOL_ABI,
    functionName: 'paused',
  })

  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.assetPool] : undefined,
  })

  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: shareTokenAddr as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address && shareTokenAddr ? [address] : undefined,
  })

  const { data: totalShares } = useReadContract({
    address: shareTokenAddr as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
  })

  const {
    writeContract: approveWrite,
    data: approveHash,
    isPending: isApproving,
    reset: resetApprove,
  } = useWriteContract()

  const {
    writeContract: depositWrite,
    data: depositHash,
    isPending: isDepositing,
    reset: resetDeposit,
  } = useWriteContract()

  const {
    writeContract: withdrawWrite,
    data: withdrawHash,
    isPending: isWithdrawing,
    reset: resetWithdraw,
  } = useWriteContract()

  const { isLoading: isConfirmingApprove, isSuccess: isApproved } =
    useWaitForTransactionReceipt({ hash: approveHash })

  const { isLoading: isConfirmingDeposit, isSuccess: isDeposited } =
    useWaitForTransactionReceipt({ hash: depositHash })

  const { isLoading: isConfirmingWithdraw, isSuccess: isWithdrawn } =
    useWaitForTransactionReceipt({ hash: withdrawHash })

  const refetchAll = async () => {
    await Promise.all([
      refetchTotalAssets(),
      refetchPrice(),
      refetchUsdc(),
      refetchShares(),
      refetchAllowance(),
    ])
  }

  const approve = (amount: string) => {
    approveWrite({
      address: CONTRACTS.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.assetPool, parseUnits(amount || '0', DECIMALS)],
    })
  }

  const deposit = (amount: string, referrer: `0x${string}` = zeroAddress) => {
    depositWrite({
      address: CONTRACTS.assetPool,
      abi: ASSET_POOL_ABI,
      functionName: 'deposit',
      args: [parseUnits(amount || '0', DECIMALS), referrer],
    })
  }

  const withdraw = (shareAmount: string) => {
    withdrawWrite({
      address: CONTRACTS.assetPool,
      abi: ASSET_POOL_ABI,
      functionName: 'withdraw',
      args: [parseUnits(shareAmount || '0', DECIMALS)],
    })
  }

  const needsApproval = (amount: string) => {
    if (!amount || !allowance) return true
    try {
      return allowance < parseUnits(amount, DECIMALS)
    } catch {
      return true
    }
  }

  const toNum = (v: bigint | undefined) =>
    v === undefined ? 0 : Number(formatUnits(v, DECIMALS))

  const balance = toNum(usdcBalance)
  const shares = toNum(userShares)
  const sharePrice = toNum(pricePerShare) || 1
  const tvl = toNum(totalAssets)
  const depositFee = depositFeeBps !== undefined ? Number(depositFeeBps) : 100
  const withdrawFee = withdrawFeeBps !== undefined ? Number(withdrawFeeBps) : 100
  const portfolioValue = shares * sharePrice
  const yieldActive = !!yieldAdapter && yieldAdapter !== zeroAddress

  const isBusy =
    isApproving ||
    isDepositing ||
    isWithdrawing ||
    isConfirmingApprove ||
    isConfirmingDeposit ||
    isConfirmingWithdraw

  return useMemo(
    () => ({
      isConnected,
      address,
      balance,
      shares,
      sharePrice,
      tvl,
      totalShares: toNum(totalShares),
      depositFee,
      withdrawFee,
      paused: !!isPaused,
      yieldActive,
      portfolioValue,
      allowance: toNum(allowance),
      needsApproval,
      approve,
      deposit,
      withdraw,
      isBusy,
      isApproving: isApproving || isConfirmingApprove,
      isDepositing: isDepositing || isConfirmingDeposit,
      isWithdrawing: isWithdrawing || isConfirmingWithdraw,
      isApproved,
      isDeposited,
      isWithdrawn,
      resetApprove,
      resetDeposit,
      resetWithdraw,
      refetchAll,
      refetchAllowance,
    }),
    [
      isConnected,
      address,
      balance,
      shares,
      sharePrice,
      tvl,
      totalShares,
      depositFee,
      withdrawFee,
      isPaused,
      yieldActive,
      portfolioValue,
      allowance,
      isBusy,
      isApproving,
      isConfirmingApprove,
      isDepositing,
      isConfirmingDeposit,
      isWithdrawing,
      isConfirmingWithdraw,
      isApproved,
      isDeposited,
      isWithdrawn,
    ]
  )
}
