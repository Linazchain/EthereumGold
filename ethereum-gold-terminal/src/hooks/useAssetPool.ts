import { useWalletStore } from '@/store/walletStore'

// Simulated protocol state
let simulatedTVL = 1240000
let simulatedSharePrice = 10
let simulatedShares = 124000
let simulatedDepositFee = 50 // 0.50%
let simulatedWithdrawFee = 25 // 0.25%
let simulatedPaused = false

export function useAssetPool() {
  const { connected, address } = useWalletStore()

  // Simulated user balances based on connection
  const userBalances = connected ? {
    balance: 5000, // USDC
    shares: 1248.032, // GOLD
    allowance: 0,
  } : {
    balance: 0,
    shares: 0,
    allowance: 0,
  }

  const approve = async (amount: number) => {
    // Simulate approval transaction
    await new Promise(resolve => setTimeout(resolve, 1000))
    userBalances.allowance = amount
  }

  const deposit = async (amount: number) => {
    // Simulate deposit transaction
    await new Promise(resolve => setTimeout(resolve, 1500))
    const sharesToMint = (amount / simulatedSharePrice) * (1 - simulatedDepositFee / 10000)
    userBalances.shares += sharesToMint
    simulatedShares += sharesToMint
    simulatedTVL += amount
  }

  const withdraw = async (shareAmount: number) => {
    // Simulate withdrawal transaction
    await new Promise(resolve => setTimeout(resolve, 1500))
    const valueToReceive = shareAmount * simulatedSharePrice * (1 - simulatedWithdrawFee / 10000)
    userBalances.shares -= shareAmount
    userBalances.balance += valueToReceive
    simulatedShares -= shareAmount
    simulatedTVL -= valueToReceive
  }

  return {
    balance: userBalances.balance,
    shares: userBalances.shares,
    allowance: userBalances.allowance,
    sharePrice: simulatedSharePrice,
    tvl: simulatedTVL,
    totalShares: simulatedShares,
    depositFee: simulatedDepositFee,
    withdrawFee: simulatedWithdrawFee,
    paused: simulatedPaused,
    approve,
    deposit,
    withdraw,
  }
}
