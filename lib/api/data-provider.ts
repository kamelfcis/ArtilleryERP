export type DataProvider = 'supabase' | 'api'

export function getDataProvider(): DataProvider {
  const value = process.env.NEXT_PUBLIC_DATA_PROVIDER?.trim().toLowerCase()
  return value === 'api' ? 'api' : 'supabase'
}

export function isApiProvider(): boolean {
  return getDataProvider() === 'api'
}

/**
 * Same-origin proxy prefix. In api mode the browser talks only to
 * `https://<app-host>/api-backend/*`; the Next.js middleware rewrites those
 * requests to the real backend (read at runtime from Vercel Edge Config).
 * Keeping this relative means the auth cookie is first-party and the app never
 * bakes a `*.trycloudflare.com` host into the bundle.
 */
export const API_PROXY_PREFIX = '/api-backend'

export function getApiUrl(): string {
  return API_PROXY_PREFIX
}
