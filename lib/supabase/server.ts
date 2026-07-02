import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-component Supabase client.
 *
 * `@supabase/auth-helpers-nextjs` is loaded lazily so that in api mode
 * (NEXT_PUBLIC_DATA_PROVIDER!="supabase") the Supabase packages are never
 * imported/initialized at build or import time. This helper is only reached by
 * the Supabase provider path.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createServerComponentClient } =
    require('@supabase/auth-helpers-nextjs') as typeof import('@supabase/auth-helpers-nextjs')
  return createServerComponentClient({ cookies: () => cookieStore })
}
