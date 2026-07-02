import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/reservation/:reservationId', requireAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : null
    const { rows } = await pool.query(
      `SELECT * FROM reservation_attachments
       WHERE reservation_id = $1
       ORDER BY created_at DESC
       ${limit ? `LIMIT ${limit}` : ''}`,
      [req.params.reservationId]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { reservation_id, files } = req.body ?? {}
    if (!reservation_id || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: 'لا توجد بيانات' })
      return
    }
    await client.query('BEGIN')
    const inserted = []
    for (const file of files) {
      const { rows } = await client.query(
        `INSERT INTO reservation_attachments
          (reservation_id, file_url, file_path, file_name, file_type, file_size, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          reservation_id,
          file.file_url,
          file.file_path,
          file.file_name,
          file.file_type ?? null,
          file.file_size ?? null,
          req.user!.id,
        ]
      )
      inserted.push(rows[0])
    }
    await client.query('COMMIT')
    res.status(201).json(inserted)
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM reservation_attachments WHERE id = $1 RETURNING file_path`,
      [req.params.id]
    )
    res.json({ success: true, file_path: rows[0]?.file_path ?? null })
  } catch (err) {
    next(err)
  }
})

export default router
