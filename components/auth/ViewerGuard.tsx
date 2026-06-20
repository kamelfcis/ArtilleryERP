'use client'

import { useAuth } from '@/contexts/AuthContext'
import { isViewerRouteAllowed, isViewerUser, VIEWER_HOME_PATH } from '@/lib/constants/viewer-user'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ViewerGuard({ children }: { children: React.ReactNode }) {
  const { roles, loading, user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const viewer = !loading && user && isViewerUser(roles)

  useEffect(() => {
    if (!viewer || !pathname) return
    if (!isViewerRouteAllowed(pathname)) {
      router.replace(VIEWER_HOME_PATH)
    }
  }, [viewer, pathname, router])

  if (viewer && pathname && !isViewerRouteAllowed(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return <>{children}</>
}
