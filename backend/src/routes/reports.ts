import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ============================================================
// ADVANCED REPORTS — reservations with unit(+location) and guest.
// Client computes the aggregate statistics.
// ============================================================
router.get('/reservations', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    if (req.query.dateFrom) {
      params.push(req.query.dateFrom)
      conditions.push(`r.check_in_date >= $${params.length}`)
    }
    if (req.query.dateTo) {
      params.push(req.query.dateTo)
      conditions.push(`r.check_out_date <= $${params.length}`)
    }
    if (req.query.locationId && req.query.locationId !== 'all') {
      params.push(req.query.locationId)
      conditions.push(
        `r.unit_id IN (SELECT id FROM units WHERE location_id = $${params.length})`
      )
    }
    if (req.query.status && req.query.status !== 'all') {
      params.push(req.query.status)
      conditions.push(`r.status::text = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT r.*,
        (SELECT row_to_json(u2) FROM (
          SELECT u.*, row_to_json(l.*) AS location
          FROM units u LEFT JOIN locations l ON l.id = u.location_id
          WHERE u.id = r.unit_id
        ) u2) AS unit,
        (SELECT row_to_json(g.*) FROM guests g WHERE g.id = r.guest_id) AS guest
       FROM reservations r
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.check_in_date DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// ============================================================
// FINANCIAL RECONCILIATION — reservations in range (excl cancelled).
// Client computes the summary.
// ============================================================
router.get('/reconciliation', requireAuth, async (req, res, next) => {
  try {
    const conditions = [`r.status::text <> 'cancelled'`]
    const params: unknown[] = []
    if (req.query.dateFrom) {
      params.push(req.query.dateFrom)
      conditions.push(`r.check_in_date >= $${params.length}`)
    }
    if (req.query.dateTo) {
      params.push(req.query.dateTo)
      conditions.push(`r.check_out_date <= $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT r.* FROM reservations r
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.check_in_date DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

export default router
