import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500)

    if (req.query.resourceType) {
      params.push(req.query.resourceType)
      conditions.push(`resource_type = $${params.length}`)
    }
    if (req.query.resourceId) {
      params.push(req.query.resourceId)
      conditions.push(`resource_id = $${params.length}`)
    }
    if (req.query.userId) {
      params.push(req.query.userId)
      conditions.push(`user_id = $${params.length}`)
    }
    if (req.query.action) {
      params.push(req.query.action)
      conditions.push(`action = $${params.length}`)
    }
    if (req.query.dateFrom) {
      params.push(req.query.dateFrom)
      conditions.push(`created_at >= $${params.length}`)
    }
    if (req.query.dateTo) {
      params.push(req.query.dateTo)
      conditions.push(`created_at <= $${params.length}`)
    }
    if (req.query.unitId) {
      params.push(req.query.unitId)
      conditions.push(
        `(new_values->>'unit_id' = $${params.length} OR old_values->>'unit_id' = $${params.length})`
      )
    }
    if (req.query.locationId) {
      const locConditions = [
        `new_values->>'location_id' = $${params.length + 1}`,
        `old_values->>'location_id' = $${params.length + 1}`,
      ]
      params.push(req.query.locationId)
      const unitIds = String(req.query.unitIdsForLocation ?? '')
        .split(',')
        .filter(Boolean)
      if (unitIds.length > 0) {
        params.push(unitIds)
        locConditions.push(`new_values->>'unit_id' = ANY($${params.length}::text[])`)
        locConditions.push(`old_values->>'unit_id' = ANY($${params.length}::text[])`)
      }
      conditions.push(`(${locConditions.join(' OR ')})`)
    }

    const { rows } = await pool.query(
      `SELECT * FROM audit_logs WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM audit_logs WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
