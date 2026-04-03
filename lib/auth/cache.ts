/**
 * Auth Session Cache
 * Stores session in memory + localStorage for instant restoration
 */

import { Session, User } from '@supabase/supabase-js'
import { UserRole } from '@/lib/types/database'

const SESSION_CACHE_KEY = 'auth_session_cache'
const ROLES_CACHE_KEY = 'auth_roles_cache'
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

interface CachedSession {
  session: Session | null
  user: User | null
  roles: UserRole[]
  timestamp: number
}

// In-memory cache (fastest)
let memoryCache: CachedSession | null = null

export function getCachedSession(): CachedSession | null {
  // Check memory first
  if (memoryCache && isCacheValid(memoryCache.timestamp)) {
    return memoryCache
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
        const result = {
          ...parsed,
          roles,
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
  roles: UserRole[] = []
): void {
  const cached: CachedSession = {
    session,
    user,
    roles,
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
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }
}

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_EXPIRY
}








