'use client'

import { isApiProvider } from '@/lib/api/data-provider'

/**
 * Fetch helper for same-origin Next.js Route Handlers.
 *
 * - In "supabase" mode it attaches the current Supabase access token so Route
 *   Handlers can verify the user (browser sessions use localStorage/PKCE;
 *   cookies alone are often empty for API routes).
 * - In "api" mode there is no Supabase session, so we simply forward the
 *   request with same-origin credentials (matching the previous behaviour,
 *   where `getSession()` returned null and no Authorization header was set)
 *   without importing or initializing the Supabase client.
 */
export async function fetchWithSupabaseAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)

  if (!isApiProvider()) {
    // Import lazily so api-mode bundles never pull in the Supabase client.
    const { supabase } = await import('@/lib/supabase/client')
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }
  }

  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  })
}
