import { useQuery } from '@tanstack/react-query'
import { fetchWithSupabaseAuth } from '@/lib/api/fetch-with-supabase-auth'

export interface UserStatsEntry {
  userId: string
  email: string
  total: number
  rank: number
}

export interface ChartSeriesEntry {
  userId: string
  email: string
  color: string
  data: Array<{ month: string; count: number }>
}

export interface UserStatsSummary {
  totalReservations: number
  activeUsers: number
  topPerformerEmail: string | null
  topPerformerCount: number
  avgPerUser: number
}

export interface UserStatsResponse {
  range: { from: string; to: string }
  months: string[]
  users: UserStatsEntry[]
  chartSeries: ChartSeriesEntry[]
  summary: UserStatsSummary
}

export function useUserStats(from: string | null, to: string | null) {
  return useQuery({
    queryKey: ['user-stats', from, to],
    queryFn: async () => {
      const response = await fetchWithSupabaseAuth(
        `/api/admin/user-stats?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'فشل في جلب إحصائيات المستخدمين')
      }
      return response.json() as Promise<UserStatsResponse>
    },
    enabled: !!from && !!to,
  })
}
