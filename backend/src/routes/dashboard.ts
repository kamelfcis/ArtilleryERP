import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { RESERVATION_STATUSES } from '../constants.js'

const router = Router()
const POSTGREST_PAGE_SIZE = 1000
const EXCLUDED_REVENUE_STATUSES = ['cancelled', 'no_show']

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocationIds(raw: unknown): string[] | null {
  if (raw == null || raw === '') return null
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  const str = String(raw)
  return str.includes(',') ? str.split(',').map((s) => s.trim()).filter(Boolean) : [str]
}

async function resolveUnitIds(filters: {
  locationId?: string
  locationIds?: string[]
}): Promise<string[] | null> {
  const locationIds =
    filters.locationIds && filters.locationIds.length > 0
      ? filters.locationIds
      : filters.locationId
        ? [filters.locationId]
        : null
  if (!locationIds) return null
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM units WHERE location_id = ANY($1::uuid[]) AND is_active = true`,
    [locationIds]
  )
  return rows.map((r) => r.id)
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
  const conditions = ['1=1']
  const params: unknown[] = []
  if (unitIds !== null) {
    params.push(unitIds)
    conditions.push(`unit_id = ANY($${params.length}::uuid[])`)
  }
  if (filters?.status) {
    params.push(filters.status)
    conditions.push(`status = $${params.length}`)
  }
  if (filters?.excludeStatuses?.length) {
    params.push(filters.excludeStatuses)
    conditions.push(`NOT (status = ANY($${params.length}::text[]))`)
  }
  if (filters?.checkInFrom) {
    params.push(filters.checkInFrom)
    conditions.push(`check_in_date >= $${params.length}`)
  }
  if (filters?.checkInTo) {
    params.push(filters.checkInTo)
    conditions.push(`check_in_date <= $${params.length}`)
  }
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM reservations WHERE ${conditions.join(' AND ')}`,
    params
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

async function sumRevenue(
  unitIds: string[] | null,
  filters?: { excludeStatuses?: string[]; checkInFrom?: string; checkInTo?: string }
): Promise<number> {
  if (unitIds !== null && unitIds.length === 0) return 0
  const conditions = ['1=1']
  const params: unknown[] = []
  if (unitIds !== null) {
    params.push(unitIds)
    conditions.push(`unit_id = ANY($${params.length}::uuid[])`)
  }
  if (filters?.excludeStatuses?.length) {
    params.push(filters.excludeStatuses)
    conditions.push(`NOT (status = ANY($${params.length}::text[]))`)
  }
  if (filters?.checkInFrom) {
    params.push(filters.checkInFrom)
    conditions.push(`check_in_date >= $${params.length}`)
  }
  if (filters?.checkInTo) {
    params.push(filters.checkInTo)
    conditions.push(`check_in_date <= $${params.length}`)
  }
  let sum = 0
  let offset = 0
  while (true) {
    const { rows } = await pool.query<{ total_amount: string }>(
      `SELECT total_amount FROM reservations WHERE ${conditions.join(' AND ')}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, POSTGREST_PAGE_SIZE, offset]
    )
    sum += rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)
    if (rows.length < POSTGREST_PAGE_SIZE) break
    offset += POSTGREST_PAGE_SIZE
  }
  return sum
}

router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const locationId = req.query.locationId as string | undefined
    const locationIds = parseLocationIds(req.query.locationIds) ?? undefined
    const unitIds = await resolveUnitIds({ locationId, locationIds })

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
      monthRanges.push({
        month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        from: toDateString(start),
        to: toDateString(end),
      })
    }

    const [
      totalReservations,
      pendingReservations,
      todayRevenue,
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      ...rest
    ] = await Promise.all([
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
      ...statusKeys.map((status) => countReservations(unitIds, { status })),
      ...monthRanges.map(({ from, to }) =>
        sumRevenue(unitIds, {
          excludeStatuses: EXCLUDED_REVENUE_STATUSES,
          checkInFrom: from,
          checkInTo: to,
        })
      ),
    ])

    const statusCountValues = rest.slice(0, statusKeys.length) as number[]
    const monthRevenueValues = rest.slice(statusKeys.length) as number[]

    const statusCounts: Record<string, number> = {}
    statusKeys.forEach((status, i) => {
      statusCounts[status] = statusCountValues[i]
    })

    const monthlyRevenue = monthRanges.map(({ month }, i) => ({
      month,
      revenue: monthRevenueValues[i],
    }))

    const averageRevenue = totalReservations > 0 ? totalRevenue / totalReservations : 0
    const monthlyGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0

    res.json({
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
    })
  } catch (err) {
    next(err)
  }
})

export default router
