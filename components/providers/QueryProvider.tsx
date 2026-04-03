'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - longer cache
            refetchOnWindowFocus: false, // Don't refetch on focus
            refetchOnMount: false, // Don't refetch on mount if data exists
            refetchOnReconnect: false, // Don't refetch on reconnect
            retry: 1, // Only retry once
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

