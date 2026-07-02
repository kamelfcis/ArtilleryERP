import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import {
  createAdminClient,
  safeSupabaseCall,
  SupabaseUnavailableError,
} from '@/lib/supabase/admin-server'

/** Resolve logged-in user from Bearer JWT (browser) or Supabase auth cookies (SSR). */
export async function getVerifiedAuthUser(request: NextRequest): Promise<{ id: string } | null> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
  const admin = createAdminClient()

  if (bearer) {
    const {
      data: { user },
      error,
    } = await safeSupabaseCall(() => admin.auth.getUser(bearer))
    if (error || !user) return null
    return { id: user.id }
  }

  try {
    const cookieStore = cookies()
    // Loaded lazily so `@supabase/auth-helpers-nextjs` is never imported in api mode.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRouteHandlerClient } =
      require('@supabase/auth-helpers-nextjs') as typeof import('@supabase/auth-helpers-nextjs')
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
    } = await safeSupabaseCall(() => supabaseAuth.auth.getSession())
    if (!session?.user) return null
    return { id: session.user.id }
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) throw error
    return null
  }
}
