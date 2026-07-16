import { Router } from 'express'
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
