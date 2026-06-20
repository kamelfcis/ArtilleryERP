'use client'

import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/lib/types/database'
import { isSoldierRocketViewerEmail } from '@/lib/constants/viewer-user'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
  redirectTo?: string
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectTo = '/dashboard',
}: RoleGuardProps) {
  const { hasAnyRole, loading, roles, user } = useAuth()
  const router = useRouter()

  const rolesPending = Boolean(user && roles.length === 0)
  const viewerGrace =
    rolesPending && isSoldierRocketViewerEmail(user?.email) && allowedRoles.includes('Viewer')
  const hasAccess = hasAnyRole(allowedRoles) || viewerGrace

  useEffect(() => {
    // Don't redirect if already on login page
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      return
    }

    // If not loading and no user, redirect to login
    if (!loading && !user) {
      router.replace('/login')
      return
    }

    // User exists but roles not loaded yet — wait before redirecting (skip known viewer email)
    if (!loading && user && roles.length === 0) {
      const timeout = setTimeout(() => {
        if (
          roles.length === 0 &&
          !isSoldierRocketViewerEmail(user.email) &&
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login'
        ) {
          router.replace('/login')
        }
      }, 5000)

      return () => clearTimeout(timeout)
    }

    // If user has no access once roles are loaded, redirect
    if (!loading && user && roles.length > 0 && !hasAnyRole(allowedRoles)) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        router.replace('/login')
      }
    }
  }, [loading, hasAnyRole, allowedRoles, redirectTo, router, roles, user])

  // Show loading while checking auth or loading roles (except known viewer email grace)
  if (loading || (rolesPending && !viewerGrace)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If no user, show nothing (redirecting)
  if (!user) {
    return null
  }

  // If user has no access, show nothing (redirecting)
  if (!hasAccess) {
    return null
  }

  return <>{children}</>
}
