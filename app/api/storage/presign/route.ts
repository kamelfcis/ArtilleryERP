import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getVerifiedAuthUser } from '@/lib/api/verified-auth-user'
import {
  isStorageBucket,
  r2,
  R2_BUCKET,
  r2ObjectKey,
  r2PublicUrl,
} from '@/lib/storage/r2-client'

export async function POST(request: NextRequest) {
  const authed = await getVerifiedAuthUser(request)
  if (!authed) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const bucket = body?.bucket
  const path = body?.path
  const contentType = body?.contentType

  if (!isStorageBucket(bucket) || !path || typeof path !== 'string') {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  if (!R2_BUCKET || !process.env.CLOUDFLARE_R2_ACCOUNT_ID) {
    return NextResponse.json({ error: 'إعدادات التخزين غير مكتملة' }, { status: 500 })
  }

  const key = r2ObjectKey(bucket, path)

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
  })

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 })

  return NextResponse.json({
    presignedUrl,
    publicUrl: r2PublicUrl(bucket, path),
  })
}
