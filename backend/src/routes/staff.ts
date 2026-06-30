import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet } from '../utils/sql.js'

const router = Router()

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, row_to_json(l.*) AS location
       FROM staff s
       LEFT JOIN locations l ON l.id = s.location_id
       WHERE s.user_id = $1 AND s.is_active = true
       LIMIT 1`,
      [req.user!.id]
    )
    res.json(rows[0] ?? null)
  } catch (err) {
    next(err)
  }
})

router.get('/shifts/list', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    if (req.query.staffId) {
      params.push(req.query.staffId)
      conditions.push(`sh.staff_id = $${params.length}`)
    }
    if (req.query.locationId) {
      params.push(req.query.locationId)
      conditions.push(`sh.location_id = $${params.length}`)
    }
    if (req.query.startDate) {
      params.push(req.query.startDate)
      conditions.push(`sh.shift_date >= $${params.length}`)
    }
    if (req.query.endDate) {
      params.push(req.query.endDate)
      conditions.push(`sh.shift_date <= $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT sh.*,
        (SELECT row_to_json(s.*) FROM staff s WHERE s.id = sh.staff_id) AS staff,
        (SELECT row_to_json(l.*) FROM locations l WHERE l.id = sh.location_id) AS location
       FROM shifts sh WHERE ${conditions.join(' AND ')}
       ORDER BY sh.shift_date ASC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/shift-requests/list', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    if (req.query.staffId) {
      params.push(req.query.staffId)
      conditions.push(`sr.staff_id = $${params.length}`)
    }
    if (req.query.status) {
      params.push(req.query.status)
      conditions.push(`sr.status = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT sr.*,
        (SELECT row_to_json(s.*) FROM staff s WHERE s.id = sr.staff_id) AS staff
       FROM shift_requests sr WHERE ${conditions.join(' AND ')}
       ORDER BY sr.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    if (req.query.locationId) {
      params.push(req.query.locationId)
      conditions.push(`s.location_id = $${params.length}`)
    }
    if (req.query.isActive !== undefined) {
      params.push(req.query.isActive === 'true')
      conditions.push(`s.is_active = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT s.*, row_to_json(l.*) AS location
       FROM staff s
       LEFT JOIN locations l ON l.id = s.location_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.first_name ASC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, row_to_json(l.*) AS location FROM staff s
       LEFT JOIN locations l ON l.id = s.location_id WHERE s.id = $1`,
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

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO staff (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.post('/shifts', requireAuth, async (req, res, next) => {
  try {
    const body = { ...req.body, created_by: req.user!.id }
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO shifts (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.post('/shift-requests', requireAuth, async (req, res, next) => {
  try {
    const body = { ...req.body, requested_by: req.user!.id }
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO shift_requests (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
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
      `UPDATE staff SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
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

router.patch('/shifts/:id', requireAuth, async (req, res, next) => {
  try {
    const built = buildUpdateSet(req.body ?? {})
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE shifts SET ${built.setClause} WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/shift-requests/:id/review', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body ?? {}
    const { rows } = await pool.query(
      `UPDATE shift_requests SET status = $1, reviewed_by = $2, reviewed_at = now()
       WHERE id = $3 RETURNING *`,
      [status, req.user!.id, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM staff WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/shifts/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM shifts WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
