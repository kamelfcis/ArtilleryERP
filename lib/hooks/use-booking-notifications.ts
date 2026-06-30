import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useRocketUserId } from '@/lib/hooks/use-rocket-user-id'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiPost, apiPatch } from '@/lib/api/http-client'
import { buildQuery } from '@/lib/api/build-query'

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

function useNotificationViewerContext() {
  const { user, hasRole, elevatedOps } = useAuth()
  const restrictedBranchManager =
    hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
  const { data: rocketUserId } = useRocketUserId()

  const queryScope = restrictedBranchManager
    ? `bm-${user?.id ?? 'none'}`
    : `approver-${rocketUserId ?? 'none'}`

  return {
    user,
    restrictedBranchManager,
    rocketUserId: rocketUserId ?? null,
    queryScope,
  }
}

function applyBookingNotificationFilters<T extends { eq: (col: string, val: string) => T; is: (col: string, val: null) => T }>(
  query: T,
  ctx: ReturnType<typeof useNotificationViewerContext>
): T {
  if (ctx.restrictedBranchManager) {
    if (!ctx.user?.id) return query
    return query.eq('notify_user_id', ctx.user.id)
  }
  if (!ctx.rocketUserId) return query
  return query.eq('created_by', ctx.rocketUserId).is('notify_user_id', null)
}

function notificationQueryParams(ctx: ReturnType<typeof useNotificationViewerContext>) {
  return {
    restrictedBranchManager: ctx.restrictedBranchManager ? 'true' : undefined,
    rocketUserId: ctx.rocketUserId ?? undefined,
  }
}

export function useBookingNotifications() {
  const ctx = useNotificationViewerContext()

  return useQuery({
    queryKey: ['booking-notifications', ctx.queryScope],
    queryFn: async () => {
      if (!ctx.restrictedBranchManager && !ctx.rocketUserId) return []

      if (isApiProvider()) {
        return apiGet<BookingNotification[]>(
          `/notifications${buildQuery(notificationQueryParams(ctx))}`
        )
      }

      let query = supabase
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

      query = applyBookingNotificationFilters(query, ctx)

      const { data, error } = await query
      if (error) throw error
      return data as BookingNotification[]
    },
    staleTime: 0,
    refetchOnMount: 'always',
    enabled:
      ctx.restrictedBranchManager ? !!ctx.user?.id : ctx.rocketUserId !== null,
  })
}

export function useUnreadNotificationCount() {
  const ctx = useNotificationViewerContext()

  return useQuery({
    queryKey: ['booking-notifications-count', ctx.queryScope],
    queryFn: async () => {
      if (!ctx.restrictedBranchManager && !ctx.rocketUserId) return 0

      if (isApiProvider()) {
        const { count } = await apiGet<{ count: number }>(
          `/notifications/unread-count${buildQuery(notificationQueryParams(ctx))}`
        )
        return count
      }

      let query = supabase
        .from('booking_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)

      query = applyBookingNotificationFilters(query, ctx)

      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    },
    refetchInterval: 30000,
    enabled:
      ctx.restrictedBranchManager ? !!ctx.user?.id : ctx.rocketUserId !== null,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (isApiProvider()) {
        await apiPatch(`/notifications/${id}/read`)
        return
      }
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
  const ctx = useNotificationViewerContext()

  return useMutation({
    mutationFn: async () => {
      if (!ctx.restrictedBranchManager && !ctx.rocketUserId) return

      if (isApiProvider()) {
        await apiPatch('/notifications/read-all', {
          restrictedBranchManager: ctx.restrictedBranchManager,
          rocketUserId: ctx.rocketUserId,
        })
        return
      }

      let query = supabase
        .from('booking_notifications')
        .update({ is_read: true })
        .eq('is_read', false)

      query = applyBookingNotificationFilters(query, ctx)

      const { error } = await query
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
      if (isApiProvider()) {
        await apiPost('/notifications', data)
        return
      }
      const { error } = await supabase.from('booking_notifications').insert(data)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['booking-notifications-count'] })
    },
  })
}
