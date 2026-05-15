/**
 * Row returned by public.vw_calendar_events / get_calendar_window RPC.
 * All guest and unit fields are inlined — no nested objects needed.
 */
export interface CalendarEvent {
  id: string
  unit_id: string
  unit_number: string | null
  unit_name_ar: string | null
  unit_name_en: string | null
  unit_type: string | null
  location_id: string
  guest_id: string | null
  guest_first_name_ar: string | null
  guest_last_name_ar: string | null
  guest_first_name: string | null
  guest_last_name: string | null
  guest_phone: string | null
  check_in_date: string
  check_out_date: string
  status: string
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

export interface CalendarWindowArgs {
  locationId?: string
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
  status?: string
}
