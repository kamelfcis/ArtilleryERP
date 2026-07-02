import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet } from '../utils/sql.js'

const router = Router()
const POSTGREST_PAGE_SIZE = 1000

function parseLocationIds(raw: unknown): string[] | null {
  if (raw == null || raw === '') return null
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  const str = String(raw)
  if (str.includes(',')) return str.split(',').map((s) => s.trim()).filter(Boolean)
  return [str]
}

async function resolveUnitIds(locationFilterIds: string[] | null): Promise<string[] | undefined> {
  if (!locationFilterIds?.length) return undefined
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM units WHERE location_id = ANY($1::uuid[]) AND is_active = true`,
    [locationFilterIds]
  )
  return rows.map((r) => r.id)
}

const RESERVATION_DETAIL_SELECT = `
  r.*,
  row_to_json(u.*) AS unit,
  row_to_json(g.*) AS guest
`

async function fetchReservationDetail(id: string) {
  const { rows } = await pool.query(
    `SELECT
      r.*,
      (SELECT row_to_json(u2) FROM (
        SELECT u.*, row_to_json(l.*) AS location
        FROM units u
        LEFT JOIN locations l ON l.id = u.location_id
        WHERE u.id = r.unit_id
      ) u2) AS unit,
      (SELECT row_to_json(g.*) FROM guests g WHERE g.id = r.guest_id) AS guest,
      COALESCE(
        (SELECT json_agg(a.*) FROM reservation_attachments a WHERE a.reservation_id = r.id),
        '[]'::json
      ) AS attachments
     FROM reservations r
     WHERE r.id = $1`,
    [id]
  )
  return rows[0] ?? null
}

async function syncUnitStatusAfterChange(
  unitId: string | null,
  status: string,
  checkOutDate: string
) {
  if (!unitId) return
  let unitStatus = 'available'
  if (status === 'cancelled' || status === 'no_show' || status === 'checked_out') {
    unitStatus = 'available'
  } else if (['pending', 'confirmed', 'checked_in'].includes(status)) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const out = new Date(checkOutDate)
    out.setHours(0, 0, 0, 0)
    unitStatus = out < today ? 'available' : 'occupied'
  }
  await pool.query(`UPDATE units SET status = $1, updated_at = now() WHERE id = $2`, [
    unitStatus,
    unitId,
  ])
}

router.get('/pending', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const pageSize = Math.max(1, parseInt(String(req.query.pageSize ?? '15'), 10) || 15)
    const statusFilter = (req.query.statusFilter as string) || 'all'
    const locationFilter = (req.query.locationFilter as string) || 'all'
    const rocketLocationIds = parseLocationIds(req.query.rocketLocationIds)
    const restrictedBranchManager = req.query.restrictedBranchManager === 'true'
    const search = String(req.query.search ?? '')
      .replace(/\\/g, '')
      .replace(/%/g, '')
      .replace(/_/g, '')
      .replace(/[,()]/g, '')
      .trim()

    const checkInFrom = req.query.checkInFrom as string | undefined
    const checkInTo = req.query.checkInTo as string | undefined
    const checkOutFrom = req.query.checkOutFrom as string | undefined
    const checkOutTo = req.query.checkOutTo as string | undefined
    const createdFrom = req.query.createdFrom as string | undefined
    const createdTo = req.query.createdTo as string | undefined

    let allowedUnitIds: string[] | null = null

    if (rocketLocationIds?.length) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM units WHERE location_id = ANY($1::uuid[]) AND is_active = true`,
        [rocketLocationIds]
      )
      allowedUnitIds = rows.map((r) => r.id)
      if (allowedUnitIds.length === 0) {
        res.json({ rows: [], total: 0 })
        return
      }
    }

    if (locationFilter !== 'all') {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM units WHERE location_id = $1 AND is_active = true`,
        [locationFilter]
      )
      const locIds = rows.map((r) => r.id)
      if (allowedUnitIds) {
        allowedUnitIds = allowedUnitIds.filter((id) => locIds.includes(id))
      } else {
        allowedUnitIds = locIds
      }
      if (allowedUnitIds.length === 0) {
        res.json({ rows: [], total: 0 })
        return
      }
    }

    const conditions: string[] = ['1=1']
    const params: unknown[] = []

    if (restrictedBranchManager) {
      params.push(req.user!.id)
      conditions.push(`r.created_by = $${params.length}`)
      if (statusFilter !== 'all') {
        params.push(statusFilter)
        conditions.push(`r.status = $${params.length}`)
      }
    } else if (statusFilter === 'all') {
      conditions.push(`r.status = 'pending'`)
    } else {
      params.push(statusFilter)
      conditions.push(`r.status = $${params.length}`)
    }

    if (checkInFrom) {
      params.push(checkInFrom)
      conditions.push(`r.check_in_date >= $${params.length}`)
    }
    if (checkInTo) {
      params.push(checkInTo)
      conditions.push(`r.check_in_date <= $${params.length}`)
    }
    if (checkOutFrom) {
      params.push(checkOutFrom)
      conditions.push(`r.check_out_date >= $${params.length}`)
    }
    if (checkOutTo) {
      params.push(checkOutTo)
      conditions.push(`r.check_out_date <= $${params.length}`)
    }
    if (createdFrom) {
      params.push(`${createdFrom}T00:00:00`)
      conditions.push(`r.created_at >= $${params.length}`)
    }
    if (createdTo) {
      params.push(`${createdTo}T23:59:59.999`)
      conditions.push(`r.created_at <= $${params.length}`)
    }
    if (allowedUnitIds) {
      params.push(allowedUnitIds)
      conditions.push(`r.unit_id = ANY($${params.length}::uuid[])`)
    }

    if (search.length > 0) {
      const pat = `%${search}%`
      const { rows: guestRows } = await pool.query<{ id: string }>(
        `SELECT id FROM guests WHERE
          first_name ILIKE $1 OR last_name ILIKE $1 OR first_name_ar ILIKE $1 OR
          last_name_ar ILIKE $1 OR phone ILIKE $1
         LIMIT 200`,
        [pat]
      )
      const gids = guestRows.map((g) => g.id)
      if (gids.length > 0) {
        params.push(pat, gids)
        conditions.push(
          `(r.reservation_number ILIKE $${params.length - 1} OR r.guest_id = ANY($${params.length}::uuid[]))`
        )
      } else {
        params.push(pat)
        conditions.push(`r.reservation_number ILIKE $${params.length}`)
      }
    }

    const where = conditions.join(' AND ')
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM reservations r WHERE ${where}`,
      params
    )
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10)
    const offset = (page - 1) * pageSize

    const { rows } = await pool.query(
      `SELECT
        r.*,
        (SELECT row_to_json(g.*) FROM guests g WHERE g.id = r.guest_id) AS guest,
        (SELECT row_to_json(u2) FROM (
          SELECT u.id, u.unit_number, u.name, u.location_id,
            row_to_json(l.*) AS location
          FROM units u
          LEFT JOIN locations l ON l.id = u.location_id
          WHERE u.id = r.unit_id
        ) u2) AS unit
       FROM reservations r
       WHERE ${where}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    )

    res.json({ rows, total })
  } catch (err) {
    next(err)
  }
})

router.get('/page', requireAuth, async (req, res, next) => {
  try {
    const locationIds = parseLocationIds(req.query.locationIds ?? req.query.locationId)
    const status = (req.query.status as string | undefined) || null
    const dateFrom = (req.query.dateFrom as string | undefined) || null
    const dateTo = (req.query.dateTo as string | undefined) || null
    const search = (req.query.search as string | undefined) || null
    const unitType = (req.query.unitType as string | undefined) || null
    const source = (req.query.source as string | undefined) || null
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const pageSize = Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50)

    const { rows } = await pool.query<{ get_reservations_page: unknown }>(
      `SELECT get_reservations_page($1::uuid[], $2::text, $3::date, $4::date, $5::text, $6::text, $7::text, $8::int, $9::int) AS get_reservations_page`,
      [
        locationIds?.length ? locationIds : null,
        status,
        dateFrom,
        dateTo,
        search,
        unitType,
        source,
        page,
        pageSize,
      ]
    )

    const payload = (rows[0]?.get_reservations_page ?? {}) as {
      rows?: unknown[]
      total_count?: number
      status_counts?: { confirmed?: number; pending?: number }
    }

    res.json({
      rows: payload.rows ?? [],
      totalCount: payload.total_count ?? 0,
      statusCounts: {
        confirmed: payload.status_counts?.confirmed ?? 0,
        pending: payload.status_counts?.pending ?? 0,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.get('/list', requireAuth, async (req, res, next) => {
  try {
    const locationIds = parseLocationIds(req.query.locationIds ?? req.query.locationId)
    const fetchAll = req.query.fetchAll === 'true'
    const unitIds = await resolveUnitIds(locationIds)
    if (unitIds !== undefined && unitIds.length === 0) {
      res.json([])
      return
    }

    const conditions: string[] = ['1=1']
    const params: unknown[] = []

    if (unitIds !== undefined) {
      params.push(unitIds)
      conditions.push(`r.unit_id = ANY($${params.length}::uuid[])`)
    }
    if (req.query.status) {
      params.push(req.query.status)
      conditions.push(`r.status = $${params.length}`)
    }
    if (req.query.dateFrom) {
      params.push(req.query.dateFrom)
      conditions.push(`r.check_in_date >= $${params.length}`)
    }
    if (req.query.dateTo) {
      params.push(req.query.dateTo)
      conditions.push(`r.check_out_date <= $${params.length}`)
    }
    if (req.query.overlapEnd) {
      params.push(req.query.overlapEnd)
      conditions.push(`r.check_in_date <= $${params.length}`)
    }
    if (req.query.overlapStart) {
      params.push(req.query.overlapStart)
      conditions.push(`r.check_out_date >= $${params.length}`)
    }
    if (req.query.source && req.query.source !== 'all') {
      params.push(req.query.source)
      conditions.push(`r.source = $${params.length}`)
    }

    const where = conditions.join(' AND ')
    const all: unknown[] = []
    let offset = 0

    do {
      const limit = fetchAll ? POSTGREST_PAGE_SIZE : POSTGREST_PAGE_SIZE
      const { rows } = await pool.query(
        `SELECT r.*,
          (SELECT row_to_json(u2) FROM (
            SELECT u.*, row_to_json(l.*) AS location FROM units u
            LEFT JOIN locations l ON l.id = u.location_id WHERE u.id = r.unit_id
          ) u2) AS unit,
          (SELECT row_to_json(g.*) FROM guests g WHERE g.id = r.guest_id) AS guest
         FROM reservations r WHERE ${where}
         ORDER BY r.check_in_date ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      )
      all.push(...rows)
      if (!fetchAll || rows.length < POSTGREST_PAGE_SIZE) break
      offset += POSTGREST_PAGE_SIZE
    } while (fetchAll)

    res.json(all)
  } catch (err) {
    next(err)
  }
})

