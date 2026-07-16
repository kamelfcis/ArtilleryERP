'use client'

import { fetchWithSupabaseAuth } from '@/lib/api/fetch-with-supabase-auth'
import { getApiUrl, isApiProvider } from '@/lib/api/data-provider'
import { ApiError, apiDelete } from '@/lib/api/http-client'
import type { StorageBucket } from '@/lib/storage/r2-client'

type UploadBody = File | Blob

type PresignResponse = {
  presignedUrl: string
  publicUrl: string
}

type ProxyUploadResponse = {
  ok: boolean
  publicUrl: string
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Upload via Express proxy (api mode). Browser never PUTs to R2, so bucket CORS is not required.
 */
async function uploadViaApiProxy(
  bucket: StorageBucket,
  path: string,
  file: UploadBody,
  contentType: string
): Promise<string> {
  const base = getApiUrl().replace(/\/$/, '')
  const qs = new URLSearchParams({ bucket, path })
  const url = `${base}/storage/upload?${qs.toString()}`

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': contentType },
    body: file,
  })

  const body = await parseJsonSafe(res)
  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : res.statusText || 'فشل في رفع الملف'
    throw new ApiError(message, res.status, body)
  }

  const data = body as ProxyUploadResponse
  if (!data?.publicUrl) {
    throw new Error('فشل في رفع الملف إلى التخزين')
  }
  return data.publicUrl
}

export async function uploadToR2(
  bucket: StorageBucket,
  path: string,
  file: UploadBody,
  contentType?: string
): Promise<string> {
  const type = contentType ?? (file instanceof File ? file.type : undefined) ?? 'application/octet-stream'

  if (isApiProvider()) {
    return uploadViaApiProxy(bucket, path, file, type)
  }

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
  const uploadRes = await fetch(data.presignedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': type },
  })

  if (!uploadRes.ok) {
    throw new Error('فشل في رفع الملف إلى التخزين')
  }

  return data.publicUrl
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
