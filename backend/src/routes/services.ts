import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet } from '../utils/sql.js'

const router = Router()

router.get('/categories', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM service_categories WHERE is_active = true ORDER BY name_ar ASC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['is_active = true']
    const params: unknown[] = []
    if (req.query.categoryId) {
      params.push(req.query.categoryId)
      conditions.push(`category_id = $${params.length}`)
    }
    if (req.query.isFood !== undefined) {
      params.push(req.query.isFood === 'true')
      conditions.push(`is_food = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT s.*, row_to_json(c.*) AS category
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.name_ar ASC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/reservation/:reservationId', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT rs.*,
        (SELECT row_to_json(s2) FROM (
          SELECT s.*, row_to_json(c.*) AS category FROM services s
          LEFT JOIN service_categories c ON c.id = s.category_id
          WHERE s.id = rs.service_id
        ) s2) AS service
       FROM reservation_services rs
       WHERE rs.reservation_id = $1
       ORDER BY rs.created_at DESC`,
      [req.params.reservationId]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/reservation', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { reservationId, serviceId, quantity, notes } = req.body ?? {}
    await client.query('BEGIN')
    const { rows: svcRows } = await client.query(
      `SELECT price FROM services WHERE id = $1`,
      [serviceId]
    )
    if (!svcRows[0]) {
      res.status(404).json({ error: 'الخدمة غير موجودة' })
      await client.query('ROLLBACK')
      return
    }
    const unitPrice = Number(svcRows[0].price)
    const totalAmount = unitPrice * quantity
    const { rows } = await client.query(
      `INSERT INTO reservation_services
        (reservation_id, service_id, quantity, unit_price, total_amount, notes_ar, added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [reservationId, serviceId, quantity, unitPrice, totalAmount, notes ?? null, req.user!.id]
    )
    const { rows: resRows } = await client.query(
      `SELECT total_amount FROM reservations WHERE id = $1`,
      [reservationId]
    )
    if (resRows[0]) {
      await client.query(`UPDATE reservations SET total_amount = $1 WHERE id = $2`, [
        Number(resRows[0].total_amount) + totalAmount,
        reservationId,
      ])
    }
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

router.delete('/reservation/:serviceRowId', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const reservationId = req.query.reservationId as string
    await client.query('BEGIN')
    const { rows: svcRows } = await client.query(
      `SELECT total_amount FROM reservation_services WHERE id = $1`,
      [req.params.serviceRowId]
    )
    await client.query(`DELETE FROM reservation_services WHERE id = $1`, [
      req.params.serviceRowId,
    ])
    if (svcRows[0] && reservationId) {
      const { rows: resRows } = await client.query(
        `SELECT total_amount FROM reservations WHERE id = $1`,
        [reservationId]
      )
      if (resRows[0]) {
        await client.query(`UPDATE reservations SET total_amount = $1 WHERE id = $2`, [
          Math.max(0, Number(resRows[0].total_amount) - Number(svcRows[0].total_amount)),
          reservationId,
        ])
      }
    }
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
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
      `UPDATE services SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`UPDATE services SET is_active = false, updated_at = now() WHERE id = $1`, [
      req.params.id,
    ])
    res.json({ id: req.params.id })
  } catch (err) {
    next(err)
  }
})

export default router
