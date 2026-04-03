'use client'

import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/lib/types/database'
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

    // If not loading, user exists but no roles, redirect to login
    if (!loading && user && roles.length === 0) {
      // Wait a bit for roles to load, then redirect if still no roles
      const timeout = setTimeout(() => {
        if (roles.length === 0 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
          router.replace('/login')
        }
      }, 2000) // Wait 2 seconds for roles to load

      return () => clearTimeout(timeout)
    }

    // If user has no access, redirect
    if (!loading && user && !hasAnyRole(allowedRoles)) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        router.replace('/login')
      }
    }
  }, [loading, hasAnyRole, allowedRoles, redirectTo, router, roles, user])

  // Show loading while checking auth or loading roles
  if (loading || (user && roles.length === 0)) {
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
  if (!hasAnyRole(allowedRoles)) {
    return null
  }

  return <>{children}</>
}

