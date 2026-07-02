import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet } from '../utils/sql.js'

const router = Router()

// ============================================================
// INVENTORY CATEGORIES
// ============================================================
router.get('/categories', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM inventory_categories ORDER BY name_ar ASC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/categories', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO inventory_categories (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

// ============================================================
// INVENTORY ITEMS
// ============================================================
router.get('/items', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    if (req.query.locationId && req.query.locationId !== 'all') {
      params.push(req.query.locationId)
      conditions.push(`i.location_id = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT i.*,
        row_to_json(c.*) AS category,
        row_to_json(l.*) AS location
       FROM inventory_items i
       LEFT JOIN inventory_categories c ON c.id = i.category_id
       LEFT JOIN locations l ON l.id = i.location_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.name_ar ASC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/items/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*,
        row_to_json(c.*) AS category,
        row_to_json(l.*) AS location
       FROM inventory_items i
       LEFT JOIN inventory_categories c ON c.id = i.category_id
       LEFT JOIN locations l ON l.id = i.location_id
       WHERE i.id = $1`,
      [req.params.id]
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

router.post('/items', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    if (keys.length === 0) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `INSERT INTO inventory_items (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/items/:id', requireAuth, async (req, res, next) => {
  try {
    const built = buildUpdateSet(req.body ?? {})
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE inventory_items SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
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

router.delete('/items/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM inventory_items WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
