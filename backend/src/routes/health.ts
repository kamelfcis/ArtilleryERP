import { Router } from 'express'
import { pingDb } from '../db/pool.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const ok = await pingDb()
    if (!ok) throw new Error('db ping failed')
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    })
  } catch {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    })
  }
})

export default router
