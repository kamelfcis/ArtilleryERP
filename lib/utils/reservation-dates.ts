export function getReservationNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  const nights = Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
  )
  return Number.isFinite(nights) && nights > 0 ? nights : 0
}

export function formatNightsArabic(nights: number): string {
  if (nights <= 0) return '—'
  return `${nights} ${nights === 1 ? 'ليلة' : 'ليالٍ'}`
}
