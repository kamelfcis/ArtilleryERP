import { UserRole } from '@/lib/types/database'

export const SOLDIER_ROCKET_VIEWER_EMAIL = 'solider_rocket@hotel.com'

export const VIEWER_HOME_PATH = '/calendar'

/** Routes a Viewer role may access (prefix match). */
export const VIEWER_ALLOWED_PATH_PREFIXES = ['/calendar', '/reservations'] as const

export function isSoldierRocketViewerEmail(email: string | undefined): boolean {
  return (email || '').trim().toLowerCase() === SOLDIER_ROCKET_VIEWER_EMAIL
}

export function isViewerRole(roles: UserRole[]): boolean {
  return roles.includes('Viewer')
}

export function isViewerUser(roles: UserRole[]): boolean {
  return isViewerRole(roles)
}

export function isViewerRouteAllowed(pathname: string): boolean {
  if (pathname === '/login' || pathname === '/modules') return true
  if (pathname === '/calendar') return true
  if (pathname === '/reservations') return true
  // Detail view only — block /new, /edit, /attachments, /services, etc.
  if (/^\/reservations\/[0-9a-f-]{36}$/i.test(pathname)) return true
  return false
}

/** Viewer users with soldier rocket email share rocket@hotel.com location scope. */
export function isRocketScopedViewer(email: string | undefined, roles: UserRole[]): boolean {
  return isViewerRole(roles) && isSoldierRocketViewerEmail(email)
}
