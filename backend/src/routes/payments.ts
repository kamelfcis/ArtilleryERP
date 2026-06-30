import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const reservationId = req.query.reservationId as string | undefined
    if (!reservationId) {
      res.json([])
      return
    }
    const { rows } = await pool.query(
      `SELECT * FROM payment_transactions WHERE reservation_id = $1 ORDER BY created_at DESC`,
      [reservationId]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = {
      ...req.body,
      processed_by: req.user!.id,
      processed_at: new Date().toISOString(),
      status: 'completed',
    }
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO payment_transactions (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT reservation_id, status FROM payment_transactions WHERE id = $1`,
      [req.params.id]
    )
    const tx = rows[0]
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found' })
      return
    }
    if (tx.status !== 'completed') {
      res.status(400).json({ error: 'يمكن حذف الدفعات المكتملة فقط' })
      return
    }
    await pool.query(`DELETE FROM payment_transactions WHERE id = $1`, [req.params.id])
    res.json({ transactionId: req.params.id, reservationId: tx.reservation_id })
  } catch (err) {
    next(err)
  }
})

export default router
