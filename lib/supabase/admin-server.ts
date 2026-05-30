import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_FETCH_TIMEOUT_MS = 15_000
const DEFAULT_RETRY_ATTEMPTS = 2
const RETRY_DELAY_MS = 300

export class SupabaseUnavailableError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'SupabaseUnavailableError'
    this.cause = cause
  }
}

export function getSupabaseAdminEnv() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  }
}

/** Return a 500 JSON response when required Supabase env vars are missing or invalid. */
export function validateSupabaseAdminConfig(): NextResponse | null {
  const { url, serviceRoleKey } = getSupabaseAdminEnv()

  if (!url) {
    return NextResponse.json(
      {
        error: 'Supabase URL is not configured. Set NEXT_PUBLIC_SUPABASE_URL in .env.local.',
        code: 'SUPABASE_CONFIG_MISSING',
      },
      { status: 500 }
    )
  }

  if (!/^https:\/\/.+/i.test(url)) {
    return NextResponse.json(
      {
        error: 'NEXT_PUBLIC_SUPABASE_URL must be a valid https URL.',
        code: 'SUPABASE_CONFIG_INVALID',
      },
      { status: 500 }
    )
  }

  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        error: 'Supabase service role key is not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.',
        code: 'SUPABASE_SERVICE_ROLE_MISSING',
      },
      { status: 500 }
    )
  }

  return null
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const err = error as { code?: string; cause?: { code?: string } }
  return err.code ?? err.cause?.code
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

/** Detect transient network/socket failures from undici, Node fetch, or Supabase client. */
export function isTransientFetchError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  const code = getErrorCode(error)

  if (code === 'UND_ERR_SOCKET' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
    return true
  }

  if (message.includes('fetch failed') || message.includes('other side closed') || message.includes('socket')) {
    return true
  }

  if (error instanceof Error && error.cause) {
    return isTransientFetchError(error.cause)
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  return false
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withSupabaseRetry<T>(
  fn: () => PromiseLike<T>,
  maxAttempts = DEFAULT_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientFetchError(error) || attempt === maxAttempts) {
        throw error
      }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  throw lastError
}

function createFetchWithTimeout(timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    if (init?.signal) {
      if (init.signal.aborted) {
        controller.abort()
      } else {
        init.signal.addEventListener('abort', () => controller.abort(), { once: true })
      }
    }

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export function createAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseAdminEnv()

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: createFetchWithTimeout(),
    },
  })
}

/** Run a Supabase call with retry; map persistent network errors to SupabaseUnavailableError. */
export async function safeSupabaseCall<T>(fn: () => PromiseLike<T>): Promise<T> {
  try {
    return await withSupabaseRetry(fn)
  } catch (error) {
    if (isTransientFetchError(error)) {
      throw new SupabaseUnavailableError(
        'Unable to reach Supabase. Check your network connection and Supabase project status.',
        error
      )
    }
    throw error
  }
}

export function handleSupabaseRouteError(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof SupabaseUnavailableError) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'SUPABASE_UNAVAILABLE',
        retryable: true,
      },
      { status: 503 }
    )
  }

  const message = getErrorMessage(error) || fallbackMessage
  return NextResponse.json({ error: message }, { status: 500 })
}
