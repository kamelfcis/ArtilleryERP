import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAnyRole } from '../middleware/requireRole.js'
import { buildInsert, pickFields } from '../utils/sql.js'
import { writeAuditLog } from '../utils/auditWrite.js'

const router = Router()
const WRITE_ROLES = ['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff'] as const

const PAYMENT_FIELDS = [
  'reservation_id',
  'amount',
  'payment_method',
  'status',
  'transaction_reference',
  'notes',
  'notes_ar',
  'processed_by',
  'processed_at',
] as const

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

router.post('/', requireAuth, requireAnyRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const body = pickFields(
      {
        ...(req.body ?? {}),
        processed_by: req.user!.id,
        processed_at: new Date().toISOString(),
        status: 'completed',
      },
      PAYMENT_FIELDS
    )
    const built = buildInsert(body, PAYMENT_FIELDS)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const { rows } = await pool.query(
      `INSERT INTO payment_transactions (${built.columns}) VALUES (${built.placeholders}) RETURNING *`,
      built.values
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, requireAnyRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT reservation_id, status, amount FROM payment_transactions WHERE id = $1`,
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
    await writeAuditLog({
      userId: req.user!.id,
      action: 'DELETE',
      resourceType: 'payment',
      resourceId: req.params.id,
      oldValues: tx,
    })
    res.json({ transactionId: req.params.id, reservationId: tx.reservation_id })
  } catch (err) {
    next(err)
  }
})

export default router
