import { Router } from 'express'
import { randomUUID } from 'crypto'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAnyRole } from '../middleware/requireRole.js'
import { hashPassword } from '../services/authService.js'
import { userHasAnyRole } from '../services/userService.js'

const router = Router()

const INSTANCE_ID = '00000000-0000-0000-0000-000000000000'

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
