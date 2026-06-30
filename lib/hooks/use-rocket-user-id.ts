import { useQuery } from '@tanstack/react-query'
import {
  getRocketUserIdFromEnv,
  isRocketHotelEmail,
} from '@/lib/constants/rocket-hotel'
import { fetchAdminUsers } from '@/lib/api/admin-users'

export function useRocketUserId() {
  const envId = getRocketUserIdFromEnv()

  return useQuery({
    queryKey: ['rocket-user-id', envId ?? 'lookup'],
    queryFn: async (): Promise<string | null> => {
      if (envId) return envId

      const users = await fetchAdminUsers()
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
