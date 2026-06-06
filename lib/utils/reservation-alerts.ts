import { isAlarmEligibleLocation } from '@/lib/constants/rocket-locations'

/** Set to true to re-enable calendar flash alarms for overdue unconfirmed reservations. */
export const RESERVATION_ALARM_ENABLED = false

export const UNCONFIRMED_ALARM_DAYS = 3

const TERMINAL_STATUSES = new Set(['cancelled', 'checked_out', 'no_show'])

export function daysSinceCreated(createdAt: string): number {
  const start = new Date(createdAt)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86_400_000)
}

export function isUnconfirmedReservationAlarm(
  status: string,
  createdAt: string,
  options?: {
    overdueDays?: number
    locationId?: string
    locations?: Array<{ id: string; name: string; name_ar: string }>
  }
): boolean {
  if (!RESERVATION_ALARM_ENABLED) return false
  if (options?.locationId != null) {
    if (!isAlarmEligibleLocation(options.locationId, options.locations ?? [])) return false
  }
  const overdueDays = options?.overdueDays ?? UNCONFIRMED_ALARM_DAYS
  if (TERMINAL_STATUSES.has(status)) return false
  if (status === 'confirmed') return false
  return daysSinceCreated(createdAt) >= overdueDays
}
