'use client'

import { fetchWithSupabaseAuth } from '@/lib/api/fetch-with-supabase-auth'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiDelete, apiPost } from '@/lib/api/http-client'
import type { StorageBucket } from '@/lib/storage/r2-client'

type UploadBody = File | Blob

type PresignResponse = {
  presignedUrl: string
  publicUrl: string
}

export async function uploadToR2(
  bucket: StorageBucket,
  path: string,
  file: UploadBody,
  contentType?: string
): Promise<string> {
  const type = contentType ?? (file instanceof File ? file.type : undefined) ?? 'application/octet-stream'

  let presignedUrl: string
  let publicUrl: string

  if (isApiProvider()) {
    const data = await apiPost<PresignResponse>('/storage/presign', {
      bucket,
      path,
      contentType: type,
    })
    presignedUrl = data.presignedUrl
    publicUrl = data.publicUrl
  } else {
    const presignRes = await fetchWithSupabaseAuth('/api/storage/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, path, contentType: type }),
    })

    if (!presignRes.ok) {
      const err = await presignRes.json().catch(() => ({}))
      throw new Error(err.error || 'فشل في تجهيز رابط الرفع')
    }

    const data = (await presignRes.json()) as PresignResponse
    presignedUrl = data.presignedUrl
    publicUrl = data.publicUrl
  }

  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': type },
  })

  if (!uploadRes.ok) {
    throw new Error('فشل في رفع الملف إلى التخزين')
  }

  return publicUrl
}

export async function deleteFromR2(bucket: StorageBucket, path: string): Promise<void> {
  if (isApiProvider()) {
    await apiDelete('/storage/delete', { bucket, path })
    return
  }

  const res = await fetchWithSupabaseAuth('/api/storage/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'فشل في حذف الملف')
  }
}
