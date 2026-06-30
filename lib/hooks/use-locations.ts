import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Location } from '@/lib/types/database'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/http-client'

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      if (isApiProvider()) {
        return apiGet<Location[]>('/locations')
      }
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name_ar', { ascending: true })

      if (error) throw error
      return data as Location[]
    },
    staleTime: 300_000,
    gcTime: 600_000,
  })
}

export function useLocation(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['location', id],
    queryFn: async () => {
      if (isApiProvider()) {
        return apiGet<Location>(`/locations/${id}`)
      }
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Location
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
  })
}

export function useCreateLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (location: Partial<Location>) => {
      if (isApiProvider()) {
        return apiPost<Location>('/locations', location)
      }
      const { data, error } = await supabase
        .from('locations')
        .insert(location)
        .select()
        .single()

      if (error) throw error
      return data as Location
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })
}

export function useUpdateLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Location> & { id: string }) => {
      if (isApiProvider()) {
        return apiPatch<Location>(`/locations/${id}`, updates)
      }
      const { data, error } = await supabase
        .from('locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Location
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      queryClient.invalidateQueries({ queryKey: ['location', data.id] })
    },
  })
}

export function useDeleteLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (isApiProvider()) {
        await apiDelete(`/locations/${id}`)
        return
      }
      const { error } = await supabase
        .from('locations')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })
}
