import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { RESERVATION_STATUSES } from '@/lib/constants'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet } from '@/lib/api/http-client'
import { buildQuery } from '@/lib/api/build-query'

const POSTGREST_PAGE_SIZE = 1000
const EXCLUDED_REVENUE_STATUSES = ['cancelled', 'no_show']

export type DashboardStatsFilters = {
  locationId?: string
  locationIds?: string[]
}

export type DashboardStats = {
  totalReservations: number
  pendingReservations: number
  todayRevenue: number
  totalRevenue: number
  thisMonthRevenue: number
  lastMonthRevenue: number
  averageRevenue: number
  monthlyGrowth: number
  statusCounts: Record<string, number>
  monthlyRevenue: Array<{ month: string; revenue: number }>
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function resolveUnitIds(filters?: DashboardStatsFilters): Promise<string[] | null> {
  const locationIds =
    filters?.locationIds && filters.locationIds.length > 0
      ? filters.locationIds
      : filters?.locationId
        ? [filters.locationId]
        : null

  if (!locationIds) return null

  if (isApiProvider()) {
    const units = await apiGet<Array<{ id: string }>>(
      `/units${buildQuery({ locationIds, onlyCalendarFields: 'true' })}`
    )
    return units.map((u) => u.id)
  }

  const { data, error } = await supabase
    .from('units')
    .select('id')
    .in('location_id', locationIds)
    .eq('is_active', true)

  if (error) throw error
  return data?.map((u) => u.id) ?? []
}

async function countReservations(
  unitIds: string[] | null,
  filters?: {
    status?: string
    excludeStatuses?: string[]
    checkInFrom?: string
    checkInTo?: string
  }
): Promise<number> {
  if (unitIds !== null && unitIds.length === 0) return 0

  let query = supabase.from('reservations').select('*', { count: 'exact', head: true })
  if (unitIds !== null) {
    query = query.in('unit_id', unitIds)
  }

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.excludeStatuses?.length) {
    query = query.not('status', 'in', `(${filters.excludeStatuses.join(',')})`)
  }
  if (filters?.checkInFrom) query = query.gte('check_in_date', filters.checkInFrom)
  if (filters?.checkInTo) query = query.lte('check_in_date', filters.checkInTo)

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function sumRevenue(
  unitIds: string[] | null,
  filters?: {
    excludeStatuses?: string[]
    checkInFrom?: string
    checkInTo?: string
  }
): Promise<number> {
  if (unitIds !== null && unitIds.length === 0) return 0

  let sum = 0
  let offset = 0

  while (true) {
    let query = supabase.from('reservations').select('total_amount')
    if (unitIds !== null) {
      query = query.in('unit_id', unitIds)
    }

    if (filters?.excludeStatuses?.length) {
      query = query.not('status', 'in', `(${filters.excludeStatuses.join(',')})`)
    }
    if (filters?.checkInFrom) query = query.gte('check_in_date', filters.checkInFrom)
    if (filters?.checkInTo) query = query.lte('check_in_date', filters.checkInTo)

    const { data, error } = await query.range(offset, offset + POSTGREST_PAGE_SIZE - 1)
    if (error) throw error

    const batch = data ?? []
    sum += batch.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)
    if (batch.length < POSTGREST_PAGE_SIZE) break
    offset += POSTGREST_PAGE_SIZE
  }

  return sum
}

export async function fetchDashboardStats(
  filters?: DashboardStatsFilters
): Promise<DashboardStats> {
  if (isApiProvider()) {
    return apiGet<DashboardStats>(
      `/dashboard/stats${buildQuery({
        locationId: filters?.locationId,
        locationIds: filters?.locationIds,
      })}`
    )
  }

  const unitIds = await resolveUnitIds(filters)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toDateString(today)

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

  const statusKeys = Object.keys(RESERVATION_STATUSES)

  const monthRanges: Array<{ month: string; from: string; to: string }> = []
  for (let i = 5; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
    monthRanges.push({ month: monthKey, from: toDateString(start), to: toDateString(end) })
  }

  const basePromises = [
    countReservations(unitIds),
    countReservations(unitIds, { status: 'pending' }),
    sumRevenue(unitIds, {
      excludeStatuses: EXCLUDED_REVENUE_STATUSES,
      checkInFrom: todayStr,
      checkInTo: todayStr,
    }),
    sumRevenue(unitIds, { excludeStatuses: EXCLUDED_REVENUE_STATUSES }),
    sumRevenue(unitIds, {
      excludeStatuses: EXCLUDED_REVENUE_STATUSES,
      checkInFrom: toDateString(thisMonthStart),
    }),
    sumRevenue(unitIds, {
      excludeStatuses: EXCLUDED_REVENUE_STATUSES,
      checkInFrom: toDateString(lastMonthStart),
      checkInTo: toDateString(lastMonthEnd),
    }),
  ]

  const statusPromises = statusKeys.map((status) =>
    countReservations(unitIds, { status })
  )
  const monthPromises = monthRanges.map(({ from, to }) =>
    sumRevenue(unitIds, {
      excludeStatuses: EXCLUDED_REVENUE_STATUSES,
      checkInFrom: from,
      checkInTo: to,
    })
  )

  const results = await Promise.all([...basePromises, ...statusPromises, ...monthPromises])

  const [
    totalReservations,
    pendingReservations,
    todayRevenue,
    totalRevenue,
    thisMonthRevenue,
    lastMonthRevenue,
  ] = results.slice(0, 6) as number[]

  const statusCountValues = results.slice(6, 6 + statusKeys.length) as number[]
  const monthRevenueValues = results.slice(6 + statusKeys.length) as number[]

  const statusCounts: Record<string, number> = {}
  statusKeys.forEach((status, i) => {
    statusCounts[status] = statusCountValues[i]
  })

  const monthlyRevenue = monthRanges.map(({ month }, i) => ({
    month,
    revenue: monthRevenueValues[i],
  }))

  const averageRevenue =
    totalReservations > 0 ? totalRevenue / totalReservations : 0

  const monthlyGrowth =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0

  return {
    totalReservations,
    pendingReservations,
    todayRevenue,
    totalRevenue,
    thisMonthRevenue,
    lastMonthRevenue,
    averageRevenue,
    monthlyGrowth,
    statusCounts,
    monthlyRevenue,
  }
}

export function useDashboardStats(filters?: DashboardStatsFilters) {
  return useQuery({
    queryKey: [
      'dashboard-stats',
      filters?.locationId ?? 'none',
      filters?.locationIds?.slice().sort().join(',') ?? 'all',
    ],
    queryFn: () => fetchDashboardStats(filters),
    staleTime: 60_000,
  })
}
