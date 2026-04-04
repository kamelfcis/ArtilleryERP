import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface BookingNotification {
  id: string
  reservation_id: string
  created_by: string
  notify_user_id?: string | null
  message: string
  is_read: boolean
  created_at: string
  reservation?: {
    id: string
    reservation_number: string
    status: string
    check_in_date: string
    check_out_date: string
    total_amount: number
    guest?: { first_name: string; last_name: string; first_name_ar: string; last_name_ar: string }
    unit?: { unit_number: string; name: string }
  }
}

export function useBookingNotifications() {
  return useQuery({
    queryKey: ['booking-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_notifications')
        .select(`
          *,
          reservation:reservations(
            id, reservation_number, status, check_in_date, check_out_date, total_amount,
            guest:guests(first_name, last_name, first_name_ar, last_name_ar),
            unit:units(unit_number, name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data as BookingNotification[]
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['booking-notifications-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('booking_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)

      if (error) throw error
      return count ?? 0
    },
    refetchInterval: 30000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('booking_notifications')
        .update({ is_read: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['booking-notifications-count'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('booking_notifications')
        .update({ is_read: true })
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['booking-notifications-count'] })
    },
  })
}

export function useCreateBookingNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { reservation_id: string; created_by: string; message: string; notify_user_id?: string }) => {
      const { error } = await supabase
        .from('booking_notifications')
        .insert(data)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['booking-notifications-count'] })
    },
  })
}
