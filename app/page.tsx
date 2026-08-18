'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getPostLoginPath } from '@/lib/constants/viewer-user'

export default function HomePage() {
  const router = useRouter()
  const { user, loading, roles } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (roles.length === 0) return
    router.replace(getPostLoginPath(roles))
  }, [user, loading, roles, router])

  // Show loading while checking auth
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}

