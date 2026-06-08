export const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e']

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

export function buildMonthRange(from: string, to: string): string[] {
  const months: string[] = []
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)

  let year = fromYear
  let month = fromMonth

  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }

  return months
}

export function getDefaultStatsRange(): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  return {
    from: `${year}-01`,
    to: `${year}-${String(currentMonth).padStart(2, '0')}`,
  }
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' })
}

export function getArabicMonthName(monthIndex: number): string {
  return ARABIC_MONTHS[monthIndex - 1] ?? String(monthIndex)
}

export function monthKeyFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function getPresetRange(
  preset: 'last3' | 'last6' | 'currentYear'
): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (preset === 'currentYear') {
    return getDefaultStatsRange()
  }

  const monthsBack = preset === 'last3' ? 2 : 5
  let fromMonth = currentMonth - monthsBack
  let fromYear = year

  while (fromMonth <= 0) {
    fromMonth += 12
    fromYear--
  }

  return {
    from: monthKeyFromParts(fromYear, fromMonth),
    to: monthKeyFromParts(year, currentMonth),
  }
}

export function getEmailInitials(email: string): string {
  return email.split('@')[0].substring(0, 2).toUpperCase()
}
