import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Facility } from '@/lib/types/database'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/http-client'

export function useFacilities() {
  return useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      if (isApiProvider()) return apiGet<Facility[]>('/facilities')
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .order('name_ar', { ascending: true })
      if (error) throw error
      return data as Facility[]
    },
  })
}

export function useCreateFacility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (facility: Partial<Facility>) => {
      if (isApiProvider()) return apiPost<Facility>('/facilities', facility)
      const { data, error } = await supabase.from('facilities').insert(facility).select().single()
      if (error) throw error
      return data as Facility
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facilities'] }),
  })
}

export function useUpdateFacility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Facility> & { id: string }) => {
      if (isApiProvider()) return apiPatch<Facility>(`/facilities/${id}`, updates)
      const { data, error } = await supabase.from('facilities').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data as Facility
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facilities'] }),
  })
}

export function useDeleteFacility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (isApiProvider()) {
        await apiDelete(`/facilities/${id}`)
        return
      }
      const { error } = await supabase.from('facilities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facilities'] }),
  })
}
