import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Guest } from '@/lib/types/database'

// Strip characters that would break a PostgREST `.or(...ilike.…)` filter
// (commas/parens are reserved separators, % and _ are ilike wildcards) so we
// can interpolate user input safely without false matches.
function sanitizeIlike(q: string): string {
  return q
    .replace(/\\/g, '')
    .replace(/%/g, '')
    .replace(/_/g, '')
    .replace(/[,()]/g, '')
    .trim()
}

// Normalize Arabic-Indic and Persian digits to ASCII so a phone typed as
// "٠٥٠٠..." matches a phone stored as "0500...".
function normalizeDigits(q: string): string {
  return q.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.charCodeAt(0)
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660)
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0)
    return d
  })
}

export function useGuests(search?: string) {
  const trimmed = search?.trim() || ''
  const normalized = trimmed ? sanitizeIlike(normalizeDigits(trimmed)) : ''

  return useQuery({
    // Key on the normalized search so equivalent inputs share a cache slot.
    queryKey: ['guests', normalized],
    queryFn: async () => {
      let query = supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false })

      if (normalized) {
        const pat = `%${normalized}%`
        query = query
          .or(
            [
              `first_name.ilike.${pat}`,
              `last_name.ilike.${pat}`,
              `first_name_ar.ilike.${pat}`,
              `last_name_ar.ilike.${pat}`,
              `phone.ilike.${pat}`,
              `email.ilike.${pat}`,
              `national_id.ilike.${pat}`,
            ].join(',')
          )
          .limit(200)
      } else {
        query = query.limit(100)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Guest[]
    },
  })
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: ['guest', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Guest
    },
    enabled: !!id,
  })
}

export function useCreateGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (guest: Partial<Guest>) => {
      console.log('Creating guest with data:', guest)
      
      // Ensure required fields are present
      if (!guest.first_name || !guest.last_name || !guest.phone) {
        throw new Error('الاسم الأول والاسم الأخير ورقم الهاتف مطلوبة')
      }

      const { data, error } = await supabase
        .from('guests')
        .insert({
          first_name: guest.first_name,
          last_name: guest.last_name,
          phone: guest.phone,
          email: guest.email || null,
          first_name_ar: guest.first_name_ar || null,
          last_name_ar: guest.last_name_ar || null,
          national_id: guest.national_id || null,
          military_rank: guest.military_rank || null,
          military_rank_ar: guest.military_rank_ar || null,
          unit: guest.unit || null,
          unit_ar: guest.unit_ar || null,
          guest_type: guest.guest_type || 'military',
          notes: guest.notes || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating guest:', error)
        throw error
      }
      
      console.log('Guest created successfully:', data)
      return data as Guest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] })
      queryClient.refetchQueries({ queryKey: ['guests'] })
    },
  })
}

export function useUpdateGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Guest> & { id: string }) => {
      const { data, error } = await supabase
        .from('guests')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Guest
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['guests'] })
      queryClient.invalidateQueries({ queryKey: ['guest', data.id] })
      queryClient.refetchQueries({ queryKey: ['guests'] })
      queryClient.refetchQueries({ queryKey: ['guest', data.id] })
    },
  })
}

export function useDeleteGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('guests')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] })
      queryClient.refetchQueries({ queryKey: ['guests'] })
    },
  })
}