router.get('/conflicts', requireAuth, async (req, res, next) => {
  try {
    const unitId = req.query.unitId as string | undefined
    const checkIn = req.query.checkIn as string | undefined
    const checkOut = req.query.checkOut as string | undefined
    const excludeId = req.query.excludeId as string | undefined
    if (!unitId || !checkIn || !checkOut) {
      res.json([])
      return
    }
    const params: unknown[] = [unitId, checkOut, checkIn]
    let extra = ''
    if (excludeId) {
      params.push(excludeId)
      extra = `AND id <> $${params.length}`
    }
    const { rows } = await pool.query(
      `SELECT id FROM reservations
       WHERE unit_id = $1
         AND status::text NOT IN ('cancelled','no_show')
         AND check_in_date < $2 AND check_out_date > $3
         ${extra}`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await fetchReservationDetail(req.params.id)
    if (!row) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    res.json(row)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const r = req.body ?? {}
    const cols = Object.keys(r).filter((k) => r[k] !== undefined)
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `INSERT INTO reservations (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      cols.map((c) => r[c])
    )
    const created = rows[0]
    if (created?.unit_id && created.status !== 'cancelled' && created.status !== 'no_show') {
      await pool.query(`UPDATE units SET status = 'occupied', updated_at = now() WHERE id = $1`, [
        created.unit_id,
      ])
    }
    const detail = await fetchReservationDetail(created.id)
    res.status(201).json(detail ?? created)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: currentRows } = await pool.query(
      `SELECT unit_id, status FROM reservations WHERE id = $1`,
      [req.params.id]
    )
    const current = currentRows[0]
    if (!current) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }

    const { id: _id, ...updates } = req.body ?? {}
    const built = buildUpdateSet(updates)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات للتحديث' })
      return
    }

    const { rows } = await pool.query(
      `UPDATE reservations SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    const data = rows[0]

    const unitChanged = updates.unit_id && current.unit_id !== updates.unit_id
    if (unitChanged && current.unit_id) {
      await pool.query(`UPDATE units SET status = 'available', updated_at = now() WHERE id = $1`, [
        current.unit_id,
      ])
    }

    const newUnitId = updates.unit_id || current.unit_id
    await syncUnitStatusAfterChange(
      newUnitId,
      updates.status || data.status,
      data.check_out_date
    )

    const detail = await fetchReservationDetail(req.params.id)
    res.json(detail ?? data)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM reservations WHERE id = $1`, [
      req.params.id,
    ])
    if (!rowCount) {
      res.status(403).json({ error: 'لا تملك صلاحية حذف هذا الحجز' })
      return
    }
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
