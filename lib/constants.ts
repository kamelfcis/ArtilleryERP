export const UNIT_TYPES = {
  room: 'غرفة',
  suite: 'جناح',
  chalet: 'شاليه',
  duplex: 'دوبلكس',
  villa: 'فيلا',
  apartment: 'شقة',
} as const

export const RESERVATION_STATUSES = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  checked_in: 'تم تسجيل الدخول',
  checked_out: 'تم تسجيل الخروج',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
} as const

export const RESERVATION_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  checked_in: 'bg-blue-100 text-blue-800',
  checked_out: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
} as const

export const UNIT_STATUSES = {
  available: 'متاحة',
  occupied: 'مشغولة',
  maintenance: 'صيانة',
  out_of_order: 'خارج الخدمة',
} as const

export const UNIT_STATUS_COLORS = {
  available: 'bg-green-100 text-green-800',
  occupied: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  out_of_order: 'bg-red-100 text-red-800',
} as const

export const RESERVATION_SOURCES = {
  direct: 'حجز مباشر',
  website: 'الموقع الإلكتروني',
  phone: 'هاتف',
  booking_com: 'Booking.com',
  airbnb: 'Airbnb',
  expedia: 'Expedia',
  travel_agent: 'وكيل سفر',
  corporate: 'شركات',
  military: 'عسكري',
  walk_in: 'حضور مباشر',
  other: 'أخرى',
} as const

