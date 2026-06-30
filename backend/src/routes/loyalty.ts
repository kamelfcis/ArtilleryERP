import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/:guestId', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT total_amount, created_at FROM reservations
       WHERE guest_id = $1 AND status <> 'cancelled'`,
      [req.params.guestId]
    )
    const totalSpent = rows.reduce((sum, r) => sum + Number(r.total_amount), 0)
    const totalPoints = Math.floor(totalSpent / 10)
    let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze'
    if (totalPoints >= 1000) tier = 'platinum'
    else if (totalPoints >= 500) tier = 'gold'
    else if (totalPoints >= 200) tier = 'silver'

    res.json({
      guest_id: req.params.guestId,
      total_points: totalPoints,
      used_points: 0,
      available_points: totalPoints,
      tier,
      last_updated: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/apply', requireAuth, async (req, res, next) => {
  try {
    const { reservationId, pointsToUse } = req.body ?? {}
    const discountAmount = pointsToUse
    const { rows } = await pool.query(
      `SELECT total_amount, discount_amount FROM reservations WHERE id = $1`,
      [reservationId]
    )
    if (!rows[0]) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    await pool.query(
      `UPDATE reservations SET discount_amount = $1 WHERE id = $2`,
      [(Number(rows[0].discount_amount) || 0) + discountAmount, reservationId]
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
