import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Temporarily disable middleware to test login
  // The AuthContext will handle authentication checks
  return NextResponse.next()
  
  /* 
  // Original middleware code - re-enable after testing
  const allCookies = req.cookies.getAll()
  const hasSupabaseSession = allCookies.some(cookie => 
    cookie.name.includes('supabase') || 
    cookie.name.includes('sb-') ||
    cookie.name.includes('auth-token')
  )
  
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!hasSupabaseSession) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  if (req.nextUrl.pathname === '/login') {
    if (hasSupabaseSession) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
  */
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}

