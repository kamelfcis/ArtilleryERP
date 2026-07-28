import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAnyRole } from '../middleware/requireRole.js'
import { buildInsert, buildUpdateSet, pickFields } from '../utils/sql.js'
import { writeAuditLog } from '../utils/auditWrite.js'

const router = Router()
const BLOCK_ROLES = ['SuperAdmin', 'Receptionist'] as const

const BLOCK_FIELDS = [
  'name',
  'name_ar',
  'start_date',
  'end_date',
  'reason',
  'reason_ar',
  'created_by',
] as const

async function fetchBlocks(start?: string, end?: string) {
  const params: unknown[] = []
  let where = ''

  if (start && end) {
    params.push(end, start)
    where = `WHERE rb.start_date <= $1::date AND rb.end_date >= $2::date`
  }

  const { rows } = await pool.query(
    `SELECT rb.*,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'unit', row_to_json(u.*)
        ))
         FROM room_block_units rbu
         INNER JOIN units u ON u.id = rbu.unit_id
         WHERE rbu.block_id = rb.id),
        '[]'::json
      ) AS units
     FROM room_blocks rb
     ${where}
     ORDER BY rb.start_date DESC`,
    params
  )

  return rows
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const start = req.query.start as string | undefined
    const end = req.query.end as string | undefined
    res.json(await fetchBlocks(start, end))
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT rb.*,
        COALESCE(
          (SELECT json_agg(json_build_object('unit_id', rbu.unit_id, 'unit', row_to_json(u.*)))
           FROM room_block_units rbu
           INNER JOIN units u ON u.id = rbu.unit_id
           WHERE rbu.block_id = rb.id),
          '[]'::json
        ) AS units
       FROM room_blocks rb WHERE rb.id = $1`,
      [req.params.id]
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

router.post('/', requireAuth, requireAnyRole(...BLOCK_ROLES), async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { unitIds, ...blockData } = req.body ?? {}
    const body = pickFields(
      { ...blockData, created_by: req.user!.id },
      BLOCK_FIELDS
    )
    const built = buildInsert(body, BLOCK_FIELDS)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }

    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO room_blocks (${built.columns}) VALUES (${built.placeholders}) RETURNING *`,
      built.values
    )
    const blockId = rows[0].id

    if (Array.isArray(unitIds) && unitIds.length > 0) {
      for (const unitId of unitIds) {
        await client.query(
          `INSERT INTO room_block_units (block_id, unit_id) VALUES ($1, $2)`,
          [blockId, unitId]
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

router.patch('/:id', requireAuth, requireAnyRole(...BLOCK_ROLES), async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { unitIds, ...updates } = req.body ?? {}
    const body = pickFields(updates, BLOCK_FIELDS.filter((f) => f !== 'created_by'))
    await client.query('BEGIN')

    const built = buildUpdateSet(body, 1, BLOCK_FIELDS.filter((f) => f !== 'created_by'))
    if (built) {
      await client.query(
        `UPDATE room_blocks SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1}`,
        [...built.values, req.params.id]
      )
    }

    if (Array.isArray(unitIds)) {
      await client.query(`DELETE FROM room_block_units WHERE block_id = $1`, [req.params.id])
      for (const unitId of unitIds) {
        await client.query(
          `INSERT INTO room_block_units (block_id, unit_id) VALUES ($1, $2)`,
          [req.params.id, unitId]
        )
      }
    }

    await client.query('COMMIT')
    const { rows } = await pool.query(`SELECT * FROM room_blocks WHERE id = $1`, [req.params.id])
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

router.delete('/:id', requireAuth, requireAnyRole(...BLOCK_ROLES), async (req, res, next) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM room_block_units WHERE block_id = $1`, [req.params.id])
    await client.query(`DELETE FROM room_blocks WHERE id = $1`, [req.params.id])
    await client.query('COMMIT')
    await writeAuditLog({
      userId: req.user!.id,
      action: 'DELETE',
      resourceType: 'room_block',
      resourceId: req.params.id,
    })
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

export default router
