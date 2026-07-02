import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet } from '../utils/sql.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    if (req.query.unitId) {
      params.push(req.query.unitId)
      conditions.push(`p.unit_id = $${params.length}`)
    }
    if (req.query.pricingType) {
      params.push(req.query.pricingType)
      conditions.push(`p.pricing_type = $${params.length}`)
    }
    if (req.query.isActive !== undefined) {
      params.push(req.query.isActive === 'true')
      conditions.push(`p.is_active = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT p.*,
        (SELECT row_to_json(u2) FROM (
          SELECT u.id, u.unit_number, u.name, u.name_ar FROM units u WHERE u.id = p.unit_id
        ) u2) AS unit
       FROM pricing p WHERE ${conditions.join(' AND ')}
       ORDER BY p.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM pricing WHERE id = $1`, [req.params.id])
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
    const body = req.body ?? {}
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO pricing (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const built = buildUpdateSet(req.body ?? {})
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE pricing SET ${built.setClause} WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM pricing WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
