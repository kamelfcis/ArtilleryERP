import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface ServiceCategory {
  id: string
  name: string
  name_ar: string
  type: 'food' | 'service' | 'other'
  description?: string
  description_ar?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  category_id?: string
  name: string
  name_ar: string
  description?: string
  description_ar?: string
  price: number
  unit: string
  is_food: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  category?: ServiceCategory
}

export interface ReservationService {
  id: string
  reservation_id: string
  service_id: string
  quantity: number
  unit_price: number
  total_amount: number
  notes?: string
  notes_ar?: string
  added_by?: string
  created_at: string
  service?: Service
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('name_ar', { ascending: true })

      if (error) throw error
      return data as ServiceCategory[]
    },
  })
}

export function useServices(filters?: { categoryId?: string; isFood?: boolean }) {
  return useQuery({
    queryKey: ['services', filters],
    queryFn: async () => {
      let query = supabase
        .from('services')
        .select(`
          *,
          category:service_categories (*)
        `)
        .eq('is_active', true)
        .order('name_ar', { ascending: true })

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }
      if (filters?.isFood !== undefined) {
        query = query.eq('is_food', filters.isFood)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Service[]
    },
  })
}

export function useReservationServices(reservationId: string) {
  return useQuery({
    queryKey: ['reservation-services', reservationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservation_services')
        .select(`
          *,
          service:services (
            *,
            category:service_categories (*)
          )
        `)
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ReservationService[]
    },
    enabled: !!reservationId,
  })
}

export function useAddReservationService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reservationId,
      serviceId,
      quantity,
      notes,
    }: {
      reservationId: string
      serviceId: string
      quantity: number
      notes?: string
    }) => {
      // Get service price
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('price')
        .eq('id', serviceId)
        .single()

      if (serviceError) throw serviceError
      if (!service) throw new Error('الخدمة غير موجودة')

      const unitPrice = service.price
      const totalAmount = unitPrice * quantity

      const { data: userData } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('reservation_services')
        .insert({
          reservation_id: reservationId,
          service_id: serviceId,
          quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
          notes_ar: notes,
          added_by: userData?.user?.id,
        })
        .select()
        .single()

      if (error) throw error

      // Update reservation total amount
      const { data: reservation } = await supabase
        .from('reservations')
        .select('total_amount')
        .eq('id', reservationId)
        .single()

      if (reservation) {
        await supabase
          .from('reservations')
          .update({
            total_amount: reservation.total_amount + totalAmount,
          })
          .eq('id', reservationId)
      }

      return data as ReservationService
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reservation-services', variables.reservationId] })
      queryClient.invalidateQueries({ queryKey: ['reservation', variables.reservationId] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useDeleteReservationService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      serviceId,
      reservationId,
    }: {
      serviceId: string
      reservationId: string
    }) => {
      // Get service total amount
      const { data: service } = await supabase
        .from('reservation_services')
        .select('total_amount')
        .eq('id', serviceId)
        .single()

      // Delete service
      const { error } = await supabase
        .from('reservation_services')
        .delete()
        .eq('id', serviceId)

      if (error) throw error

      // Update reservation total amount
      if (service) {
        const { data: reservation } = await supabase
          .from('reservations')
          .select('total_amount')
          .eq('id', reservationId)
          .single()

        if (reservation) {
          await supabase
            .from('reservations')
            .update({
              total_amount: Math.max(0, reservation.total_amount - service.total_amount),
            })
            .eq('id', reservationId)
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reservation-services', variables.reservationId] })
      queryClient.invalidateQueries({ queryKey: ['reservation', variables.reservationId] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Service> & { id: string }) => {
      const { data, error } = await supabase
        .from('services')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Service
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

