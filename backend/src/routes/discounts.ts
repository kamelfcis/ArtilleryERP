import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet } from '../utils/sql.js'

const router = Router()

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM discount_codes ORDER BY created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/active', requireAuth, async (_req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { rows } = await pool.query(
      `SELECT * FROM discount_codes
       WHERE is_active = true AND valid_from <= $1 AND valid_to >= $1
       ORDER BY created_at DESC`,
      [today]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/validate', requireAuth, async (req, res, next) => {
  try {
    const code = String(req.body?.code ?? '').toUpperCase()
    const today = new Date().toISOString().split('T')[0]
    const { rows } = await pool.query(
      `SELECT * FROM discount_codes
       WHERE code = $1 AND is_active = true AND valid_from <= $2 AND valid_to >= $2
       LIMIT 1`,
      [code, today]
    )
    const data = rows[0]
    if (!data) {
      res.status(400).json({ error: 'كود الخصم غير صحيح أو منتهي الصلاحية' })
      return
    }
    if (data.max_uses && data.used_count >= data.max_uses) {
      res.status(400).json({ error: 'تم استنفاد عدد مرات استخدام كود الخصم' })
      return
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = { ...req.body, code: req.body?.code?.toUpperCase() }
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const { rows } = await pool.query(
      `INSERT INTO discount_codes (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => body[k])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.post('/apply', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { code, reservationId, totalAmount } = req.body ?? {}
    const today = new Date().toISOString().split('T')[0]
    await client.query('BEGIN')

    const { rows: discountRows } = await client.query(
      `SELECT * FROM discount_codes
       WHERE code = $1 AND is_active = true AND valid_from <= $2 AND valid_to >= $2
       LIMIT 1`,
      [String(code).toUpperCase(), today]
    )
    const discount = discountRows[0]
    if (!discount) {
      res.status(400).json({ error: 'كود الخصم غير صحيح أو منتهي الصلاحية' })
      await client.query('ROLLBACK')
      return
    }
    if (discount.max_uses && discount.used_count >= discount.max_uses) {
      res.status(400).json({ error: 'تم استنفاد عدد مرات استخدام كود الخصم' })
      await client.query('ROLLBACK')
      return
    }

    let discountAmount =
      discount.discount_type === 'percentage'
        ? (totalAmount * discount.discount_value) / 100
        : discount.discount_value

    if (discount.min_amount && totalAmount < discount.min_amount) {
      res.status(400).json({ error: `الحد الأدنى للطلب: ${discount.min_amount} ر.س` })
      await client.query('ROLLBACK')
      return
    }

    const { rows: resRows } = await client.query(
      `SELECT discount_amount FROM reservations WHERE id = $1`,
      [reservationId]
    )
    const newDiscountAmount = (Number(resRows[0]?.discount_amount) || 0) + discountAmount

    await client.query(`UPDATE reservations SET discount_amount = $1 WHERE id = $2`, [
      newDiscountAmount,
      reservationId,
    ])
    await client.query(`UPDATE discount_codes SET used_count = used_count + 1 WHERE id = $1`, [
      discount.id,
    ])
    await client.query(
      `INSERT INTO discount_usage (discount_code_id, reservation_id, discount_amount, used_by)
       VALUES ($1, $2, $3, $4)`,
      [discount.id, reservationId, discountAmount, req.user!.id]
    )
    await client.query('COMMIT')
    res.json({ discountAmount, discount })
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
      `UPDATE discount_codes SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
