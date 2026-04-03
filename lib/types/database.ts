export type UnitType = 'room' | 'suite' | 'chalet' | 'duplex' | 'villa' | 'apartment'
export type UnitStatus = 'available' | 'occupied' | 'maintenance' | 'out_of_order'
export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
export type ReservationSource = 'online' | 'phone' | 'walk_in' | 'email'
export type GuestType = 'military' | 'civilian' | 'club_member' | 'artillery_family'
export type PricingType = 'standard' | 'seasonal' | 'weekend' | 'holiday' | 'group'
export type UserRole = 'SuperAdmin' | 'BranchManager' | 'Receptionist' | 'Staff'
export type ShiftType = 'morning' | 'afternoon' | 'night' | 'full_day'
export type RequestType = 'time_off' | 'shift_swap' | 'overtime' | 'other'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled'

export interface Location {
  id: string
  name: string
  name_ar: string
  address?: string
  address_ar?: string
  phone?: string
  email?: string
  manager_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Unit {
  id: string
  location_id: string
  unit_number: string
  name?: string
  name_ar?: string
  type: UnitType
  status: UnitStatus
  capacity: number
  beds: number
  bathrooms: number
  area_sqm?: number
  description?: string
  description_ar?: string
  orderno?: number
  is_active: boolean
  created_at: string
  updated_at: string
  location?: Location
  images?: UnitImage[]
  facilities?: Facility[]
}

export interface UnitImage {
  id: string
  unit_id: string
  image_url: string
  image_path: string
  display_order: number
  is_primary: boolean
  created_at: string
}

export interface Facility {
  id: string
  name: string
  name_ar: string
  icon?: string
  description?: string
  description_ar?: string
  created_at: string
  updated_at: string
}

export interface Guest {
  id: string
  first_name: string
  last_name: string
  first_name_ar?: string
  last_name_ar?: string
  email?: string
  phone: string
  national_id?: string
  military_rank?: string
  military_rank_ar?: string
  unit?: string
  unit_ar?: string
  guest_type: GuestType
  notes?: string
  created_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  reservation_number: string
  unit_id: string
  guest_id: string
  check_in_date: string
  check_out_date: string
  status: ReservationStatus
  source: ReservationSource
  adults: number
  children: number
  total_amount: number
  paid_amount: number
  discount_amount: number
  notes?: string
  notes_ar?: string
  created_by?: string
  created_at: string
  updated_at: string
  unit?: Unit
  guest?: Guest
}

export interface Pricing {
  id: string
  unit_id: string
  pricing_type: PricingType
  start_date?: string
  end_date?: string
  price_per_night?: number
  price_civilian?: number
  price_military?: number
  price_member?: number
  price_artillery_family?: number
  min_nights: number
  max_nights?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RoomBlock {
  id: string
  name: string
  name_ar: string
  start_date: string
  end_date: string
  reason?: string
  reason_ar?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ReservationAttachment {
  id: string
  reservation_id: string
  file_url: string
  file_path: string
  file_name: string
  file_type?: string
  file_size?: number
  uploaded_by?: string
  created_at: string
}

export interface User {
  id: string
  email?: string
  roles?: UserRole[]
}

export interface Staff {
  id: string
  user_id?: string
  first_name: string
  last_name: string
  first_name_ar?: string
  last_name_ar?: string
  email?: string
  phone?: string
  position: string
  position_ar?: string
  department?: string
  department_ar?: string
  location_id?: string
  hire_date?: string
  is_active: boolean
  created_at: string
  updated_at: string
  location?: Location
  user?: User
}

export interface Shift {
  id: string
  staff_id: string
  location_id: string
  shift_date: string
  shift_type: ShiftType
  start_time: string
  end_time: string
  break_duration?: number
  notes?: string
  notes_ar?: string
  created_by?: string
  created_at: string
  updated_at: string
  staff?: Staff
  location?: Location
}

export interface ShiftRequest {
  id: string
  staff_id: string
  request_type: RequestType
  status: RequestStatus
  start_date: string
  end_date?: string
  start_time?: string
  end_time?: string
  reason?: string
  reason_ar?: string
  requested_by?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
  staff?: Staff
}

