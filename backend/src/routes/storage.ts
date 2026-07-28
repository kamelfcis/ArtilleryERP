import { Router, raw } from 'express'
import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '../middleware/auth.js'
import { requireAnyRole } from '../middleware/requireRole.js'
import {
  isR2Configured,
  isStorageBucket,
  r2,
  R2_BUCKET,
  r2ObjectKey,
  r2PublicUrl,
} from '../storage/r2.js'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const WRITE_ROLES = ['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff'] as const

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const PATH_RE = /^[a-zA-Z0-9/_.-]+$/

function sanitizeStoragePath(path: string): string | null {
  if (!path || typeof path !== 'string') return null
  if (path.includes('..') || path.includes('\\') || path.includes('\0')) return null
  if (path.startsWith('/') || path.startsWith('\\')) return null
  if (!PATH_RE.test(path)) return null
  return path
}

function sanitizeContentType(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null
  const base = raw.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(base)) return null
  return base
}

const router = Router()

router.get('/health', requireAuth, async (_req, res, next) => {
  try {
    if (!isR2Configured()) {
      res.json({
        status: 'error',
        message: 'إعدادات التخزين غير مكتملة',
      })
      return
    }

    const start = Date.now()
    try {
      await r2.send(new HeadBucketCommand({ Bucket: R2_BUCKET }))
      res.json({
        status: 'healthy',
        message: 'التخزين (R2) يعمل بشكل طبيعي',
        responseTime: Date.now() - start,
      })
    } catch {
      res.json({
        status: 'error',
        message: 'خطأ في الاتصال بالتخزين',
        responseTime: Date.now() - start,
      })
    }
  } catch (err) {
    next(err)
  }
})

router.post('/presign', requireAuth, requireAnyRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const bucket = req.body?.bucket
    const path = sanitizeStoragePath(req.body?.path)
    const contentType = sanitizeContentType(req.body?.contentType) ?? 'application/octet-stream'

    if (!isStorageBucket(bucket) || !path) {
      res.status(400).json({ error: 'طلب غير صالح' })
      return
    }

    if (req.body?.contentType && !sanitizeContentType(req.body.contentType)) {
      res.status(400).json({ error: 'نوع الملف غير مسموح' })
      return
    }

    if (!isR2Configured()) {
      res.status(500).json({ error: 'إعدادات التخزين غير مكتملة' })
      return
    }

    const key = r2ObjectKey(bucket, path)
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    })

    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 })

    res.json({
      presignedUrl,
      publicUrl: r2PublicUrl(bucket, path),
    })
  } catch (err) {
    next(err)
  }
})

router.post(
  '/upload',
  requireAuth,
  requireAnyRole(...WRITE_ROLES),
  raw({ type: '*/*', limit: MAX_UPLOAD_BYTES }),
  async (req, res, next) => {
    try {
      const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : ''
      const path = sanitizeStoragePath(
        typeof req.query.path === 'string' ? req.query.path : ''
      )

      if (!isStorageBucket(bucket) || !path) {
        res.status(400).json({ error: 'طلب غير صالح' })
        return
      }

      if (!isR2Configured()) {
        res.status(500).json({ error: 'إعدادات التخزين غير مكتملة' })
        return
      }

      const body = req.body
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: 'ملف فارغ أو غير صالح' })
        return
      }

      if (body.length > MAX_UPLOAD_BYTES) {
        res.status(413).json({ error: 'حجم الملف يتجاوز الحد المسموح (25MB)' })
        return
      }

      const headerType =
        typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : ''
      const contentType = sanitizeContentType(headerType)
      if (!contentType) {
        res.status(400).json({ error: 'نوع الملف غير مسموح' })
        return
      }

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2ObjectKey(bucket, path),
          Body: body,
          ContentType: contentType,
        })
      )

      res.json({
        ok: true,
        publicUrl: r2PublicUrl(bucket, path),
      })
    } catch (err) {
      next(err)
    }
  }
)

router.delete('/delete', requireAuth, requireAnyRole(...WRITE_ROLES), async (req, res, next) => {
  try {
    const bucket = req.body?.bucket
    const path = sanitizeStoragePath(req.body?.path)

    if (!isStorageBucket(bucket) || !path) {
      res.status(400).json({ error: 'طلب غير صالح' })
      return
    }

    if (!isR2Configured()) {
      res.status(500).json({ error: 'إعدادات التخزين غير مكتملة' })
      return
    }

    await r2.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2ObjectKey(bucket, path),
      })
    )

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
