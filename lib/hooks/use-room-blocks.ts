import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/http-client'

export function useRoomBlocks() {
  return useQuery({
    queryKey: ['room-blocks'],
    queryFn: async () => {
      if (isApiProvider()) return apiGet<unknown[]>('/room-blocks')
      const { data, error } = await supabase
        .from('room_blocks')
        .select(`
          *,
          units:room_block_units (
            unit:units (
              id,
              unit_number,
              name,
              name_ar
            )
          )
        `)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useDeleteRoomBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (isApiProvider()) {
        await apiDelete(`/room-blocks/${id}`)
        return
      }
      const { error } = await supabase.from('room_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['room-blocks'] }),
  })
}

export function useSaveRoomBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id?: string
      blockData: Record<string, unknown>
      unitIds: string[]
    }) => {
      if (isApiProvider()) {
        if (payload.id) {
          return apiPatch(`/room-blocks/${payload.id}`, {
            ...payload.blockData,
            unitIds: payload.unitIds,
          })
        }
        return apiPost('/room-blocks', {
          ...payload.blockData,
          unitIds: payload.unitIds,
        })
      }

      if (payload.id) {
        const { error } = await supabase
          .from('room_blocks')
          .update(payload.blockData)
          .eq('id', payload.id)
        if (error) throw error
        await supabase.from('room_block_units').delete().eq('block_id', payload.id)
        if (payload.unitIds.length > 0) {
          const unitLinks = payload.unitIds.map((unitId) => ({
            block_id: payload.id,
            unit_id: unitId,
          }))
          const { error: linkError } = await supabase.from('room_block_units').insert(unitLinks)
          if (linkError) throw linkError
        }
        return
      }

      const { data, error } = await supabase
        .from('room_blocks')
        .insert(payload.blockData)
        .select()
        .single()
      if (error) throw error
      if (payload.unitIds.length > 0) {
        const unitLinks = payload.unitIds.map((unitId) => ({
          block_id: data.id,
          unit_id: unitId,
        }))
        const { error: linkError } = await supabase.from('room_block_units').insert(unitLinks)
        if (linkError) throw linkError
      }
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['room-blocks'] }),
  })
}
