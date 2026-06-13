import { NextRequest, NextResponse } from 'next/server'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { getVerifiedAuthUser } from '@/lib/api/verified-auth-user'
import { r2, R2_BUCKET } from '@/lib/storage/r2-client'

export async function GET(request: NextRequest) {
  const authed = await getVerifiedAuthUser(request)
  if (!authed) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  if (!R2_BUCKET) {
    return NextResponse.json({
      status: 'error',
      message: 'إعدادات التخزين غير مكتملة',
    })
  }

  const start = Date.now()

  try {
    await r2.send(new HeadBucketCommand({ Bucket: R2_BUCKET }))
    return NextResponse.json({
      status: 'healthy',
      message: 'التخزين (R2) يعمل بشكل طبيعي',
      responseTime: Date.now() - start,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'خطأ في الاتصال بالتخزين'
    return NextResponse.json({
      status: 'error',
      message,
      responseTime: Date.now() - start,
    })
  }
}
