import { Router } from 'express'
import { randomUUID } from 'crypto'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAnyRole } from '../middleware/requireRole.js'
import { hashPassword } from '../services/authService.js'
import { userHasAnyRole } from '../services/userService.js'

const router = Router()

const INSTANCE_ID = '00000000-0000-0000-0000-000000000000'

const USER_STATS_CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e']
const USER_STATS_EXCLUDED_STATUSES = ['cancelled', 'no_show']

function parseMonthParam(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return null
  const [, month] = value.split('-').map(Number)
  if (month < 1 || month > 12) return null
  return value
}

function buildMonthRange(from: string, to: string): string[] {
  const months: string[] = []
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  let year = fromYear
  let month = fromMonth
  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }
  return months
}

function monthToRangeStart(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString()
}

function monthToRangeEnd(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString()
}

async function requireSuperAdmin(req: import('express').Request, res: import('express').Response) {
  if (!req.user) {
    res.status(401).json({ error: 'غير مصرح' })
    return false
  }
  const ok = await userHasAnyRole(req.user.id, ['SuperAdmin'])
  if (!ok) {
    res.status(403).json({ error: 'غير مصرح - مدير عام فقط' })
    return false
  }
  return true
}

router.get('/users', requireAuth, async (req, res, next) => {
  try {
    const { rows: users } = await pool.query<{
      id: string
      email: string
      banned_until: string | null
    }>(
      `SELECT u.id, u.email, u.banned_until
       FROM auth.users u
       ORDER BY u.created_at DESC`
    )

    const { rows: accounts } = await pool.query<{
      user_id: string
      is_active: boolean
      deleted_at: string | null
    }>(`SELECT user_id, is_active, deleted_at FROM user_accounts`)

    const accountMap = new Map(accounts.map((a) => [a.user_id, a]))

    const visible = users
      .filter((u) => !accountMap.get(u.id)?.deleted_at)
      .map((u) => ({
        id: u.id,
        email: u.email,
        is_active: accountMap.get(u.id)?.is_active ?? true,
        banned_until: u.banned_until,
      }))

    res.json({ users: visible })
  } catch (err) {
    next(err)
  }
})

router.get('/users/:userId/roles', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query<{ name: string }>(
      `SELECT r.name
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [req.params.userId]
    )
    res.json(rows.map((r) => r.name).filter(Boolean))
  } catch (err) {
    next(err)
  }
})

router.post('/users', requireAuth, async (req, res, next) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return

    const { email, password, role } = req.body ?? {}
    if (!email || !password) {
      res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' })
      return
    }

    const userId = randomUUID()
    const encrypted = await hashPassword(password)

    await pool.query(
      `INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at
      ) VALUES ($1, $2, 'authenticated', 'authenticated', $3, $4, now(), now(), now())`,
      [userId, INSTANCE_ID, email.trim().toLowerCase(), encrypted]
    )

    await pool.query(
      `INSERT INTO user_accounts (user_id, is_active) VALUES ($1, true)
       ON CONFLICT (user_id) DO UPDATE SET is_active = true, deleted_at = NULL`,
      [userId]
    )

    if (role) {
      const { rows: roleRows } = await pool.query(`SELECT id FROM roles WHERE name = $1`, [role])
      if (roleRows[0]) {
        await pool.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, roleRows[0].id]
        )
      }
    }

    res.status(201).json({
      success: true,
      user: { id: userId, email: email.trim().toLowerCase() },
    })
  } catch (err) {
    next(err)
  }
})

router.patch('/users', requireAuth, async (req, res, next) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return

    const { userId, isActive } = req.body ?? {}
    if (!userId || typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'معرف المستخدم وحالة التفعيل مطلوبان' })
      return
    }
    if (userId === req.user!.id) {
      res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الخاص' })
      return
    }

    if (isActive) {
      await pool.query(
        `INSERT INTO user_accounts (user_id, is_active, updated_at)
         VALUES ($1, true, now())
         ON CONFLICT (user_id) DO UPDATE SET is_active = true, updated_at = now()`,
        [userId]
      )
      await pool.query(`UPDATE auth.users SET banned_until = NULL WHERE id = $1`, [userId])
    } else {
      await pool.query(
        `INSERT INTO user_accounts (user_id, is_active, updated_at)
         VALUES ($1, false, now())
         ON CONFLICT (user_id) DO UPDATE SET is_active = false, updated_at = now()`,
        [userId]
      )
      await pool.query(
        `UPDATE auth.users SET banned_until = '2099-12-31T23:59:59Z' WHERE id = $1`,
        [userId]
      )
    }

    res.json({
      success: true,
      message: isActive ? 'تم تفعيل تسجيل الدخول' : 'تم تعطيل تسجيل الدخول',
    })
  } catch (err) {
    next(err)
  }
})

router.put('/users', requireAuth, async (req, res, next) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return

    const { userId, email, password } = req.body ?? {}
    if (!userId) {
      res.status(400).json({ error: 'معرف المستخدم مطلوب' })
      return
    }

    if (email) {
      await pool.query(`UPDATE auth.users SET email = $1, updated_at = now() WHERE id = $2`, [
        email.trim().toLowerCase(),
        userId,
      ])
    }
    if (password) {
      const encrypted = await hashPassword(password)
      await pool.query(
        `UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2`,
        [encrypted, userId]
      )
    }

    const { rows } = await pool.query(`SELECT id, email FROM auth.users WHERE id = $1`, [userId])
    res.json({ success: true, user: rows[0] })
  } catch (err) {
    next(err)
  }
})

router.delete('/users', requireAuth, async (req, res, next) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return

    const { userId } = req.body ?? {}
    if (!userId) {
      res.status(400).json({ error: 'معرف المستخدم مطلوب' })
      return
    }
    if (userId === req.user!.id) {
      res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الخاص' })
      return
    }

    const now = new Date().toISOString()
    await pool.query(
      `INSERT INTO user_accounts (user_id, is_active, deleted_at, deleted_by, updated_at)
       VALUES ($1, false, $2, $3, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         is_active = false, deleted_at = $2, deleted_by = $3, updated_at = $2`,
      [userId, now, req.user!.id]
    )
    await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId])
    await pool.query(`UPDATE staff SET is_active = false WHERE user_id = $1`, [userId])
    await pool.query(
      `UPDATE auth.users SET banned_until = '2099-12-31T23:59:59Z', raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"deleted":true}'::jsonb WHERE id = $1`,
      [userId]
    )

    res.json({ success: true, message: 'تم تعطيل المستخدم بنجاح' })
  } catch (err) {
    next(err)
  }
})

