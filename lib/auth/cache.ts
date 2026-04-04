/**
 * Auth Session Cache
 * Stores session in memory + localStorage for instant restoration
 */

import { Session, User } from '@supabase/supabase-js'
import { UserRole } from '@/lib/types/database'

const SESSION_CACHE_KEY = 'auth_session_cache'
const ROLES_CACHE_KEY = 'auth_roles_cache'
const ELEVATED_OPS_CACHE_KEY = 'auth_elevated_ops_cache'
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

interface CachedSession {
  session: Session | null
  user: User | null
  roles: UserRole[]
  elevatedOps: boolean
  timestamp: number
}

// In-memory cache (fastest)
let memoryCache: CachedSession | null = null

export function getCachedSession(): CachedSession | null {
  // Check memory first
  if (memoryCache && isCacheValid(memoryCache.timestamp)) {
    return { ...memoryCache, elevatedOps: memoryCache.elevatedOps ?? false }
  }

  // Fallback to localStorage
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY)
    const rolesCached = localStorage.getItem(ROLES_CACHE_KEY)
    
    if (cached) {
      const parsed = JSON.parse(cached)
      if (isCacheValid(parsed.timestamp)) {
        const roles = rolesCached ? JSON.parse(rolesCached) : []
        let elevatedOps = false
        try {
          const eo = localStorage.getItem(ELEVATED_OPS_CACHE_KEY)
          if (eo) elevatedOps = JSON.parse(eo) === true
        } catch {
          elevatedOps = false
        }
        const result: CachedSession = {
          ...parsed,
          roles,
          elevatedOps,
        }
        // Restore to memory
        memoryCache = result
        return result
      }
    }
  } catch (error) {
    console.error('Error reading cache:', error)
  }

  return null
}

export function setCachedSession(
  session: Session | null,
  user: User | null,
  roles: UserRole[] = [],
  elevatedOps: boolean = false
): void {
  const cached: CachedSession = {
    session,
    user,
    roles,
    elevatedOps,
    timestamp: Date.now(),
  }

  // Store in memory
  memoryCache = cached

  // Store in localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
        session,
        user,
        timestamp: cached.timestamp,
      }))
      localStorage.setItem(ROLES_CACHE_KEY, JSON.stringify(roles))
      localStorage.setItem(ELEVATED_OPS_CACHE_KEY, JSON.stringify(elevatedOps))
    } catch (error) {
      console.error('Error writing cache:', error)
    }
  }
}

export function clearCachedSession(): void {
  memoryCache = null
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(SESSION_CACHE_KEY)
      localStorage.removeItem(ROLES_CACHE_KEY)
      localStorage.removeItem(ELEVATED_OPS_CACHE_KEY)
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }
}

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_EXPIRY
}








