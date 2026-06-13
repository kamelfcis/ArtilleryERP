#!/usr/bin/env node
/**
 * migrate-to-r2.mjs
 * Copies all files from Supabase Storage (unit-images, reservation-files)
 * into a single Cloudflare R2 bucket under the same logical prefix.
 *
 * Usage: node scripts/migrate-to-r2.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

function loadEnv(filePath) {
  const env = {}
  try {
    const lines = readFileSync(filePath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      env[key] = val
    }
  } catch (err) {
    console.error(`Could not read ${filePath}: ${err.message}`)
    process.exit(1)
  }
  return env
}

const env = loadEnv(envPath)

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
const R2_ACCOUNT_ID = env['CLOUDFLARE_R2_ACCOUNT_ID']
const R2_ACCESS_KEY_ID = env['CLOUDFLARE_R2_ACCESS_KEY_ID']
const R2_SECRET_ACCESS_KEY = env['CLOUDFLARE_R2_SECRET_ACCESS_KEY']
const R2_BUCKET = env['CLOUDFLARE_R2_BUCKET_NAME']

const required = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY,
  CLOUDFLARE_R2_ACCOUNT_ID: R2_ACCOUNT_ID,
  CLOUDFLARE_R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID,
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY,
  CLOUDFLARE_R2_BUCKET_NAME: R2_BUCKET,
}

for (const [key, val] of Object.entries(required)) {
  if (!val || val.startsWith('<')) {
    console.error(`Missing or placeholder env var: ${key}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively list all files in a Supabase Storage bucket/folder */
async function listAllFiles(bucket, folder = '') {
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 1000,
    offset: 0,
  })

  if (error) throw new Error(`list ${bucket}/${folder}: ${error.message}`)
  if (!data || data.length === 0) return []

  const files = []
  for (const item of data) {
    const fullPath = folder ? `${folder}/${item.name}` : item.name
    if (item.id === null) {
      // It's a folder — recurse
      const nested = await listAllFiles(bucket, fullPath)
      files.push(...nested)
    } else {
      files.push(fullPath)
    }
  }
  return files
}

/** Download a file from Supabase Storage via signed URL */
async function downloadFile(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    throw new Error(`signed URL for ${bucket}/${path}: ${error?.message ?? 'no URL'}`)
  }

  const response = await fetch(data.signedUrl)
  if (!response.ok) {
    throw new Error(`download ${bucket}/${path}: HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
  return { buffer, contentType }
}

/** Detect content type from file extension as fallback */
function guessContentType(path) {
  const ext = path.split('.').pop()?.toLowerCase()
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
  }
  return map[ext] ?? 'application/octet-stream'
}

/** Upload a file to R2 */
async function uploadToR2(objectKey, buffer, contentType) {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType,
  }))
}

/** Attempt to migrate a single file with one retry */
async function migrateFile(supabaseBucket, filePath) {
  const objectKey = `${supabaseBucket}/${filePath}`

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { buffer, contentType } = await downloadFile(supabaseBucket, filePath)
      const finalContentType = contentType !== 'application/octet-stream'
        ? contentType
        : guessContentType(filePath)
      await uploadToR2(objectKey, buffer, finalContentType)
      return { ok: true }
    } catch (err) {
      if (attempt === 2) return { ok: false, error: err.message }
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const BUCKETS = ['unit-images', 'reservation-files']

async function main() {
  console.log('=== Artillery ERP: Supabase Storage → Cloudflare R2 Migration ===')
  console.log(`R2 Bucket: ${R2_BUCKET}`)
  console.log(`Supabase URL: ${SUPABASE_URL}\n`)

  let totalSuccess = 0
  let totalFailure = 0

  for (const bucket of BUCKETS) {
    console.log(`\n--- Listing files in Supabase bucket: ${bucket} ---`)

    let files
    try {
      files = await listAllFiles(bucket)
    } catch (err) {
      console.error(`  ERROR listing ${bucket}: ${err.message}`)
      continue
    }

    if (files.length === 0) {
      console.log(`  (empty — no files to migrate)`)
      continue
    }

    console.log(`  Found ${files.length} file(s). Migrating...`)
    let bucketSuccess = 0
    let bucketFailure = 0

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      const objectKey = `${bucket}/${filePath}`
      process.stdout.write(`  [${i + 1}/${files.length}] ${objectKey} ... `)

      const result = await migrateFile(bucket, filePath)
      if (result.ok) {
        console.log('OK')
        bucketSuccess++
      } else {
        console.log(`FAILED: ${result.error}`)
        bucketFailure++
      }
    }

    console.log(`  ${bucket}: ${bucketSuccess} succeeded, ${bucketFailure} failed`)
    totalSuccess += bucketSuccess
    totalFailure += bucketFailure
  }

  console.log('\n=== Migration Complete ===')
  console.log(`Total: ${totalSuccess} succeeded, ${totalFailure} failed`)

  if (totalFailure > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
