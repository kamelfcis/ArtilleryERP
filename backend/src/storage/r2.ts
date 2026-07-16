import { S3Client } from '@aws-sdk/client-s3'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!
export const R2_CDN_URL =
  process.env.R2_CDN_URL || process.env.NEXT_PUBLIC_R2_CDN_URL || ''

export type StorageBucket = 'unit-images' | 'reservation-files'

export const STORAGE_BUCKETS: StorageBucket[] = ['unit-images', 'reservation-files']

export function isStorageBucket(value: string): value is StorageBucket {
  return STORAGE_BUCKETS.includes(value as StorageBucket)
}

/** Full object key inside the R2 bucket (prefix mirrors legacy Supabase bucket names). */
export function r2ObjectKey(bucket: StorageBucket, path: string): string {
  return `${bucket}/${path}`
}

export function r2PublicUrl(bucket: StorageBucket, path: string): string {
  const base = R2_CDN_URL.replace(/\/$/, '')
  return `${base}/${bucket}/${path}`
}

export function isR2Configured(): boolean {
  return Boolean(
    R2_BUCKET &&
      process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  )
}
