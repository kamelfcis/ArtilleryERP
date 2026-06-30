import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Guest } from '@/lib/types/database'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/http-client'
import { buildQuery } from '@/lib/api/build-query'

const POSTGREST_PAGE_SIZE = 1000

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

function normalizeSearch(search?: string): string {
  const trimmed = search?.trim() || ''
  return trimmed ? sanitizeIlike(normalizeDigits(trimmed)) : ''
}

function applyGuestSearchFilter<T extends { or: Function }>(query: T, normalized: string): T {
  if (!normalized) return query
  const pat = `%${normalized}%`
  return query.or(
    [
      `first_name.ilike.${pat}`,
      `last_name.ilike.${pat}`,
      `first_name_ar.ilike.${pat}`,
      `last_name_ar.ilike.${pat}`,
      `phone.ilike.${pat}`,
      `email.ilike.${pat}`,
      `national_id.ilike.${pat}`,
    ].join(',')
  ) as T
}

export function guestDisplayName(guest: Pick<Guest, 'first_name' | 'last_name' | 'first_name_ar' | 'last_name_ar'>) {
  return `${guest.first_name_ar || guest.first_name} ${guest.last_name_ar || guest.last_name}`.trim()
}

export type GuestsPaginatedParams = {
  search?: string
  page?: number
  pageSize?: number
  guestType?: string
}

export type GuestsPaginatedResult = {
  data: Guest[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export function useGuestsPaginated(params: GuestsPaginatedParams = {}) {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = params.pageSize ?? 25
  const normalized = normalizeSearch(params.search)

  return useQuery({
    queryKey: ['guests', 'paginated', normalized, page, pageSize, params.guestType ?? ''],
    staleTime: 60_000,
    gcTime: 300_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GuestsPaginatedResult> => {
      if (isApiProvider()) {
        return apiGet<GuestsPaginatedResult>(
          `/guests${buildQuery({
            search: normalized || undefined,
            page,
            pageSize,
            guestType: params.guestType,
          })}`
        )
      }
      let query = supabase
        .from('guests')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      query = applyGuestSearchFilter(query, normalized)

      if (params.guestType) {
        query = query.eq('guest_type', params.guestType)
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await query.range(from, to)

      if (error) throw error

      const totalCount = count ?? 0
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1

      return {
        data: (data ?? []) as Guest[],
        totalCount,
        page,
        pageSize,
        totalPages,
      }
    },
  })
}

export function useGuestsTotalCount() {
  return useQuery({
    queryKey: ['guests', 'total-count'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      if (isApiProvider()) {
        const { count } = await apiGet<{ count: number }>('/guests/count')
        return count
      }
      const { count, error } = await supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })

      if (error) throw error
      return count ?? 0
    },
  })
}

/** Paginate through PostgREST pages for CSV export or bulk operations. */
export async function fetchAllGuests(filters?: {
  search?: string
  guestType?: string
}): Promise<Guest[]> {
  if (isApiProvider()) {
    return apiGet<Guest[]>(
      `/guests${buildQuery({
        search: filters?.search,
        guestType: filters?.guestType,
        simple: 'true',
      })}`
    )
  }
  const normalized = normalizeSearch(filters?.search)
  const all: Guest[] = []
  let offset = 0

  while (true) {
    let query = supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: false })

    query = applyGuestSearchFilter(query, normalized)

    if (filters?.guestType) {
      query = query.eq('guest_type', filters.guestType)
    }

    const { data, error } = await query.range(offset, offset + POSTGREST_PAGE_SIZE - 1)
    if (error) throw error

    const batch = (data ?? []) as Guest[]
    all.push(...batch)
    if (batch.length < POSTGREST_PAGE_SIZE) break
    offset += POSTGREST_PAGE_SIZE
  }

  return all
}

export function useGuests(search?: string, options?: { enabled?: boolean }) {
  const normalized = normalizeSearch(search)

  return useQuery({
    // Key on the normalized search so equivalent inputs share a cache slot.
    queryKey: ['guests', normalized],
    enabled: options?.enabled !== false,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      if (isApiProvider()) {
        return apiGet<Guest[]>(
          `/guests${buildQuery({ search: normalized || undefined, simple: 'true' })}`
        )
      }
      let query = supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false })

      query = applyGuestSearchFilter(query, normalized)

      if (normalized) {
        query = query.limit(200)
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
      if (isApiProvider()) {
        return apiGet<Guest>(`/guests/${id}`)
      }
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

      if (isApiProvider()) {
        return apiPost<Guest>('/guests', {
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
      if (isApiProvider()) {
        return apiPatch<Guest>(`/guests/${id}`, updates)
      }
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
      if (isApiProvider()) {
        await apiDelete(`/guests/${id}`)
        return id
      }
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

