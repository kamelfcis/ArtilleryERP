import { pool } from '../db/pool.js'
import type { UserRole } from '../services/userService.js'

const ROCKET_HOTEL_EMAIL = 'rocket@hotel.com'
const SOLDIER_ROCKET_EMAIL = 'solider_rocket@hotel.com'

export type AuthContext = {
  id: string
  email: string
  roles: UserRole[]
  elevatedOps: boolean
}

export function isRestrictedBranchManager(user: AuthContext): boolean {
  return (
    user.roles.includes('BranchManager') &&
    !user.roles.includes('SuperAdmin') &&
    !user.elevatedOps
  )
}

export function isRocketScopedEmail(email: string | undefined): boolean {
  const e = (email || '').trim().toLowerCase()
  return e === ROCKET_HOTEL_EMAIL || e === SOLDIER_ROCKET_EMAIL
}

/** Resolve rocket@hotel.com user id from DB (cached per process briefly via module var). */
let cachedRocketUserId: { id: string | null; at: number } | null = null
const ROCKET_CACHE_MS = 5 * 60 * 1000

export async function resolveRocketUserId(): Promise<string | null> {
  const now = Date.now()
  if (cachedRocketUserId && now - cachedRocketUserId.at < ROCKET_CACHE_MS) {
    return cachedRocketUserId.id
  }
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1`,
    [ROCKET_HOTEL_EMAIL]
  )
  const id = rows[0]?.id ?? null
  cachedRocketUserId = { id, at: now }
  return id
}

/**
 * Server-derived notification / pending-reservation scope.
 * Ignores client restrictedBranchManager / rocketUserId flags.
 */
export async function deriveListScope(user: AuthContext): Promise<{
  restrictedBranchManager: boolean
  rocketUserId: string | null
}> {
  if (isRestrictedBranchManager(user)) {
    return { restrictedBranchManager: true, rocketUserId: null }
  }
  if (isRocketScopedEmail(user.email)) {
    const rocketUserId = await resolveRocketUserId()
    return { restrictedBranchManager: false, rocketUserId }
  }
  return { restrictedBranchManager: false, rocketUserId: null }
}
