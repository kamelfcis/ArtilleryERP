'use client'

import { supabase } from '@/lib/supabase/client'

/**
 * Attach the current Supabase access token so Route Handlers can verify the user.
 * (Browser sessions use localStorage/PKCE; cookies alone are often empty for API routes.)
 */
export async function fetchWithSupabaseAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init?.headers)
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  })
}
