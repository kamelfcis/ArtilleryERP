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

// Vercel caps proxied request bodies at ~4.5 MB. Stay safely under it.
const PROXY_TARGET_BYTES = 4 * 1024 * 1024 // 4 MB

function getSize(file: UploadBody): number {
  return typeof (file as Blob).size === 'number' ? (file as Blob).size : 0
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}

/**
 * Downscale/compress an image on the client (canvas, no extra dependency) so the
 * same-origin proxy body stays under the ~4.5 MB Vercel limit. Falls back to the
 * original blob if the browser can't decode it.
 */
async function compressImage(file: UploadBody, targetBytes: number): Promise<Blob> {
  const source = file instanceof Blob ? file : new Blob([file])
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return source
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source)
  } catch {
    return source
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return source
  }

  const MAX_DIM = 2400
  let width = bitmap.width
  let height = bitmap.height
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = Math.min(MAX_DIM / width, MAX_DIM / height)
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }

  let best: Blob | null = null
  for (let attempt = 0; attempt < 6; attempt++) {
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    let quality = 0.9
    let blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    while (blob && blob.size > targetBytes && quality > 0.4) {
      quality = Math.round((quality - 0.1) * 10) / 10
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }

    if (blob) best = blob
    if (blob && blob.size <= targetBytes) break

    width = Math.max(1, Math.round(width * 0.8))
    height = Math.max(1, Math.round(height * 0.8))
  }

  bitmap.close?.()
  return best ?? source
}

/**
 * Prepare a file for the same-origin proxy: compress images to fit under the
 * proxy limit, and hard-guard non-image files with a clear Arabic error.
 */
async function prepareForProxy(
  file: UploadBody,
  contentType: string
): Promise<{ body: UploadBody; contentType: string }> {
  const isImage = contentType.startsWith('image/')
  const size = getSize(file)

  if (isImage) {
    if (size > 0 && size <= PROXY_TARGET_BYTES) {
      return { body: file, contentType }
    }
    const compressed = await compressImage(file, PROXY_TARGET_BYTES)
    if (compressed.size > PROXY_TARGET_BYTES) {
      throw new Error('تعذّر ضغط الصورة إلى أقل من ٤ ميجابايت. يرجى اختيار صورة أصغر أو بدقة أقل.')
    }
    return { body: compressed, contentType: 'image/jpeg' }
  }

  if (size > PROXY_TARGET_BYTES) {
    throw new Error('حجم الملف يتجاوز الحد المسموح به (٤ ميجابايت). يرجى اختيار ملف أصغر.')
  }

  return { body: file, contentType }
}

/**
 * Upload via the same-origin proxy (api mode): the browser POSTs to
 * `/api-backend/storage/upload`, the Next.js middleware forwards it to the
 * Express backend, which streams the bytes to R2. Browser never PUTs to R2, so
 * bucket CORS is not required, and the auth cookie is first-party.
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
    const prepared = await prepareForProxy(file, type)
    return uploadViaApiProxy(bucket, path, prepared.body, prepared.contentType)
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
