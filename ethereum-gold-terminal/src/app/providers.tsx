'use client'

import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { baseSepolia, hardhat, mainnet, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

const queryClient = new QueryClient()

export const config = createConfig({
  chains: [baseSepolia, sepolia, hardhat, mainnet],
  connectors: [
    injected({
      shimDisconnect: true,
      unstable_shimAsyncInject: true,
    }),
  ],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [sepolia.id]: http(),
    [hardhat.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {mounted ? (
          children
        ) : (
          <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
