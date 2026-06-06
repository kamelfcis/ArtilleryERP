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
  overdueDays = UNCONFIRMED_ALARM_DAYS
): boolean {
  if (TERMINAL_STATUSES.has(status)) return false
  if (status === 'confirmed') return false
  return daysSinceCreated(createdAt) >= overdueDays
}
