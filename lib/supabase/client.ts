'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDataProvider } from '@/lib/api/data-provider'

/**
 * Lazy, provider-aware Supabase browser client.
 *
 * The app can run against either the self-hosted Express API
 * (NEXT_PUBLIC_DATA_PROVIDER="api") or Supabase
 * (NEXT_PUBLIC_DATA_PROVIDER="supabase"). To let the "api" build run with
 * ZERO build-time / import-time dependency on Supabase (and no
 * NEXT_PUBLIC_SUPABASE_* env vars), this module:
 *
 *   1. never throws at import time,
 *   2. never touches `@supabase/supabase-js` unless the supabase provider is
 *      actually selected AND the client is actually used, and
 *   3. exposes the same `supabase` value shape (typed as SupabaseClient) so
 *      existing importers keep type-checking. Every real data path guards its
 *      Supabase usage behind `isApiProvider()`, so in "api" mode the proxy is
 *      never dereferenced.
 */

let cachedClient: SupabaseClient | null = null

function assertSupabaseProviderSelected(): void {
  if (getDataProvider() !== 'supabase') {
    throw new Error(
      'The Supabase client was accessed while NEXT_PUBLIC_DATA_PROVIDER is not "supabase". ' +
        'This code path must be guarded by isApiProvider()/the API data layer.'
    )
  }
}

function createRealClient(): SupabaseClient {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY, or switch to NEXT_PUBLIC_DATA_PROVIDER="api".'
    )
  }

  // Loaded lazily so `@supabase/supabase-js` is never initialized in api mode.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js')

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      // Only auto-refresh the JWT when the browser is online.  When offline,
      // refresh attempts fail with a network error and can trigger repeated
      // retries that drain the battery and generate noise in the console.
      autoRefreshToken: typeof navigator !== 'undefined' ? navigator.onLine : true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      headers: {
        'x-client-info': 'military-hospitality-crm',
      },
    },
  })
}

function getClient(): SupabaseClient {
  assertSupabaseProviderSelected()
  if (!cachedClient) {
    cachedClient = createRealClient()
  }
  return cachedClient
}

/**
 * Client-side Supabase client.
 *
 * Backed by a Proxy so that merely importing this module (which happens all
 * over the codebase via hooks) does not initialize Supabase or read its env
 * vars. The underlying client is created on first property access, and only
 * when the supabase provider is selected.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient()
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
  set(_target, prop, value) {
    const client = getClient()
    return Reflect.set(client as object, prop, value)
  },
  has(_target, prop) {
    const client = getClient()
    return Reflect.has(client as object, prop)
  },
})
