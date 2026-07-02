import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet, pickFields } from '../utils/sql.js'

const router = Router()

const CALENDAR_FIELDS =
  'id, unit_number, name, name_ar, type, location_id, is_active, status, beds, orderno'

const UNIT_FIELDS = [
  'unit_number',
  'name',
  'name_ar',
  'type',
  'location_id',
  'status',
  'beds',
  'orderno',
  'is_active',
  'description',
  'description_ar',
  'floor',
  'max_occupancy',
] as const

function parseIds(raw: unknown): string[] | undefined {
  if (raw == null || raw === '') return undefined
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  const str = String(raw)
  return str.includes(',') ? str.split(',').map((s) => s.trim()).filter(Boolean) : [str]
}

async function attachUnitRelations(units: Record<string, unknown>[]) {
  if (units.length === 0) return units
  const ids = units.map((u) => u.id as string)
  const locationIds = [...new Set(units.map((u) => u.location_id as string).filter(Boolean))]

  const [locations, images, facilityLinks] = await Promise.all([
    locationIds.length
      ? pool.query(`SELECT * FROM locations WHERE id = ANY($1::uuid[])`, [locationIds])
      : Promise.resolve({ rows: [] }),
    pool.query(`SELECT * FROM unit_images WHERE unit_id = ANY($1::uuid[])`, [ids]),
    pool.query(
      `SELECT uf.*, row_to_json(f.*) AS facility
       FROM unit_facilities uf
       INNER JOIN facilities f ON f.id = uf.facility_id
       WHERE uf.unit_id = ANY($1::uuid[])`,
      [ids]
    ),
  ])

  const locMap = new Map(locations.rows.map((l) => [l.id, l]))
  const imagesByUnit = new Map<string, unknown[]>()
  for (const img of images.rows) {
    const list = imagesByUnit.get(img.unit_id) ?? []
    list.push(img)
    imagesByUnit.set(img.unit_id, list)
  }
  const facilitiesByUnit = new Map<string, unknown[]>()
  for (const row of facilityLinks.rows) {
    const list = facilitiesByUnit.get(row.unit_id) ?? []
    list.push({ facility: row.facility, ...row })
    facilitiesByUnit.set(row.unit_id, list)
  }

  return units.map((u) => ({
    ...u,
    location: locMap.get(u.location_id as string) ?? null,
    images: imagesByUnit.get(u.id as string) ?? [],
    facilities: facilitiesByUnit.get(u.id as string) ?? [],
  }))
}

