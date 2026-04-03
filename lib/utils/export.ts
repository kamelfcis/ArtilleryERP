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

export function exportReservationsToCSV(reservations: any[]) {
  const csvData = reservations.map(r => ({
    'رقم الحجز': r.reservation_number,
    'الضيف': `${r.guest?.first_name_ar || r.guest?.first_name} ${r.guest?.last_name_ar || r.guest?.last_name}`,
    'الوحدة': r.unit?.unit_number || '',
    'تاريخ الدخول': r.check_in_date,
    'تاريخ الخروج': r.check_out_date,
    'الحالة': r.status,
    'المبلغ الإجمالي': r.total_amount,
    'المبلغ المدفوع': r.paid_amount,
    'تاريخ الإنشاء': r.created_at,
  }))

  exportToCSV(csvData, `reservations-${new Date().toISOString().split('T')[0]}`)
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

