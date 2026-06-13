import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getVerifiedAuthUser } from '@/lib/api/verified-auth-user'
import { isStorageBucket, r2, R2_BUCKET, r2ObjectKey } from '@/lib/storage/r2-client'

export async function DELETE(request: NextRequest) {
  const authed = await getVerifiedAuthUser(request)
  if (!authed) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const bucket = body?.bucket
  const path = body?.path

  if (!isStorageBucket(bucket) || !path || typeof path !== 'string') {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  if (!R2_BUCKET) {
    return NextResponse.json({ error: 'إعدادات التخزين غير مكتملة' }, { status: 500 })
  }

  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2ObjectKey(bucket, path),
    })
  )

  return NextResponse.json({ ok: true })
}
