import { isSoldierRocketViewerEmail } from '@/lib/constants/viewer-user'

export const ROCKET_HOTEL_EMAIL = 'rocket@hotel.com'

export function isRocketHotelEmail(email: string | undefined): boolean {
  return (email || '').trim().toLowerCase() === ROCKET_HOTEL_EMAIL
}

/** Rocket Beach + قرية الندي scope (rocket manager + soldier rocket viewer). */
export function isRocketScopedUser(email: string | undefined): boolean {
  return isRocketHotelEmail(email) || isSoldierRocketViewerEmail(email)
}

/** Optional env override when admin user lookup is unavailable. */
export function getRocketUserIdFromEnv(): string | null {
  const id = process.env.NEXT_PUBLIC_ROCKET_USER_ID?.trim()
  return id || null
}
