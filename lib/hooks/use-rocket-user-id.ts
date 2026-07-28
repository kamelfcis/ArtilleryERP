import { useQuery } from '@tanstack/react-query'
import { getRocketUserIdFromEnv } from '@/lib/constants/rocket-hotel'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet } from '@/lib/api/http-client'

export function useRocketUserId() {
  const envId = getRocketUserIdFromEnv()

  return useQuery({
    queryKey: ['rocket-user-id', envId ?? 'lookup'],
    queryFn: async (): Promise<string | null> => {
      if (envId) return envId

      if (isApiProvider()) {
        const json = await apiGet<{ id: string | null }>('/admin/rocket-user')
        return json.id ?? null
      }

      return null
    },
    staleTime: envId ? Infinity : 5 * 60 * 1000,
    enabled: true,
  })
}
