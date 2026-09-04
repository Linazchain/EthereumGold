'use client'

import { useMemo } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from 'wagmi'
import { parseUnits, formatUnits, zeroAddress } from 'viem'
import {
  CONTRACTS,
  ASSET_POOL_ABI,
  ERC20_ABI,
  REFERRAL_REGISTRY_ABI,
  CHAIN_ID,
  USDC_DECIMALS,
  SHARE_DECIMALS,
} from '@/lib/contracts'

export function useAssetPool() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const onSepolia = chainId === CHAIN_ID
  const enabled = isConnected && !!address && onSepolia

  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'totalAssets',
    chainId: CHAIN_ID, query: { enabled: onSepolia },
  })
  const { data: pricePerShare, refetch: refetchPrice } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'pricePerShare',
    chainId: CHAIN_ID, query: { enabled: onSepolia },
  })
  const { data: depositFeeBps } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'depositFeeBps',
    chainId: CHAIN_ID, query: { enabled: onSepolia },
  })
  const { data: withdrawFeeBps } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'withdrawFeeBps',
    chainId: CHAIN_ID, query: { enabled: onSepolia },
  })
  const { data: yieldAdapter } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'yieldAdapter',
    chainId: CHAIN_ID, query: { enabled: onSepolia },
  })
  const { data: isPaused } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'paused',
    chainId: CHAIN_ID, query: { enabled: onSepolia },
  })
  const { data: userPayoutWeightRaw, refetch: refetchWeight } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'userPayoutWeight',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })
  const { data: totalPayoutWeightRaw } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'totalPayoutWeight',
    chainId: CHAIN_ID, query: { enabled: onSepolia },
  })
  const { data: positionCountRaw, refetch: refetchPositions } = useReadContract({
    address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'positionCount',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })

  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: 'allowance',
    args: address ? [address, CONTRACTS.assetPool] : undefined, chainId: CHAIN_ID, query: { enabled },
  })
  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: CONTRACTS.shareToken, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })

  const { data: multBps, refetch: refetchMult } = useReadContract({
    address: CONTRACTS.referralRegistry, abi: REFERRAL_REGISTRY_ABI, functionName: 'multiplierBpsFor',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })
  const { data: isReferred, refetch: refetchIsReferred } = useReadContract({
    address: CONTRACTS.referralRegistry, abi: REFERRAL_REGISTRY_ABI, functionName: 'isReferred',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })
  const { data: isReferrerStatus, refetch: refetchIsReferrer } = useReadContract({
    address: CONTRACTS.referralRegistry, abi: REFERRAL_REGISTRY_ABI, functionName: 'isReferrer',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })
  const { data: refCount, refetch: refetchRefCount } = useReadContract({
    address: CONTRACTS.referralRegistry, abi: REFERRAL_REGISTRY_ABI, functionName: 'referralCount',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })
  const { data: myReferrer, refetch: refetchMyReferrer } = useReadContract({
    address: CONTRACTS.referralRegistry, abi: REFERRAL_REGISTRY_ABI, functionName: 'referrerOf',
    args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled },
  })

  const { writeContract: approveWrite, data: approveHash, isPending: isApproving, reset: resetApprove } = useWriteContract()
  const { writeContract: depositWrite, data: depositHash, isPending: isDepositing, reset: resetDeposit } = useWriteContract()
  const { writeContract: withdrawWrite, data: withdrawHash, isPending: isWithdrawing, reset: resetWithdraw } = useWriteContract()
  const { writeContract: registerWrite, data: registerHash, isPending: isRegistering, reset: resetRegister } = useWriteContract()

  const { isLoading: isConfirmingApprove, isSuccess: isApproved } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isConfirmingDeposit, isSuccess: isDeposited } = useWaitForTransactionReceipt({ hash: depositHash })
  const { isLoading: isConfirmingWithdraw, isSuccess: isWithdrawn } = useWaitForTransactionReceipt({ hash: withdrawHash })
  const { isLoading: isConfirmingRegister, isSuccess: isRegistered } = useWaitForTransactionReceipt({ hash: registerHash })

  const refetchAll = async () => {
    await Promise.all([
      refetchTotalAssets(), refetchPrice(), refetchUsdc(), refetchShares(), refetchAllowance(),
      refetchWeight(), refetchPositions(), refetchMult(), refetchIsReferred(), refetchIsReferrer(),
      refetchRefCount(), refetchMyReferrer(),
    ])
  }

  const approve = (amount: string) => {
    approveWrite({
      address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: 'approve',
      args: [CONTRACTS.assetPool, parseUnits(amount || '0', USDC_DECIMALS)], chainId: CHAIN_ID,
    })
  }
  const deposit = (amount: string, referrer: `0x${string}` = zeroAddress) => {
    depositWrite({
      address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'deposit',
      args: [parseUnits(amount || '0', USDC_DECIMALS), referrer], chainId: CHAIN_ID,
    })
  }
  const withdraw = (shareAmount: string) => {
    withdrawWrite({
      address: CONTRACTS.assetPool, abi: ASSET_POOL_ABI, functionName: 'withdraw',
      args: [parseUnits(shareAmount || '0', SHARE_DECIMALS)], chainId: CHAIN_ID,
    })
  }
  const registerReferral = (referrer: `0x${string}`) => {
    registerWrite({
      address: CONTRACTS.referralRegistry, abi: REFERRAL_REGISTRY_ABI, functionName: 'registerReferral',
      args: [referrer], chainId: CHAIN_ID,
    })
  }

  const needsApproval = (amount: string) => {
    if (!amount || allowance === undefined) return true
    try { return allowance < parseUnits(amount, USDC_DECIMALS) } catch { return true }
  }

  const toN = (v: bigint | undefined) => (v === undefined ? 0 : Number(formatUnits(v, USDC_DECIMALS)))
  const balance = toN(usdcBalance)
  const shares = toN(userShares)
  const sharePrice = toN(pricePerShare) || 1
  const tvl = toN(totalAssets)
  const payoutWeight = toN(userPayoutWeightRaw)
  const totalPayoutWeight = toN(totalPayoutWeightRaw)
  const positionCount = positionCountRaw !== undefined ? Number(positionCountRaw) : 0
  const multiplierBps = multBps !== undefined ? Number(multBps) : 10000
  const boostLabel = multiplierBps >= 100000 ? '10×' : multiplierBps >= 50000 ? '5×' : '1×'
  const boostPct = multiplierBps >= 100000 ? '+1,000%' : multiplierBps >= 50000 ? '+500%' : 'No Boost'
  const depositFee = depositFeeBps !== undefined ? Number(depositFeeBps) : 100
  const withdrawFee = withdrawFeeBps !== undefined ? Number(withdrawFeeBps) : 100
  const portfolioValue = shares * sharePrice
  const yieldActive = !!yieldAdapter && yieldAdapter !== zeroAddress
  const hasReferrer = !!myReferrer && myReferrer !== zeroAddress
  const isBusy =
    isApproving || isDepositing || isWithdrawing || isRegistering ||
    isConfirmingApprove || isConfirmingDeposit || isConfirmingWithdraw || isConfirmingRegister

  return useMemo(() => ({
    isConnected, address, chainId, onSepolia, isSwitching,
    switchToSepolia: () => switchChain?.({ chainId: CHAIN_ID }),
    balance, shares, sharePrice, tvl, portfolioValue,
    payoutWeight, totalPayoutWeight, positionCount,
    multiplierBps, boostLabel, boostPct,
    isReferred: !!isReferred, isReferrer: !!isReferrerStatus,
    referralCount: refCount !== undefined ? Number(refCount) : 0,
    myReferrer: hasReferrer ? myReferrer : null,
    hasReferrer,
    depositFee, withdrawFee, paused: !!isPaused, yieldActive,
    needsApproval, approve, deposit, withdraw, registerReferral,
    isBusy,
    isApproving: isApproving || isConfirmingApprove,
    isDepositing: isDepositing || isConfirmingDeposit,
    isWithdrawing: isWithdrawing || isConfirmingWithdraw,
    isRegistering: isRegistering || isConfirmingRegister,
    isApproved, isDeposited, isWithdrawn, isRegistered,
    resetApprove, resetDeposit, resetWithdraw, resetRegister,
    refetchAll, refetchAllowance,
  }), [
    isConnected, address, chainId, onSepolia, isSwitching, balance, shares, sharePrice, tvl, portfolioValue,
    payoutWeight, totalPayoutWeight, positionCount, multiplierBps, boostLabel, boostPct,
    isReferred, isReferrerStatus, refCount, myReferrer, hasReferrer,
    depositFee, withdrawFee, isPaused, yieldActive, isBusy,
    isApproving, isConfirmingApprove, isDepositing, isConfirmingDeposit,
    isWithdrawing, isConfirmingWithdraw, isRegistering, isConfirmingRegister,
    isApproved, isDeposited, isWithdrawn, isRegistered, allowance,
  ])
}
