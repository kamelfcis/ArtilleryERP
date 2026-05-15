'use client'

import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { get, set, del } from 'idb-keyval'
import { useState } from 'react'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

// Set of query-key roots whose data is safe and useful to cache to IndexedDB
// for offline use. The calendar and dashboard read most of these on mount.
const PERSISTED_QUERY_KEYS = new Set<string>([
  'calendar-window',
  'units',
  'unit',
  'guests',
  'guest',
  'locations',
  'location',
  'staff',
  'current-staff',
  'shifts',
  'room-blocks',
  'reservations',
  'reservation',
  'reservation-services',
  'booking-notifications',
  'booking-notifications-count',
  'legacy-notifications',
  'service-notifications',
  'user-roles',
  'user-privileges',
  'pricing',
  'services',
  'service-categories',
  'discount-codes',
  'facilities',
  'payment-transactions',
  'activity-feed',
  'audit-logs',
  'loyalty',
])

// Returns true when a fetch error looks like a network/offline problem we can
// safely silence (no internet, fetch aborted, etc.).
function isOfflineNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const message = String((err as any)?.message ?? err ?? '').toLowerCase()
  if (!message) return false
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('load failed') ||
    message.includes('err_internet_disconnected') ||
    message.includes('err_network') ||
    message.includes('typeerror: failed') ||
    message.includes('aborted')
  )
}

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
        // Silently swallow network errors when the browser is offline so the
        // dev console isn't flooded while still surfacing real failures.
        queryCache: new QueryCache({
          onError: (error) => {
            if (isOfflineNetworkError(error)) return
            console.error('[query]', error)
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (isOfflineNetworkError(error)) return
            console.error('[mutation]', error)
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: 'always',
            // 'online' (the default) pauses queries when navigator reports
            // offline so the queryFn is never invoked and the console isn't
            // flooded with fetch errors.  Cached data from IndexedDB stays
            // readable; queries auto-resume on the next 'online' event.
            networkMode: 'online',
            retry: (failureCount, error) => {
              if (isOfflineNetworkError(error)) return false
              return failureCount < 1
            },
          },
          mutations: {
            // Mutations are also paused when offline so writes that should
            // be queued through useOfflineMutation never hit Supabase here.
            networkMode: 'online',
            retry: false,
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
          // Persist every "data" query whose key root we know is safe.
          // Only successful queries are written to IDB so failed/pending
          // queries can't hydrate back into a rejected state.
          shouldDehydrateQuery: (query) =>
            Array.isArray(query.queryKey) &&
            typeof query.queryKey[0] === 'string' &&
            PERSISTED_QUERY_KEYS.has(query.queryKey[0] as string) &&
            query.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
