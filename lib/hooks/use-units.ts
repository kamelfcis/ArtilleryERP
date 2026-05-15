import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Unit } from '@/lib/types/database'

export function useUnits(filters?: {
  locationId?: string
  type?: string
  status?: string
  /**
   * When true, fetches only the fields needed by the calendar / timeline
   * view instead of the full nested select (no images, facilities, or
   * location sub-objects).  Reduces payload size by ~80 %.
   * Existing callers that pass no value continue to receive the full row.
   */
  onlyCalendarFields?: boolean
}) {
  return useQuery({
    queryKey: ['units', filters],
    queryFn: async () => {
      const selectClause = filters?.onlyCalendarFields
        ? 'id, unit_number, name, name_ar, type, location_id, is_active, status, beds, orderno'
        : `
          *,
          location:locations (*),
          images:unit_images (*),
          facilities:unit_facilities (
            facility:facilities (*)
          )
        `

      let query = supabase
        .from('units')
        .select(selectClause)
        .eq('is_active', true)
        .order('orderno', { ascending: true, nullsFirst: false })
        .order('unit_number', { ascending: true })

      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId)
      }
      if (filters?.type) {
        query = query.eq('type', filters.type)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) throw error
      // When onlyCalendarFields is true the Supabase client infers a partial
      // type from the slim select string. We cast through unknown so TypeScript
      // accepts it — callers can rely on the fields listed in the selectClause.
      return data as unknown as Unit[]
    },
  })
}

export function useUnit(id: string) {
  return useQuery({
    queryKey: ['unit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select(`
          *,
          location:locations (*),
          images:unit_images (*),
          facilities:unit_facilities (
            facility:facilities (*)
          ),
          pricing (*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Unit
    },
    enabled: !!id,
  })
}

export function useCreateUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (unit: Partial<Unit>) => {
      const { data, error } = await supabase
        .from('units')
        .insert(unit)
        .select()
        .single()

      if (error) throw error
      return data as Unit
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.refetchQueries({ queryKey: ['units'] })
    },
  })
}

export function useUpdateUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Unit> & { id: string }) => {
      const { data, error } = await supabase
        .from('units')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Unit
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['unit', data.id] })
      queryClient.refetchQueries({ queryKey: ['units'] })
      queryClient.refetchQueries({ queryKey: ['unit', data.id] })
    },
  })
}

export function useDeleteUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        // First, delete all related unit images from storage and database
        const { data: unitImages, error: imagesError } = await supabase
          .from('unit_images')
          .select('image_path')
          .eq('unit_id', id)

        if (imagesError) {
          console.error('Error fetching unit images:', imagesError)
        }

        if (unitImages && unitImages.length > 0) {
          // Delete images from storage
          const imagePaths = unitImages.map(img => img.image_path)
          const { error: storageError } = await supabase.storage
            .from('unit-images')
            .remove(imagePaths)

          if (storageError) {
            console.error('Error deleting images from storage:', storageError)
          }

          // Delete the entire unit folder from storage
          const unitFolder = `unit-${id}`
          const { data: folderFiles } = await supabase.storage
            .from('unit-images')
            .list(unitFolder)
          
          if (folderFiles && folderFiles.length > 0) {
            const folderFilePaths = folderFiles.map(file => `${unitFolder}/${file.name}`)
            await supabase.storage
              .from('unit-images')
              .remove(folderFilePaths)
              .catch(err => console.error('Error deleting unit folder:', err))
          }

          // Delete image records from database
          const { error: imageRecordsError } = await supabase
            .from('unit_images')
            .delete()
            .eq('unit_id', id)

          if (imageRecordsError) {
            console.error('Error deleting image records:', imageRecordsError)
          }
        }

        // Delete unit facilities links
        const { error: facilitiesError } = await supabase
          .from('unit_facilities')
          .delete()
          .eq('unit_id', id)

        if (facilitiesError) {
          console.error('Error deleting facility links:', facilitiesError)
        }

        // Hard delete the unit from database
        const { error } = await supabase
          .from('units')
          .delete()
          .eq('id', id)

        if (error) throw error
      } catch (error) {
        console.error('Error in deleteUnit:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
    },
  })
}

