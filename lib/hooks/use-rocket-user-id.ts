import { useQuery } from '@tanstack/react-query'
import { fetchWithSupabaseAuth } from '@/lib/api/fetch-with-supabase-auth'
import {
  getRocketUserIdFromEnv,
  isRocketHotelEmail,
} from '@/lib/constants/rocket-hotel'

export function useRocketUserId() {
  const envId = getRocketUserIdFromEnv()

  return useQuery({
    queryKey: ['rocket-user-id', envId ?? 'lookup'],
    queryFn: async (): Promise<string | null> => {
      if (envId) return envId

      const res = await fetchWithSupabaseAuth('/api/admin/users')
      if (!res.ok) {
        console.warn('[rocket-user-id] admin users API failed:', res.status)
        return null
      }
      const json = await res.json()
      const users = (json.users ?? []) as { id: string; email: string }[]
      const rocket = users.find((u) => isRocketHotelEmail(u.email))
      if (!rocket) {
        console.warn('[rocket-user-id] rocket@hotel.com not found in auth users')
      }
      return rocket?.id ?? null
    },
    staleTime: envId ? Infinity : 5 * 60 * 1000,
    enabled: true,
  })
}
