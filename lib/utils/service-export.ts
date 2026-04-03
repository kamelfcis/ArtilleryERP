import { ReservationService } from '@/lib/hooks/use-services'
import { formatCurrency, formatDateShort } from '@/lib/utils'

export function exportServicesToCSV(
  services: ReservationService[],
  filename: string = 'services-export.csv'
) {
  if (!services || services.length === 0) {
    alert('لا توجد بيانات للتصدير')
    return
  }

  const headers = [
    'رقم الحجز',
    'اسم الخدمة',
    'الكمية',
    'السعر',
    'الإجمالي',
    'التاريخ',
    'ملاحظات',
  ]

  const rows = services.map((service) => [
    service.reservation_id.substring(0, 8),
    service.service?.name_ar || service.service?.name || '',
    service.quantity.toString(),
    formatCurrency(service.unit_price),
    formatCurrency(service.total_amount),
    formatDateShort(service.created_at),
    service.notes_ar || service.notes || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportServiceReportToCSV(
  reportData: any,
  filename: string = 'service-report.csv'
) {
  const headers = [
    'الخدمة',
    'الكمية المباعة',
    'عدد الطلبات',
    'إجمالي الإيرادات',
  ]

  const rows = reportData.byService?.map((item: any) => [
    item.service?.name_ar || item.service?.name || '',
    item.quantity.toString(),
    item.count.toString(),
    formatCurrency(item.revenue),
  ]) || []

  const csvContent = [
    headers.join(','),
    ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

