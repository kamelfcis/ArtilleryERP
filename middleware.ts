import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { get } from '@vercel/edge-config'

const PROXY_PREFIX = '/api-backend'

function serviceUnavailable(message: string) {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Same-origin API proxy.
 *
 * Browser calls `https://artillery-erp-vps.vercel.app/api-backend/*` (first-party,
 * so the `artillery_token` cookie is first-party and works in Safari/incognito).
 * The backend destination is read at runtime from Vercel Edge Config (`backendUrl`),
 * which the VPS updates in seconds when the quick tunnel churns — no redeploy needed.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  if (!pathname.startsWith(PROXY_PREFIX)) {
    return NextResponse.next()
  }

  let backendUrl: string | undefined
  try {
    backendUrl = await get<string>('backendUrl')
  } catch {
    return serviceUnavailable('Backend proxy misconfigured: Edge Config read failed')
  }

  if (!backendUrl) {
    return serviceUnavailable('Backend proxy unavailable: backendUrl not set in Edge Config')
  }

  // Strip the /api-backend prefix, preserve the remaining path + querystring.
  const rest = pathname.slice(PROXY_PREFIX.length) || '/'
  const target = new URL(rest + search, backendUrl)

  // Forward the original headers (Content-Type, Cookie, etc.) so JSON and binary
  // upload bodies pass through unchanged. Drop Host so the outbound request uses
  // the backend host rather than the Vercel host.
  const headers = new Headers(req.headers)
  headers.delete('host')

  return NextResponse.rewrite(target, { request: { headers } })
}

export const config = {
  matcher: ['/api-backend/:path*'],
}
