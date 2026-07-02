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
    const conditions = ['s.is_active = true']
    const params: unknown[] = []
    if (req.query.categoryId) {
      params.push(req.query.categoryId)
      conditions.push(`s.category_id = $${params.length}`)
    }
    if (req.query.isFood !== undefined) {
      params.push(req.query.isFood === 'true')
      conditions.push(`s.is_food = $${params.length}`)
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

// ============================================================
// SERVICE STOCK
// ============================================================
router.get('/stock', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    if (req.query.locationId && req.query.locationId !== 'all') {
      params.push(req.query.locationId)
      conditions.push(`ss.location_id = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT ss.*, row_to_json(s.*) AS service, row_to_json(l.*) AS location
       FROM service_stock ss
       LEFT JOIN services s ON s.id = ss.service_id
       LEFT JOIN locations l ON l.id = ss.location_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ss.last_updated DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/stock', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO service_stock (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/stock/:id', requireAuth, async (req, res, next) => {
  try {
    const built = buildUpdateSet(req.body ?? {})
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE service_stock SET ${built.setClause}, last_updated = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/stock/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM service_stock WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// SERVICE BUNDLES
// ============================================================
router.get('/bundles', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM service_bundles ORDER BY created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/bundles/active', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'bundle_id', bi.bundle_id,
            'service_id', bi.service_id,
            'quantity', bi.quantity,
            'service', (SELECT row_to_json(s.*) FROM services s WHERE s.id = bi.service_id)
          ))
           FROM service_bundle_items bi WHERE bi.bundle_id = b.id),
          '[]'::json
        ) AS items
       FROM service_bundles b
       WHERE b.is_active = true
       ORDER BY b.created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/bundles', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { items, ...bundleData } = req.body ?? {}
    await client.query('BEGIN')
    const keys = Object.keys(bundleData).filter((k) => bundleData[k] !== undefined)
    const { rows } = await client.query(
      `INSERT INTO service_bundles (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => bundleData[k])
    )
    const bundleId = rows[0].id
    if (Array.isArray(items)) {
      for (const item of items) {
        await client.query(
          `INSERT INTO service_bundle_items (bundle_id, service_id, quantity) VALUES ($1, $2, $3)`,
          [bundleId, item.service_id ?? item.serviceId, item.quantity ?? 1]
        )
      }
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

router.patch('/bundles/:id', requireAuth, async (req, res, next) => {
  try {
    const { items: _items, ...updates } = req.body ?? {}
    const built = buildUpdateSet(updates)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE service_bundles SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/bundles/:id', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM service_bundle_items WHERE bundle_id = $1`, [req.params.id])
    await client.query(`DELETE FROM service_bundles WHERE id = $1`, [req.params.id])
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

router.post('/bundles/:id/apply', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const reservationId = req.body?.reservationId
    if (!reservationId) {
      res.status(400).json({ error: 'معرف الحجز مطلوب' })
      return
    }
    await client.query('BEGIN')
    const { rows: bundleRows } = await client.query(
      `SELECT * FROM service_bundles WHERE id = $1`,
      [req.params.id]
    )
    const bundle = bundleRows[0]
    if (!bundle) {
      res.status(404).json({ error: 'الباقة غير موجودة' })
      await client.query('ROLLBACK')
      return
    }
    const { rows: items } = await client.query(
      `SELECT bi.service_id, bi.quantity, s.price
       FROM service_bundle_items bi
       INNER JOIN services s ON s.id = bi.service_id
       WHERE bi.bundle_id = $1`,
      [req.params.id]
    )
    let addedTotal = 0
    let bundleTotal = 0
    for (const item of items) {
      const qty = Number(item.quantity) || 1
      const unitPrice = Number(item.price) || 0
      const total = unitPrice * qty
      addedTotal += total
      bundleTotal += total
      await client.query(
        `INSERT INTO reservation_services
          (reservation_id, service_id, quantity, unit_price, total_amount, added_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [reservationId, item.service_id, qty, unitPrice, total, req.user!.id]
      )
    }
    const discountAmount =
      Number(bundle.discount_percentage) > 0
        ? (bundleTotal * Number(bundle.discount_percentage)) / 100
        : 0
    const { rows: resRows } = await client.query(
      `SELECT total_amount, discount_amount FROM reservations WHERE id = $1`,
      [reservationId]
    )
    if (resRows[0]) {
      await client.query(
        `UPDATE reservations SET total_amount = $1, discount_amount = $2 WHERE id = $3`,
        [
          Number(resRows[0].total_amount) + addedTotal,
          Number(resRows[0].discount_amount || 0) + discountAmount,
          reservationId,
        ]
      )
    }
    await client.query('COMMIT')
    res.json({ success: true, discountAmount })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

// ============================================================
// SERVICE COSTS
// ============================================================
router.get('/costs', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sc.*, row_to_json(s.*) AS service
       FROM service_costs sc
       LEFT JOIN services s ON s.id = sc.service_id
       ORDER BY sc.effective_from DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/costs', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO service_costs (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/costs/:id', requireAuth, async (req, res, next) => {
  try {
    const built = buildUpdateSet(req.body ?? {})
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE service_costs SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/costs/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM service_costs WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// SERVICE HISTORY
// ============================================================
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    if (req.query.action && req.query.action !== 'all') {
      params.push(req.query.action)
      conditions.push(`sh.action = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT sh.*,
        (SELECT row_to_json(rs2) FROM (
          SELECT rs.*,
            (SELECT row_to_json(s.*) FROM services s WHERE s.id = rs.service_id) AS service,
            (SELECT json_build_object('reservation_number', r.reservation_number)
             FROM reservations r WHERE r.id = rs.reservation_id) AS reservation
          FROM reservation_services rs WHERE rs.id = sh.reservation_service_id
        ) rs2) AS reservation_service
       FROM service_history sh
       WHERE ${conditions.join(' AND ')}
       ORDER BY sh.created_at DESC
       LIMIT 100`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// ============================================================
// SERVICE AVAILABILITY
// ============================================================
router.get('/availability', requireAuth, async (req, res, next) => {
  try {
    if (!req.query.serviceId) {
      res.json([])
      return
    }
    const { rows } = await pool.query(
      `SELECT * FROM service_availability WHERE service_id = $1 ORDER BY day_of_week ASC`,
      [req.query.serviceId]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/availability', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO service_availability (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/availability/:id', requireAuth, async (req, res, next) => {
  try {
    const built = buildUpdateSet(req.body ?? {})
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE service_availability SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

// ============================================================
// SERVICE USAGE (analytics + reports) — raw rows, client aggregates
// ============================================================
router.get('/usage', requireAuth, async (req, res, next) => {
  try {
    const conditions: string[] = []
    const params: unknown[] = []
    if (req.query.dateFrom) {
      params.push(req.query.dateFrom)
      conditions.push(`rs.created_at >= $${params.length}`)
    }
    if (req.query.dateTo) {
      params.push(req.query.dateTo)
      conditions.push(`rs.created_at <= $${params.length}`)
    }
    if (req.query.serviceId && req.query.serviceId !== 'all') {
      params.push(req.query.serviceId)
      conditions.push(`rs.service_id = $${params.length}`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await pool.query(
      `SELECT rs.*,
        (SELECT row_to_json(s2) FROM (
          SELECT s.*, row_to_json(c.*) AS category
          FROM services s LEFT JOIN service_categories c ON c.id = s.category_id
          WHERE s.id = rs.service_id
        ) s2) AS service,
        (SELECT json_build_object(
          'check_in_date', r.check_in_date,
          'check_out_date', r.check_out_date,
          'status', r.status
        ) FROM reservations r WHERE r.id = rs.reservation_id) AS reservation
       FROM reservation_services rs
       ${where}
       ORDER BY rs.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// ============================================================
// SERVICE TODAY STATS (dashboard widget)
// ============================================================
router.get('/today-stats', requireAuth, async (req, res, next) => {
  try {
    const locationIds =
      (req.query.locationIds
        ? String(req.query.locationIds).split(',').filter(Boolean)
        : req.query.locationId
          ? [String(req.query.locationId)]
          : []) as string[]

    const params: unknown[] = []
    let joinClause = ''
    let locationFilter = ''
    if (locationIds.length > 0) {
      params.push(locationIds)
      joinClause = `INNER JOIN reservations r ON r.id = rs.reservation_id
                    INNER JOIN units u ON u.id = r.unit_id`
      locationFilter = `AND u.location_id = ANY($${params.length}::uuid[])`
    }

    const { rows } = await pool.query(
      `SELECT
        COALESCE(SUM(rs.total_amount), 0) AS total_revenue,
        COALESCE(SUM(rs.total_amount) FILTER (WHERE s.is_food), 0) AS food_revenue,
        COALESCE(SUM(rs.total_amount) FILTER (WHERE NOT s.is_food), 0) AS service_revenue,
        COUNT(*) AS total_orders
       FROM reservation_services rs
       LEFT JOIN services s ON s.id = rs.service_id
       ${joinClause}
       WHERE rs.created_at >= date_trunc('day', now())
         AND rs.created_at < date_trunc('day', now()) + interval '1 day'
         ${locationFilter}`,
      params
    )
    const row = rows[0] ?? {}
    res.json({
      totalRevenue: Number(row.total_revenue) || 0,
      foodRevenue: Number(row.food_revenue) || 0,
      serviceRevenue: Number(row.service_revenue) || 0,
      totalOrders: Number(row.total_orders) || 0,
    })
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
