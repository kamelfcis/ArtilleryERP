'use client'

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { get, set, del } from 'idb-keyval'
import { useState } from 'react'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

// idb-keyval is browser-only.  On the server (SSR / RSC) we return a no-op
// persister so PersistQueryClientProvider renders without errors.
function createPersister(): Persister {
  if (typeof window === 'undefined') {
    return {
      persistClient: async () => {},
      restoreClient: async () => undefined,
      removeClient: async () => {},
    }
  }
  return {
    persistClient: (client: PersistedClient) => set('rq-cache', client),
    restoreClient: () => get<PersistedClient>('rq-cache'),
    removeClient: () => del('rq-cache'),
  }
}

const persister = createPersister()

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: 'always',
            retry: 1,
          },
        },
      })
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // Keep the IDB snapshot for 24 hours.
        maxAge: 24 * 60 * 60 * 1000,
        // Bump NEXT_PUBLIC_APP_VERSION in .env to bust the cache on deploy.
        buster: process.env.NEXT_PUBLIC_APP_VERSION ?? '1',
        dehydrateOptions: {
          // Only persist calendar window queries — keeps the IDB payload
          // small and avoids caching sensitive data like guest lists.
          shouldDehydrateQuery: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'calendar-window' &&
            query.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
