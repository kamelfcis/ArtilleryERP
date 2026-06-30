import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUpdateSet } from '../utils/sql.js'

const router = Router()

function sanitizeIlike(q: string): string {
  return q
    .replace(/\\/g, '')
    .replace(/%/g, '')
    .replace(/_/g, '')
    .replace(/[,()]/g, '')
    .trim()
}

function normalizeDigits(q: string): string {
  return q.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.charCodeAt(0)
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660)
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0)
    return d
  })
}

function buildGuestWhere(
  search: string,
  guestType?: string
): { where: string; params: unknown[] } {
  const conditions = ['1=1']
  const params: unknown[] = []

  if (guestType) {
    params.push(guestType)
    conditions.push(`guest_type = $${params.length}`)
  }

  if (search) {
    params.push(`%${search}%`)
    const p = `$${params.length}`
    conditions.push(`(
      first_name ILIKE ${p} OR last_name ILIKE ${p} OR
      first_name_ar ILIKE ${p} OR last_name_ar ILIKE ${p} OR
      phone ILIKE ${p} OR email ILIKE ${p} OR national_id ILIKE ${p}
    )`)
  }

  return { where: conditions.join(' AND '), params }
}

router.get('/count', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM guests`)
    res.json({ count: parseInt(rows[0]?.count ?? '0', 10) })
  } catch (err) {
    next(err)
  }
})

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const pageSize = Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10) || 25)
    const guestType = req.query.guestType as string | undefined
    const searchRaw = (req.query.search as string | undefined)?.trim() ?? ''
    const search = searchRaw ? sanitizeIlike(normalizeDigits(searchRaw)) : ''
    const simple = req.query.simple === 'true'

    const { where, params } = buildGuestWhere(search, guestType)

    if (simple) {
      const limit = search ? 200 : 100
      const { rows } = await pool.query(
        `SELECT * FROM guests WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
        [...params, limit]
      )
      res.json(rows)
      return
    }

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM guests WHERE ${where}`,
      params
    )
    const totalCount = parseInt(countResult.rows[0]?.count ?? '0', 10)
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1
    const offset = (page - 1) * pageSize

    const { rows } = await pool.query(
      `SELECT * FROM guests WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    )

    res.json({ data: rows, totalCount, page, pageSize, totalPages })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM guests WHERE id = $1`, [req.params.id])
    if (!rows[0]) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const g = req.body ?? {}
    if (!g.first_name || !g.last_name || !g.phone) {
      res.status(400).json({ error: 'الاسم الأول والاسم الأخير ورقم الهاتف مطلوبة' })
      return
    }
    const { rows } = await pool.query(
      `INSERT INTO guests (
        first_name, last_name, phone, email, first_name_ar, last_name_ar,
        national_id, military_rank, military_rank_ar, unit, unit_ar, guest_type, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        g.first_name,
        g.last_name,
        g.phone,
        g.email ?? null,
        g.first_name_ar ?? null,
        g.last_name_ar ?? null,
        g.national_id ?? null,
        g.military_rank ?? null,
        g.military_rank_ar ?? null,
        g.unit ?? null,
        g.unit_ar ?? null,
        g.guest_type ?? 'military',
        g.notes ?? null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const allowed = [
      'first_name',
      'last_name',
      'phone',
      'email',
      'first_name_ar',
      'last_name_ar',
      'national_id',
      'military_rank',
      'military_rank_ar',
      'unit',
      'unit_ar',
      'guest_type',
      'notes',
    ]
    const body: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in (req.body ?? {})) body[k] = req.body[k]
    }
    const built = buildUpdateSet(body)
    if (!built) {
      res.status(400).json({ error: 'لا توجد بيانات للتحديث' })
      return
    }
    const { rows } = await pool.query(
      `UPDATE guests SET ${built.setClause}, updated_at = now() WHERE id = $${built.values.length + 1} RETURNING *`,
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

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM guests WHERE id = $1`, [req.params.id])
    if (!rowCount) {
      res.status(404).json({ error: 'غير موجود' })
      return
    }
    res.json({ id: req.params.id })
  } catch (err) {
    next(err)
  }
})

export default router