router.get('/user-stats', requireAuth, async (req, res, next) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return

    const from = parseMonthParam(req.query.from)
    const to = parseMonthParam(req.query.to)

    if (!from || !to) {
      res.status(400).json({ error: 'معاملات from و to مطلوبة بصيغة YYYY-MM' })
      return
    }
    if (from > to) {
      res.status(400).json({ error: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' })
      return
    }

    const months = buildMonthRange(from, to)
    const rangeStart = monthToRangeStart(from)
    const rangeEnd = monthToRangeEnd(to)

    const { rows: aggregates } = await pool.query<{
      user_id: string
      month_key: string
      cnt: string
    }>(
      `SELECT created_by::text AS user_id,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month_key,
              COUNT(*)::text AS cnt
       FROM reservations
       WHERE created_at >= $1 AND created_at <= $2
         AND created_by IS NOT NULL
         AND NOT (status::text = ANY($3::text[]))
       GROUP BY created_by, month_key`,
      [rangeStart, rangeEnd, USER_STATS_EXCLUDED_STATUSES]
    )

    const totalsByUser: Record<string, number> = {}
    const monthlyByUser: Record<string, Record<string, number>> = {}

    for (const row of aggregates) {
      const count = parseInt(row.cnt, 10) || 0
      totalsByUser[row.user_id] = (totalsByUser[row.user_id] ?? 0) + count
      if (!monthlyByUser[row.user_id]) monthlyByUser[row.user_id] = {}
      monthlyByUser[row.user_id][row.month_key] = count
    }

    const { rows: authUsers } = await pool.query<{ id: string; email: string | null }>(
      `SELECT id::text AS id, email FROM auth.users`
    )
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

    const chartSeries = sortedUserIds.slice(0, 5).map((userId, index) => ({
      userId,
      email: emailMap.get(userId) ?? 'غير معروف',
      color: USER_STATS_CHART_COLORS[index % USER_STATS_CHART_COLORS.length],
      data: months.map((month) => ({
        month,
        count: monthlyByUser[userId]?.[month] ?? 0,
      })),
    }))

    const totalReservations = Object.values(totalsByUser).reduce((sum, n) => sum + n, 0)
    const activeUsers = sortedUserIds.length
    const topPerformer = users[0]
    const avgPerUser =
      activeUsers > 0 ? Math.round((totalReservations / activeUsers) * 10) / 10 : 0

    res.json({
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
  } catch (err) {
    next(err)
  }
})

router.post(
  '/update-unit-statuses',
  requireAuth,
  requireAnyRole('SuperAdmin', 'Receptionist'),
  async (_req, res, next) => {
    try {
      await pool.query('SELECT update_all_unit_statuses()')
      res.json({
        success: true,
        message: 'تم تحديث حالات الوحدات بنجاح',
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
