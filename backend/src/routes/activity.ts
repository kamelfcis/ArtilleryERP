import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const conditions = ['1=1']
    const params: unknown[] = []
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)

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

    const { rows } = await pool.query(
      `SELECT * FROM activity_logs WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const { rows } = await pool.query(
      `INSERT INTO activity_logs
        (user_id, action, resource_type, resource_id, description, description_ar, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.user!.id,
        body.action,
        body.resource_type,
        body.resource_id ?? null,
        body.description ?? null,
        body.description_ar ?? null,
        body.metadata ?? null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
