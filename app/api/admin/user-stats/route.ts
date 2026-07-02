import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  createAdminClient,
  handleSupabaseRouteError,
  safeSupabaseCall,
  SupabaseUnavailableError,
  validateSupabaseAdminConfig,
} from '@/lib/supabase/admin-server'
import { buildMonthRange } from '@/lib/utils/user-stats'

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e']
const EXCLUDED_STATUSES = new Set(['cancelled', 'no_show'])

async function getVerifiedAuthUser(request: NextRequest): Promise<{ id: string } | null> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
  const admin = createAdminClient()

  if (bearer) {
    const {
      data: { user },
      error,
    } = await safeSupabaseCall(() => admin.auth.getUser(bearer))
    if (error || !user) return null
    return { id: user.id }
  }

  try {
    const cookieStore = cookies()
    // Loaded lazily so `@supabase/auth-helpers-nextjs` is never imported in api mode.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRouteHandlerClient } =
      require('@supabase/auth-helpers-nextjs') as typeof import('@supabase/auth-helpers-nextjs')
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
    } = await safeSupabaseCall(() => supabaseAuth.auth.getSession())
    if (!session?.user) return null
    return { id: session.user.id }
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) throw error
    return null
  }
}

async function userIsSuperAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data: roleData } = await safeSupabaseCall(() =>
    admin.from('roles').select('id').eq('name', 'SuperAdmin').single()
  )

  if (!roleData) return false

  const { data: userRole } = await safeSupabaseCall(() =>
    admin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('role_id', roleData.id)
      .maybeSingle()
  )

  return !!userRole
}

async function requireSuperAdmin(
  request: NextRequest
): Promise<{ id: string } | NextResponse> {
  const authed = await getVerifiedAuthUser(request)
  if (!authed) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const isSuperAdmin = await userIsSuperAdmin(authed.id)
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'غير مصرح - مدير عام فقط' }, { status: 403 })
  }

  return authed
}

function parseMonthParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const [year, month] = value.split('-').map(Number)
  if (month < 1 || month > 12) return null
  return value
}

function monthToRangeStart(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString()
}

function monthToRangeEnd(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString()
}

function toMonthKey(isoDate: string): string {
  const d = new Date(isoDate)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

async function listAllUsers(): Promise<Array<{ id: string; email?: string }>> {
  const supabaseAdmin = createAdminClient()
  const allUsers: Array<{ id: string; email?: string }> = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await safeSupabaseCall(() =>
      supabaseAdmin.auth.admin.listUsers({ page, perPage })
    )
    if (error) throw error
    allUsers.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }

  return allUsers
}

export async function GET(request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const authResult = await requireSuperAdmin(request)
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(request.url)
    const from = parseMonthParam(searchParams.get('from'))
    const to = parseMonthParam(searchParams.get('to'))

    if (!from || !to) {
      return NextResponse.json(
        { error: 'معاملات from و to مطلوبة بصيغة YYYY-MM' },
        { status: 400 }
      )
    }

    if (from > to) {
      return NextResponse.json(
        { error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' },
        { status: 400 }
      )
    }

    const months = buildMonthRange(from, to)
    const rangeStart = monthToRangeStart(from)
    const rangeEnd = monthToRangeEnd(to)

    const supabaseAdmin = createAdminClient()

    const { data: reservations, error: reservationsError } = await safeSupabaseCall(() =>
      supabaseAdmin
        .from('reservations')
        .select('id, created_by, created_at, status')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd)
        .not('created_by', 'is', null)
    )

    if (reservationsError) {
      return NextResponse.json({ error: reservationsError.message }, { status: 400 })
    }

    const totalsByUser: Record<string, number> = {}
    const monthlyByUser: Record<string, Record<string, number>> = {}

    for (const row of reservations ?? []) {
      if (!row.created_by || EXCLUDED_STATUSES.has(row.status)) continue

      const userId = row.created_by as string
      const monthKey = toMonthKey(row.created_at as string)

      totalsByUser[userId] = (totalsByUser[userId] ?? 0) + 1
      if (!monthlyByUser[userId]) monthlyByUser[userId] = {}
      monthlyByUser[userId][monthKey] = (monthlyByUser[userId][monthKey] ?? 0) + 1
    }

    const authUsers = await listAllUsers()
    const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? 'غير معروف']))

    const sortedUserIds = Object.keys(totalsByUser).sort(
      (a, b) => (totalsByUser[b] ?? 0) - (totalsByUser[a] ?? 0)
    )

    const users = sortedUserIds.map((userId, index) => ({
      userId,
      email: emailMap.get(userId) ?? 'غير معروف',
      total: totalsByUser[userId] ?? 0,
      rank: index + 1,
    }))

    const topFiveIds = sortedUserIds.slice(0, 5)
    const chartSeries = topFiveIds.map((userId, index) => ({
      userId,
      email: emailMap.get(userId) ?? 'غير معروف',
      color: CHART_COLORS[index % CHART_COLORS.length],
      data: months.map((month) => ({
        month,
        count: monthlyByUser[userId]?.[month] ?? 0,
      })),
    }))

    const totalReservations = Object.values(totalsByUser).reduce((sum, n) => sum + n, 0)
    const activeUsers = sortedUserIds.length
    const topPerformer = users[0]
    const avgPerUser = activeUsers > 0 ? Math.round((totalReservations / activeUsers) * 10) / 10 : 0

    return NextResponse.json({
      range: { from, to },
      months,
      users,
      chartSeries,
      summary: {
        totalReservations,
        activeUsers,
        topPerformerEmail: topPerformer?.email ?? null,
        topPerformerCount: topPerformer?.total ?? 0,
        avgPerUser,
      },
    })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء جلب إحصائيات المستخدمين')
  }
}