router.get('/types-map', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT type, location_id FROM units WHERE is_active = true`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const locationId = req.query.locationId as string | undefined
    const locationIds = parseIds(req.query.locationIds)
    const type = req.query.type as string | undefined
    const status = req.query.status as string | undefined
    const onlyCalendarFields = req.query.onlyCalendarFields === 'true'

    const selectClause = onlyCalendarFields ? CALENDAR_FIELDS : '*'
    const conditions = ['is_active = true']
    const params: unknown[] = []

    if (locationIds?.length) {
      params.push(locationIds)
      conditions.push(`location_id = ANY($${params.length}::uuid[])`)
    } else if (locationId) {
      params.push(locationId)
      conditions.push(`location_id = $${params.length}`)
    }
    if (type) {
      params.push(type)
      conditions.push(`type = $${params.length}`)
    }
    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }

    const { rows } = await pool.query(
      `SELECT ${selectClause} FROM units WHERE ${conditions.join(' AND ')}
       ORDER BY orderno ASC NULLS LAST, unit_number ASC`,
      params
    )

    if (onlyCalendarFields) {
      res.json(rows)
      return
    }

    res.json(await attachUnitRelations(rows))
  } catch (err) {
    next(err)
  }
})

router.get('/available', requireAuth, async (req, res, next) => {
  try {
    const checkIn = req.query.checkIn as string | undefined
    const checkOut = req.query.checkOut as string | undefined
    if (!checkIn || !checkOut) {
      res.json([])
      return
    }
    const conditions = [`u.is_active = true`, `u.status = 'available'`]
    const params: unknown[] = [checkIn, checkOut]
    if (req.query.locationId && req.query.locationId !== 'all') {
      params.push(req.query.locationId)
      conditions.push(`u.location_id = $${params.length}`)
    }
    if (req.query.unitType && req.query.unitType !== 'all') {
      params.push(req.query.unitType)
      conditions.push(`u.type = $${params.length}`)
    }
    const { rows } = await pool.query(
      `SELECT u.* FROM units u
       WHERE ${conditions.join(' AND ')}
         AND NOT EXISTS (
           SELECT 1 FROM reservations r
           WHERE r.unit_id = u.id
             AND r.status::text NOT IN ('cancelled','no_show')
             AND r.check_in_date <= $2 AND r.check_out_date >= $1
         )
       ORDER BY u.orderno ASC NULLS LAST, u.unit_number ASC`,
      params
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM units WHERE id = $1`, [req.params.id])
    if (!rows[0]) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    const [enriched] = await attachUnitRelations([rows[0]])
    const { rows: pricing } = await pool.query(
      `SELECT * FROM pricing WHERE unit_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    )
    res.json({ ...enriched, pricing })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, UNIT_FIELDS)
    const keys = Object.keys(body)
    if (keys.length === 0) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    const cols = keys.join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `INSERT INTO units (${cols}) VALUES (${placeholders}) RETURNING *`,
      keys.map((k) => body[k as keyof typeof body])
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const body = pickFields(req.body ?? {}, UNIT_FIELDS)
    const built = buildUpdateSet(body as Record<string, unknown>)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات للتحديث' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE units SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
      [...built.values, req.params.id]
    )
    if (!rows[0]) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/images', requireAuth, async (req, res, next) => {
  try {
    const { image_url, image_path, is_primary, display_order } = req.body ?? {}
    if (!image_url || !image_path) {
      res.status(400).json({ error: 'بيانات الصورة غير كاملة' })
      return
    }
    const { rows } = await pool.query(
      `INSERT INTO unit_images (unit_id, image_url, image_path, is_primary, display_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, image_url, image_path, is_primary ?? false, display_order ?? 0]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.post('/:id/facilities', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const facilityIds: string[] = Array.isArray(req.body?.facilityIds)
      ? req.body.facilityIds
      : []
    await client.query('BEGIN')
    if (req.body?.replace) {
      await client.query(`DELETE FROM unit_facilities WHERE unit_id = $1`, [req.params.id])
    }
    for (const facilityId of facilityIds) {
      await client.query(
        `INSERT INTO unit_facilities (unit_id, facility_id) VALUES ($1, $2)
         ON CONFLICT (unit_id, facility_id) DO NOTHING`,
        [req.params.id, facilityId]
      )
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

router.patch('/:id/primary-image', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const imageId = req.body?.imageId
    if (!imageId) {
      res.status(400).json({ error: 'معرف الصورة مطلوب' })
      return
    }
    await client.query('BEGIN')
    await client.query(`UPDATE unit_images SET is_primary = false WHERE unit_id = $1`, [
      req.params.id,
    ])
    await client.query(`UPDATE unit_images SET is_primary = true WHERE id = $1`, [imageId])
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

router.delete('/:id/images/:imageId', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM unit_images WHERE id = $1 AND unit_id = $2 RETURNING image_path`,
      [req.params.imageId, req.params.id]
    )
    res.json({ success: true, image_path: rows[0]?.image_path ?? null })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const id = req.params.id
    await client.query(`DELETE FROM unit_images WHERE unit_id = $1`, [id])
    await client.query(`DELETE FROM unit_facilities WHERE unit_id = $1`, [id])
    const { rowCount } = await client.query(`DELETE FROM units WHERE id = $1`, [id])
    await client.query('COMMIT')
    if (!rowCount) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

export default router
