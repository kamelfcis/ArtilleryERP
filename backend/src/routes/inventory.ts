import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAnyRole } from '../middleware/requireRole.js'
import { buildInsert, buildUpdateSet, pickFields } from '../utils/sql.js'

const router = Router()
const MANAGER_ROLES = ['SuperAdmin', 'BranchManager'] as const

const CATEGORY_FIELDS = ['name', 'name_ar', 'description', 'description_ar'] as const
const ITEM_FIELDS = [
  'name',
  'name_ar',
  'category_id',
  'location_id',
  'sku',
  'description',
  'description_ar',
  'unit',
  'current_stock',
  'min_stock',
  'max_stock',
  'unit_price',
  'supplier',
  'supplier_ar',
  'is_active',
] as const

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

router.post('/categories', requireAuth, requireAnyRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, CATEGORY_FIELDS)
    const built = buildInsert(body, CATEGORY_FIELDS)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `INSERT INTO inventory_categories (${built.columns}) VALUES (${built.placeholders}) RETURNING *`,
      built.values
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

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

router.post('/items', requireAuth, requireAnyRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, ITEM_FIELDS)
    const built = buildInsert(body, ITEM_FIELDS)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `INSERT INTO inventory_items (${built.columns}) VALUES (${built.placeholders}) RETURNING *`,
      built.values
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/items/:id', requireAuth, requireAnyRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, ITEM_FIELDS)
    const built = buildUpdateSet(body, 1, ITEM_FIELDS)
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

router.delete('/items/:id', requireAuth, requireAnyRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM inventory_items WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
