import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAnyRole } from '../middleware/requireRole.js'
import { buildInsert, buildUpdateSet, pickFields } from '../utils/sql.js'

const router = Router()
const MANAGER_ROLES = ['SuperAdmin', 'BranchManager'] as const

const FACILITY_FIELDS = ['name', 'name_ar', 'icon', 'description', 'description_ar'] as const

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM facilities ORDER BY name_ar ASC`)
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, requireAnyRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, FACILITY_FIELDS)
    const built = buildInsert(body, FACILITY_FIELDS)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `INSERT INTO facilities (${built.columns}) VALUES (${built.placeholders}) RETURNING *`,
      built.values
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, requireAnyRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, FACILITY_FIELDS)
    const built = buildUpdateSet(body, 1, FACILITY_FIELDS)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE facilities SET ${built.setClause} WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, requireAnyRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM facilities WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
