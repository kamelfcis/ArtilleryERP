'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Staff, Shift, ShiftRequest } from '@/lib/types/database'
import { useAuth } from '@/contexts/AuthContext'

// Get current logged-in user's staff profile with location
export function useCurrentStaff() {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: ['current-staff', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          location:locations(*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      return data as Staff | null
    },
    enabled: !!user?.id,
  })
}

// Get all staff members (optionally filtered by location)
export function useStaffList(filters?: { locationId?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: ['staff', filters],
    queryFn: async () => {
      let query = supabase
        .from('staff')
        .select(`
          *,
          location:locations(id, name, name_ar)
        `)
        .order('first_name', { ascending: true })

      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId)
      }
      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Staff[]
    },
  })
}

// Get single staff member
export function useStaff(id: string) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          location:locations(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Staff
    },
    enabled: !!id,
  })
}

// Create staff member
export function useCreateStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (staffData: Partial<Staff>) => {
      const { data, error } = await supabase
        .from('staff')
        .insert(staffData)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// Update staff member
export function useUpdateStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Staff> & { id: string }) => {
      const { data, error } = await supabase
        .from('staff')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// Delete staff member
export function useDeleteStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// ============================================
// SHIFTS
// ============================================

// Get shifts for staff (optionally filtered by location or staff member)
export function useShifts(filters?: { 
  staffId?: string
  locationId?: string
  startDate?: string
  endDate?: string 
}) {
  return useQuery({
    queryKey: ['shifts', filters],
    queryFn: async () => {
      let query = supabase
        .from('shifts')
        .select(`
          *,
          staff:staff(id, first_name, last_name, first_name_ar, last_name_ar, position, position_ar),
          location:locations(id, name, name_ar)
        `)
        .order('shift_date', { ascending: true })

      if (filters?.staffId) {
        query = query.eq('staff_id', filters.staffId)
      }
      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId)
      }
      if (filters?.startDate) {
        query = query.gte('shift_date', filters.startDate)
      }
      if (filters?.endDate) {
        query = query.lte('shift_date', filters.endDate)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Shift[]
    },
  })
}

// Create shift
export function useCreateShift() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (shiftData: Partial<Shift>) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          ...shiftData,
          created_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

// Update shift
export function useUpdateShift() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Shift> & { id: string }) => {
      const { data, error } = await supabase
        .from('shifts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

// Delete shift
export function useDeleteShift() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

// ============================================
// SHIFT REQUESTS
// ============================================

// Get shift requests
export function useShiftRequests(filters?: {
  staffId?: string
  status?: string
}) {
  return useQuery({
    queryKey: ['shift-requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('shift_requests')
        .select(`
          *,
          staff:staff(id, first_name, last_name, first_name_ar, last_name_ar)
        `)
        .order('created_at', { ascending: false })

      if (filters?.staffId) {
        query = query.eq('staff_id', filters.staffId)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) throw error
      return data as ShiftRequest[]
    },
  })
}

// Create shift request
export function useCreateShiftRequest() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (requestData: Partial<ShiftRequest>) => {
      const { data, error } = await supabase
        .from('shift_requests')
        .insert({
          ...requestData,
          requested_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-requests'] })
    },
  })
}

// Review (approve/reject) shift request
export function useReviewShiftRequest() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { data, error } = await supabase
        .from('shift_requests')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-requests'] })
    },
  })
}

