'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { UserRole } from '@/lib/types/database'
import { getCachedSession, setCachedSession, clearCachedSession } from '@/lib/auth/cache'

interface AuthContextType {
  user: User | null
  session: Session | null
  roles: UserRole[]
  /** Per-user DB flag: admin-like CRUD on allowed pages; BranchManagers without this stay restricted */
  elevatedOps: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ session: Session; user: User }>
  signOut: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [elevatedOps, setElevatedOps] = useState(false)
  const [loading, setLoading] = useState(true)

  // Restore from cache instantly
  useEffect(() => {
    const cached = getCachedSession()
    if (cached) {
      setSession(cached.session)
      setUser(cached.user)
      setRoles(cached.roles)
      setElevatedOps(cached.elevatedOps ?? false)
      setLoading(false)
    }

    // Then verify with Supabase in background
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        setUser(session.user)
        // Update cache
        setCachedSession(session, session.user, cached?.roles || [], cached?.elevatedOps ?? false)
        // Fetch roles in background if not cached (don't block)
        if (!cached?.roles || cached.roles.length === 0) {
          fetchUserRoles(session.user.id).catch(console.error)
        }
      } else {
        // No session - clear stale cache and redirect to login
        clearCachedSession()
        setSession(null)
        setUser(null)
        setRoles([])
        setElevatedOps(false)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/modules') {
          window.location.href = '/login'
        }
      }
      setLoading(false)
    }).catch(() => {
      // Auth verification failed (e.g. network error, invalid token)
      clearCachedSession()
      setSession(null)
      setUser(null)
      setRoles([])
      setElevatedOps(false)
      setLoading(false)
      if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/modules') {
        window.location.href = '/login'
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle failed token refresh - clear stale session and redirect to login
      if (event === 'TOKEN_REFRESHED' && !session) {
        clearCachedSession()
        setSession(null)
        setUser(null)
        setRoles([])
        setElevatedOps(false)
        setLoading(false)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return
      }

      // Handle sign out or session expiry
      if (event === 'SIGNED_OUT' || (!session && !event.startsWith('INITIAL'))) {
        clearCachedSession()
        setSession(null)
        setUser(null)
        setRoles([])
        setElevatedOps(false)
        setLoading(false)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/modules') {
          window.location.href = '/login'
        }
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Get current roles from state before updating
        const currentRoles = roles.length > 0 ? roles : getCachedSession()?.roles || []
        setCachedSession(session, session.user, currentRoles, getCachedSession()?.elevatedOps ?? false)
        // Fetch roles in background (non-blocking)
        fetchUserRoles(session.user.id).catch(console.error)
      } else {
        clearCachedSession()
        setRoles([])
        setElevatedOps(false)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserRoles(userId: string) {
    try {
      const cached = getCachedSession()
      const { data: privRow } = await supabase
        .from('user_privileges')
        .select('elevated_ops')
        .eq('user_id', userId)
        .maybeSingle()
      const elevated = privRow?.elevated_ops === true
      setElevatedOps(elevated)

      if (cached?.user?.id === userId && cached.roles.length > 0) {
        setRoles(cached.roles)
        const currentSession = session || getCachedSession()?.session
        const currentUser = user || getCachedSession()?.user
        if (currentSession && currentUser) {
          setCachedSession(currentSession, currentUser, cached.roles, elevated)
        }
        return
      }

      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)

      if (userRolesError) throw userRolesError

      if (!userRolesData || userRolesData.length === 0) {
        setRoles([])
        const currentSession = session || getCachedSession()?.session
        const currentUser = user || getCachedSession()?.user
        if (currentSession && currentUser) setCachedSession(currentSession, currentUser, [], elevated)
        return
      }

      const roleIds = userRolesData.map((item: any) => item.role_id).filter(Boolean)

      if (roleIds.length === 0) {
        setRoles([])
        const currentSession = session || getCachedSession()?.session
        const currentUser = user || getCachedSession()?.user
        if (currentSession && currentUser) setCachedSession(currentSession, currentUser, [], elevated)
        return
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('name')
        .in('id', roleIds)

      if (rolesError) throw rolesError

      const userRoles = (rolesData || [])
        .map((item: any) => item.name)
        .filter(Boolean) as UserRole[]

      setRoles(userRoles)

      const currentSession = session || getCachedSession()?.session
      const currentUser = user || getCachedSession()?.user
      if (currentSession && currentUser) {
        setCachedSession(currentSession, currentUser, userRoles, elevated)
      }
    } catch (error) {
      console.error('Error fetching user roles:', error)
      setRoles([])
      setElevatedOps(false)
    }
  }

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) throw error
    if (!data.session || !data.user) {
      throw new Error('فشل في إنشاء الجلسة')
    }

    // Store in cache immediately
    setCachedSession(data.session, data.user, [], false)
    setSession(data.session)
    setUser(data.user)

    // Fetch roles in parallel (don't wait)
    fetchUserRoles(data.user.id).catch(console.error)

    return { session: data.session, user: data.user }
  }, [])

  async function signOut() {
    // Clear cache and state first
    clearCachedSession()
    setUser(null)
    setSession(null)
    setRoles([])
    setElevatedOps(false)

    // Sign out from Supabase (this will trigger onAuthStateChange)
    await supabase.auth.signOut()
    
    // Redirect to login page only once
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  function hasRole(role: UserRole): boolean {
    return roles.includes(role)
  }

  function hasAnyRole(checkRoles: UserRole[]): boolean {
    return checkRoles.some(role => roles.includes(role))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        elevatedOps,
        loading,
        signIn,
        signOut,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

