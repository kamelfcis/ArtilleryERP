import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/window', requireAuth, async (req, res, next) => {
  try {
    const locationId = (req.query.locationId as string | undefined) || null
    const start = (req.query.start as string | undefined) || null
    const end = (req.query.end as string | undefined) || null
    const status = (req.query.status as string | undefined) || null

    const { rows } = await pool.query(
      `SELECT * FROM get_calendar_window($1::uuid, $2::date, $3::date, $4::text)`,
      [locationId, start, end, status]
    )

    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/changes', requireAuth, async (req, res, next) => {
  try {
    const since = (req.query.since as string | undefined) || new Date(0).toISOString()
    const { rows } = await pool.query(
      `SELECT * FROM reservations_changed_since($1::timestamptz)`,
      [since]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

export default router
