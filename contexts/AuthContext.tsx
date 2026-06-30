'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { UserRole } from '@/lib/types/database'
import { getCachedSession, setCachedSession, clearCachedSession } from '@/lib/auth/cache'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiPost } from '@/lib/api/http-client'

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

interface ApiMeResponse {
  user: { id: string; email: string }
  roles: UserRole[]
  elevatedOps: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function redirectToLoginIfNeeded(): void {
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/login' &&
    window.location.pathname !== '/modules'
  ) {
    window.location.href = '/login'
  }
}

function toSupabaseUser(apiUser: { id: string; email: string }): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User
}

function toSupabaseSession(user: User): Session {
  return {
    access_token: 'api-mode',
    token_type: 'bearer',
    expires_in: 604800,
    expires_at: Math.floor(Date.now() / 1000) + 604800,
    refresh_token: '',
    user,
  } as Session
}

function applyMeToState(
  me: ApiMeResponse,
  setUser: (u: User | null) => void,
  setSession: (s: Session | null) => void,
  setRoles: (r: UserRole[]) => void,
  setElevatedOps: (e: boolean) => void
): { user: User; session: Session } {
  const user = toSupabaseUser(me.user)
  const session = toSupabaseSession(user)
  setUser(user)
  setSession(session)
  setRoles(me.roles)
  setElevatedOps(me.elevatedOps)
  setCachedSession(session, user, me.roles, me.elevatedOps)
  return { user, session }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const useApi = isApiProvider()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [elevatedOps, setElevatedOps] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchUserRoles = useCallback(
    async (userId: string) => {
      if (useApi) {
        try {
          const me = await apiGet<ApiMeResponse>('/auth/me')
          if (me.user.id === userId) {
            setRoles(me.roles)
            setElevatedOps(me.elevatedOps)
            const currentSession = session || getCachedSession()?.session
            const currentUser = user || getCachedSession()?.user
            if (currentSession && currentUser) {
              setCachedSession(currentSession, currentUser, me.roles, me.elevatedOps)
            }
          }
        } catch (error) {
          console.error('Error fetching user roles:', error)
          setRoles([])
          setElevatedOps(false)
        }
        return
      }

      try {
        const cached = getCachedSession()

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          if (cached?.user?.id === userId) {
            setRoles(cached.roles)
            setElevatedOps(cached.elevatedOps ?? false)
          }
          return
        }

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

        const roleIds = userRolesData.map((item: { role_id: string }) => item.role_id).filter(Boolean)

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
          .map((item: { name: string }) => item.name)
          .filter(Boolean) as UserRole[]

        setRoles(userRoles)

        const currentSession = session || getCachedSession()?.session
        const currentUser = user || getCachedSession()?.user
        if (currentSession && currentUser) {
          setCachedSession(currentSession, currentUser, userRoles, elevated)
        }
      } catch (error) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = getCachedSession()
          if (cached?.user?.id === userId) {
            setRoles(cached.roles)
            setElevatedOps(cached.elevatedOps ?? false)
          }
          return
        }
        console.error('Error fetching user roles:', error)
        setRoles([])
        setElevatedOps(false)
      }
    },
    [useApi, session, user]
  )

  useEffect(() => {
    const cached = getCachedSession()
    if (cached) {
      setSession(cached.session)
      setUser(cached.user)
      setRoles(cached.roles)
      setElevatedOps(cached.elevatedOps ?? false)
      setLoading(false)
    }

    if (useApi) {
      apiGet<ApiMeResponse>('/auth/me')
        .then((me) => {
          applyMeToState(me, setUser, setSession, setRoles, setElevatedOps)
          setLoading(false)
        })
        .catch(() => {
          clearCachedSession()
          setSession(null)
          setUser(null)
          setRoles([])
          setElevatedOps(false)
          setLoading(false)
          redirectToLoginIfNeeded()
        })
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        setUser(session.user)
        setCachedSession(session, session.user, cached?.roles || [], cached?.elevatedOps ?? false)
        if (!cached?.roles || cached.roles.length === 0) {
          fetchUserRoles(session.user.id).catch(console.error)
        }
      } else {
        clearCachedSession()
        setSession(null)
        setUser(null)
        setRoles([])
        setElevatedOps(false)
        redirectToLoginIfNeeded()
      }
      setLoading(false)
    }).catch(() => {
      clearCachedSession()
      setSession(null)
      setUser(null)
      setRoles([])
      setElevatedOps(false)
      setLoading(false)
      redirectToLoginIfNeeded()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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

      if (event === 'SIGNED_OUT' || (!session && !event.startsWith('INITIAL'))) {
        clearCachedSession()
        setSession(null)
        setUser(null)
        setRoles([])
        setElevatedOps(false)
        setLoading(false)
        redirectToLoginIfNeeded()
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const currentRoles = roles.length > 0 ? roles : getCachedSession()?.roles || []
        setCachedSession(session, session.user, currentRoles, getCachedSession()?.elevatedOps ?? false)
        fetchUserRoles(session.user.id).catch(console.error)
      } else {
        clearCachedSession()
        setRoles([])
        setElevatedOps(false)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [useApi, fetchUserRoles])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (useApi) {
        const me = await apiPost<ApiMeResponse>('/auth/login', {
          email: email.trim(),
          password,
        })
        const { user: signedInUser, session: signedInSession } = applyMeToState(
          me,
          setUser,
          setSession,
          setRoles,
          setElevatedOps
        )
        return { session: signedInSession, user: signedInUser }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) throw error
      if (!data.session || !data.user) {
        throw new Error('فشل في إنشاء الجلسة')
      }

      const { data: account } = await supabase
        .from('user_accounts')
        .select('is_active')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (account && account.is_active === false) {
        await supabase.auth.signOut()
        throw new Error('تم تعطيل حسابك. يرجى التواصل مع مدير النظام.')
      }

      setCachedSession(data.session, data.user, [], false)
      setSession(data.session)
      setUser(data.user)
      await fetchUserRoles(data.user.id)

      return { session: data.session, user: data.user }
    },
    [useApi, fetchUserRoles]
  )

  async function signOut() {
    clearCachedSession()
    setUser(null)
    setSession(null)
    setRoles([])
    setElevatedOps(false)

    if (useApi) {
      try {
        await apiPost('/auth/logout')
      } catch {
        // Cookie cleared server-side if reachable; local state already reset
      }
    } else {
      await supabase.auth.signOut()
    }

    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  function hasRole(role: UserRole): boolean {
    return roles.includes(role)
  }

  function hasAnyRole(checkRoles: UserRole[]): boolean {
    return checkRoles.some((role) => roles.includes(role))
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
