import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface ServiceNotification {
  id: string
  type: 'low_stock' | 'booking_reminder' | 'service_completed' | 'payment_due'
  title: string
  title_ar: string
  message: string
  message_ar: string
  service_id?: string
  reservation_id?: string
  is_read: boolean
  created_at: string
}

export function useServiceNotifications() {
  return useQuery({
    queryKey: ['service-notifications'],
    queryFn: async () => {
      // Check for low stock services (filter in JavaScript since Supabase doesn't support column comparison)
      const { data: allStock, error: stockError } = await supabase
        .from('service_stock')
        .select(`
          *,
          service:services (*)
        `)

      if (stockError) throw stockError

      // Filter for low stock items
      const lowStock = allStock?.filter((item: any) => 
        item.current_stock <= item.min_stock
      ) || []

      // Check for upcoming service bookings
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      const { data: upcomingBookings, error: bookingError } = await supabase
        .from('service_bookings')
        .select(`
          *,
          reservation_service:reservation_services (
            *,
            service:services (*),
            reservation:reservations (
              reservation_number,
              guest:guests (*)
            )
          )
        `)
        .eq('booking_date', tomorrowStr)
        .eq('status', 'scheduled')

      if (bookingError) throw bookingError

      // Format notifications
      const notifications: ServiceNotification[] = []

      // Low stock notifications
      lowStock?.forEach((item: any) => {
        notifications.push({
          id: `low-stock-${item.id}`,
          type: 'low_stock',
          title: 'Low Stock Alert',
          title_ar: 'تنبيه مخزون منخفض',
          message: `Service ${item.service?.name} is running low`,
          message_ar: `مخزون ${item.service?.name_ar || item.service?.name} منخفض (${item.current_stock} ${item.unit})`,
          service_id: item.service_id,
          is_read: false,
          created_at: new Date().toISOString(),
        })
      })

      // Booking reminders
      upcomingBookings?.forEach((booking: any) => {
        notifications.push({
          id: `booking-${booking.id}`,
          type: 'booking_reminder',
          title: 'Service Booking Reminder',
          title_ar: 'تذكير حجز خدمة',
          message: `Service booking tomorrow at ${booking.booking_time}`,
          message_ar: `حجز خدمة غداً الساعة ${booking.booking_time} - ${booking.reservation_service?.service?.name_ar || booking.reservation_service?.service?.name}`,
          service_id: booking.reservation_service?.service_id,
          reservation_id: booking.reservation_service?.reservation_id,
          is_read: false,
          created_at: new Date().toISOString(),
        })
      })

      return notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
    refetchInterval: 60000, // Refresh every minute
  })
}

