import { create } from 'zustand'

interface WalletState {
  connected: boolean
  address: string | null
  walletName: string | null
  connect: () => void
  disconnect: () => void
}

export const useWalletStore = create<WalletState>((set) => ({
  connected: false,
  address: null,
  walletName: null,
  connect: () => {
    // Simulate wallet connection
    setTimeout(() => {
      set({
        connected: true,
        address: '0x7F3a9B2c4D5e6F7a8b9C0d1E2f3A4b5C6d7E8f9A',
        walletName: 'MetaMask',
      })
    }, 500)
  },
  disconnect: () => {
    set({
      connected: false,
      address: null,
      walletName: null,
    })
  },
}))
