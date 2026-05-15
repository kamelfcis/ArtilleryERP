'use client'

import { createClient } from '@supabase/supabase-js'

// Get environment variables (trim to handle any whitespace from env injection)
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
  })
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

// For server-side usage
export function createServerClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  )
}

