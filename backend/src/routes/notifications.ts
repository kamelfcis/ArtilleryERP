import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function applyNotificationScope(
  conditions: string[],
  params: unknown[],
  ctx: {
    restrictedBranchManager: boolean
    userId: string
    rocketUserId: string | null
  }
) {
  if (ctx.restrictedBranchManager) {
    params.push(ctx.userId)
    conditions.push(`notify_user_id = $${params.length}`)
  } else if (ctx.rocketUserId) {
    params.push(ctx.rocketUserId)
    conditions.push(`created_by = $${params.length}`)
    conditions.push(`notify_user_id IS NULL`)
  }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const restrictedBranchManager = req.query.restrictedBranchManager === 'true'
    const rocketUserId = (req.query.rocketUserId as string) || null
    if (!restrictedBranchManager && !rocketUserId) {
      res.json([])
      return
    }

    const conditions = ['1=1']
    const params: unknown[] = []
    applyNotificationScope(conditions, params, {
      restrictedBranchManager,
      userId: req.user!.id,
      rocketUserId,
    })

    const { rows } = await pool.query(
      `SELECT bn.*,
        (SELECT row_to_json(r2) FROM (
          SELECT r.id, r.reservation_number, r.status, r.check_in_date, r.check_out_date,
            r.total_amount, r.adults, r.children, r.source,
            (SELECT row_to_json(g.*) FROM guests g WHERE g.id = r.guest_id) AS guest,
            (SELECT row_to_json(u2) FROM (
              SELECT u.*, (SELECT row_to_json(l.*) FROM locations l WHERE l.id = u.location_id) AS location
              FROM units u WHERE u.id = r.unit_id
            ) u2) AS unit
          FROM reservations r WHERE r.id = bn.reservation_id
        ) r2) AS reservation
       FROM booking_notifications bn
       WHERE ${conditions.join(' AND ')}
       ORDER BY bn.created_at DESC
       LIMIT 50`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/legacy', requireAuth, async (req, res, next) => {
  try {
    const restrictedBranchManager = req.query.restrictedBranchManager === 'true'
    const rocketUserId = (req.query.rocketUserId as string) || null

    const applyRocket = !restrictedBranchManager && !!rocketUserId
    const rocketFilter = applyRocket ? `AND r.created_by = $1` : ''
    const queryParams: unknown[] = applyRocket ? [rocketUserId] : []

    const reservationSelect = `r.id, r.reservation_number, r.check_in_date, r.check_out_date, r.created_by,
      (SELECT row_to_json(g.*) FROM guests g WHERE g.id = r.guest_id) AS guest,
      (SELECT row_to_json(u.*) FROM units u WHERE u.id = r.unit_id) AS unit`

    const checkInsQuery = `SELECT ${reservationSelect}
       FROM reservations r
       WHERE r.status::text = 'confirmed'
         AND r.check_in_date >= CURRENT_DATE
         AND r.check_in_date <= CURRENT_DATE + INTERVAL '1 day'
         ${rocketFilter}
       LIMIT 10`
    const checkOutsQuery = `SELECT ${reservationSelect}
       FROM reservations r
       WHERE r.status::text = 'checked_in'
         AND r.check_out_date >= CURRENT_DATE
         AND r.check_out_date <= CURRENT_DATE + INTERVAL '1 day'
         ${rocketFilter}
       LIMIT 10`

    const [checkIns, checkOuts] = await Promise.all([
      pool.query(checkInsQuery, queryParams),
      pool.query(checkOutsQuery, queryParams),
    ])

    const list: Array<Record<string, unknown>> = []
    const guestName = (g: any) =>
      g ? `${g.first_name_ar || g.first_name} ${g.last_name_ar || g.last_name}` : ''

    for (const r of checkIns.rows) {
      list.push({
        id: `checkin-${r.id}`,
        type: 'checkin',
        title: 'تسجيل دخول قادم',
        message: `حجز ${r.reservation_number} - ${guestName(r.guest)}`,
        link: `/reservations/${r.id}`,
        read: false,
        created_at: r.check_in_date,
      })
    }
    for (const r of checkOuts.rows) {
      list.push({
        id: `checkout-${r.id}`,
        type: 'checkout',
        title: 'تسجيل خروج قادم',
        message: `حجز ${r.reservation_number} - ${guestName(r.guest)}`,
        link: `/reservations/${r.id}`,
        read: false,
        created_at: r.check_out_date,
      })
    }
    list.sort(
      (a, b) =>
        new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
    )
    res.json(list)
  } catch (err) {
    next(err)
  }
})

router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const restrictedBranchManager = req.query.restrictedBranchManager === 'true'
    const rocketUserId = (req.query.rocketUserId as string) || null
    if (!restrictedBranchManager && !rocketUserId) {
      res.json({ count: 0 })
      return
    }

    const conditions = ['is_read = false']
    const params: unknown[] = []
    applyNotificationScope(conditions, params, {
      restrictedBranchManager,
      userId: req.user!.id,
      rocketUserId,
    })

    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM booking_notifications WHERE ${conditions.join(' AND ')}`,
      params
    )
    res.json({ count: parseInt(rows[0]?.count ?? '0', 10) })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const { rows } = await pool.query(
      `INSERT INTO booking_notifications (reservation_id, created_by, message, notify_user_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.reservation_id, body.created_by, body.message, body.notify_user_id ?? null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    const restrictedBranchManager = req.body?.restrictedBranchManager === true
    const rocketUserId = req.body?.rocketUserId ?? null
    const conditions = ['is_read = false']
    const params: unknown[] = []
    applyNotificationScope(conditions, params, {
      restrictedBranchManager,
      userId: req.user!.id,
      rocketUserId,
    })
    await pool.query(
      `UPDATE booking_notifications SET is_read = true WHERE ${conditions.join(' AND ')}`,
      params
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`UPDATE booking_notifications SET is_read = true WHERE id = $1`, [
      req.params.id,
    ])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
