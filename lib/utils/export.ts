export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header]
        // Handle values that might contain commas or quotes
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    ),
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const reservationStatusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  checked_in: 'تم تسجيل الدخول',
  checked_out: 'تم تسجيل الخروج',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
}

const reservationSourceLabels: Record<string, string> = {
  online: 'أونلاين',
  phone: 'هاتف',
  walk_in: 'حضوري',
  email: 'بريد إلكتروني',
}

function reservationGuestName(guest?: {
  first_name?: string
  last_name?: string
  first_name_ar?: string
  last_name_ar?: string
}) {
  if (!guest) return ''
  return `${guest.first_name_ar || guest.first_name || ''} ${guest.last_name_ar || guest.last_name || ''}`.trim()
}

export function exportReservationsToCSV(reservations: any[]) {
  exportReservationsFiltered(reservations)
}

/** CSV with UTF-8 BOM — opens correctly in Excel with Arabic text. */
export function exportReservationsFiltered(
  reservations: any[],
  dateFrom?: string,
  dateTo?: string
) {
  if (reservations.length === 0) return

  const csvData = reservations.map(r => ({
    'رقم الحجز': r.reservation_number,
    'اسم الضيف': reservationGuestName(r.guest),
    'الهاتف': r.guest?.phone || '',
    'تاريخ الدخول': r.check_in_date,
    'تاريخ الخروج': r.check_out_date,
    'الحالة': reservationStatusLabels[r.status] || r.status,
    'الموقع': r.unit?.location?.name_ar || r.unit?.location?.name || '',
    'الوحدة': [r.unit?.unit_number, r.unit?.name_ar || r.unit?.name].filter(Boolean).join(' - '),
    'المبلغ الإجمالي': r.total_amount,
    'المصدر': reservationSourceLabels[r.source] || r.source,
    'تاريخ الإنشاء': r.created_at,
  }))

  const today = new Date().toISOString().split('T')[0]
  const filename =
    dateFrom || dateTo
      ? `حجوزات_${dateFrom || 'بداية'}_${dateTo || 'نهاية'}`
      : `حجوزات_${today}`

  exportToCSV(csvData, filename)
}

export function exportGuestsToCSV(guests: any[]) {
  const csvData = guests.map(g => ({
    'الاسم': `${g.first_name_ar || g.first_name} ${g.last_name_ar || g.last_name}`,
    'الهاتف': g.phone || '',
    'البريد الإلكتروني': g.email || '',
    'الرتبة': g.military_rank_ar || g.military_rank || '',
    'نوع الضيف': g.guest_type,
    'تاريخ التسجيل': g.created_at,
  }))

  exportToCSV(csvData, `guests-${new Date().toISOString().split('T')[0]}`)
}

export function exportUnitsToCSV(units: any[]) {
  const csvData = units.map(u => ({
    'رقم الوحدة': u.unit_number,
    'الاسم': u.name_ar || u.name || '',
    'النوع': u.type,
    'الحالة': u.status,
    'السعة': u.capacity,
    'الموقع': u.location?.name_ar || '',
    'تاريخ الإنشاء': u.created_at,
  }))

  exportToCSV(csvData, `units-${new Date().toISOString().split('T')[0]}`)
}

