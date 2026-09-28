'use client'

import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http, fallback } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 4_000,
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
})

/** Sepolia-only — matches deployed Liquid Yield contracts */
export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected({
      shimDisconnect: true,
      unstable_shimAsyncInject: true,
    }),
  ],
  transports: {
    [sepolia.id]: fallback([
      http('https://ethereum-sepolia-rpc.publicnode.com', {
        batch: true,
        retryCount: 3,
        timeout: 12_000,
      }),
      http('https://rpc.sepolia.org', {
        batch: true,
        retryCount: 2,
        timeout: 12_000,
      }),
      http('https://1rpc.io/sepolia', {
        retryCount: 1,
        timeout: 12_000,
      }),
    ]),
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
            <div className="w-8 h-8 border-2 border-[#F0B90B] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
