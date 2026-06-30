import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet, pickFields } from '../utils/sql.js'

const router = Router()
const FIELDS = [
  'name',
  'name_ar',
  'address',
  'address_ar',
  'phone',
  'email',
  'is_active',
] as const

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM locations WHERE is_active = true ORDER BY name_ar ASC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM locations WHERE id = $1`, [req.params.id])
    if (!rows[0]) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, FIELDS)
    const keys = Object.keys(body)
    if (keys.length === 0) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const cols = keys.join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `INSERT INTO locations (${cols}) VALUES (${placeholders}) RETURNING *`,
      keys.map((k) => body[k as keyof typeof body])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, FIELDS)
    const built = buildUpdateSet(body as Record<string, unknown>)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات للتحديث' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE locations SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    if (!rows[0]) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE locations SET is_active = false, updated_at = now() WHERE id = $1`,
      [req.params.id]
    )
    if (!rowCount) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
