import { Router, raw } from 'express'
import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '../middleware/auth.js'
import {
  isR2Configured,
  isStorageBucket,
  r2,
  R2_BUCKET,
  r2ObjectKey,
  r2PublicUrl,
} from '../storage/r2.js'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'خطأ في الاتصال بالتخزين'
      res.json({
        status: 'error',
        message,
        responseTime: Date.now() - start,
      })
    }
  } catch (err) {
    next(err)
  }
})

router.post('/presign', requireAuth, async (req, res, next) => {
  try {
    const bucket = req.body?.bucket
    const path = req.body?.path
    const contentType = req.body?.contentType

    if (!isStorageBucket(bucket) || !path || typeof path !== 'string') {
      res.status(400).json({ error: 'طلب غير صالح' })
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
      ContentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
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

/**
 * Server-side upload proxy — browser POSTs file bytes here so it never
 * talks to R2 directly (avoids bucket CORS requirements).
 *
 * Query: bucket, path
 * Headers: Content-Type (optional)
 * Body: raw file bytes (max 25MB)
 */
router.post(
  '/upload',
  requireAuth,
  raw({ type: '*/*', limit: MAX_UPLOAD_BYTES }),
  async (req, res, next) => {
    try {
      const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : ''
      const path = typeof req.query.path === 'string' ? req.query.path : ''

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

      const contentType =
        typeof req.headers['content-type'] === 'string' && req.headers['content-type']
          ? req.headers['content-type']
          : 'application/octet-stream'

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

router.delete('/delete', requireAuth, async (req, res, next) => {
  try {
    const bucket = req.body?.bucket
    const path = req.body?.path

    if (!isStorageBucket(bucket) || !path || typeof path !== 'string') {
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
