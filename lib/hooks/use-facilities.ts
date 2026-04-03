import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Facility } from '@/lib/types/database'

export function useFacilities() {
  return useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
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
      const { data, error } = await supabase
        .from('facilities')
        .insert(facility)
        .select()
        .single()

      if (error) throw error
      return data as Facility
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
  })
}

export function useUpdateFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Facility> & { id: string }) => {
      const { data, error } = await supabase
        .from('facilities')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Facility
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
  })
}

export function useDeleteFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('facilities')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
  })
}

