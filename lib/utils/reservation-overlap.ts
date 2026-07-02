import { supabase } from '@/lib/supabase/client'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet } from '@/lib/api/http-client'
import { buildQuery } from '@/lib/api/build-query'

/** Hotel-style overlap: [checkIn, checkOut) intervals — checkout day is exclusive. */
export function reservationRangesOverlap(
  aCheckIn: string,
  aCheckOut: string,
  bCheckIn: string,
  bCheckOut: string
): boolean {
  return aCheckIn < bCheckOut && aCheckOut > bCheckIn
}

/** Active reservations on a unit that overlap the requested stay (ignores calendar status filters). */
export async function findConflictingReservations(
  unitId: string,
  checkIn: string,
  checkOut: string,
  excludeId?: string
): Promise<{ id: string }[]> {
  if (isApiProvider()) {
    return apiGet<{ id: string }[]>(
      `/reservations/conflicts${buildQuery({ unitId, checkIn, checkOut, excludeId })}`
    )
  }

  let query = supabase
    .from('reservations')
    .select('id')
    .eq('unit_id', unitId)
    .neq('status', 'cancelled')
    .neq('status', 'no_show')
    .or(`and(check_in_date.lt.${checkOut},check_out_date.gt.${checkIn})`)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export function formatReservationConflictMessage(unitNumber?: string | number | null): string {
  const unitLabel = unitNumber ? ` ${unitNumber}` : ''
  return `الوحدة${unitLabel} محجوزة في التواريخ المحددة. قد يكون الحجز مخفياً إذا كان فلتر الحالة مفعّلاً.`
}

export function isReservationOverlapError(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? ''
  return (
    message.includes('already booked') ||
    message.includes('محجوزة') ||
    (error as { code?: string })?.code === 'P0001'
  )
}
