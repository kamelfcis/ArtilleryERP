/**
 * Set CORS on the Cloudflare R2 bucket.
 *
 * Requires ONE of the following in .env.local (or environment):
 *
 *   A) CLOUDFLARE_API_TOKEN  — a Cloudflare API Token with R2:Edit permission.
 *      Create at: https://dash.cloudflare.com/profile/api-tokens
 *      Template "Edit Cloudflare Workers" → select R2 bucket resource = artillery → create.
 *
 *   B) CLOUDFLARE_R2_ADMIN_ACCESS_KEY_ID + CLOUDFLARE_R2_ADMIN_SECRET_ACCESS_KEY
 *      — an R2 API token with "Admin Read & Write" scope (not just "Object Read & Write").
 *      Create at: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token
 *      → Permission: Admin Read & Write.
 *
 * The existing CLOUDFLARE_R2_ACCESS_KEY_ID/SECRET only has Object R&W scope and
 * cannot call PutBucketCors.
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

// Parse .env.local
const envVars = {}
try {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    envVars[key] = value
  }
} catch {
  console.error('Could not read .env.local — falling back to process.env')
}

function env(key) {
  return envVars[key] || process.env[key]
}

const accountId = env('CLOUDFLARE_R2_ACCOUNT_ID')
const bucket = env('CLOUDFLARE_R2_BUCKET_NAME')
const apiToken = env('CLOUDFLARE_API_TOKEN')
const adminKeyId = env('CLOUDFLARE_R2_ADMIN_ACCESS_KEY_ID') || env('CLOUDFLARE_R2_ACCESS_KEY_ID')
const adminSecret = env('CLOUDFLARE_R2_ADMIN_SECRET_ACCESS_KEY') || env('CLOUDFLARE_R2_SECRET_ACCESS_KEY')

if (!accountId || !bucket) {
  console.error('Missing CLOUDFLARE_R2_ACCOUNT_ID or CLOUDFLARE_R2_BUCKET_NAME in .env.local')
  process.exit(1)
}

const corsRules = [
  {
    AllowedOrigins: [
      'https://artilleryerp.vercel.app',
      'http://localhost:3000',
      'http://localhost:4000',
    ],
    AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  },
]

// ── Attempt 1: S3 API (needs Admin R&W token) ────────────────────────────────
console.log(`\nAttempt 1: S3 PutBucketCors on bucket "${bucket}"...`)
let success = false
try {
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: adminKeyId, secretAccessKey: adminSecret },
  })
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: corsRules },
    }),
  )
  console.log('✓ PutBucketCors (S3 API) succeeded.\n')
  success = true

  const result = await r2.send(new GetBucketCorsCommand({ Bucket: bucket }))
  console.log('✓ Verified CORS rules:')
  console.log(JSON.stringify(result.CORSRules, null, 2))
} catch (err) {
  console.warn(`  → S3 API failed: ${err.message}`)
  if (err.message.includes('Access Denied') || err.Code === 'AccessDenied') {
    console.warn('  (Token lacks Admin R&W scope — need CLOUDFLARE_R2_ADMIN_ACCESS_KEY_ID)')
  }
}

// ── Attempt 2: Cloudflare REST API (needs CLOUDFLARE_API_TOKEN) ──────────────
if (!success && apiToken) {
  console.log(`\nAttempt 2: Cloudflare REST API (CLOUDFLARE_API_TOKEN found)...`)
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/cors`
  try {
    const body = corsRules.map((rule) => ({
      allowed: {
        origins: rule.AllowedOrigins,
        methods: rule.AllowedMethods,
        headers: rule.AllowedHeaders,
      },
      exposeHeaders: rule.ExposeHeaders,
      maxAgeSeconds: rule.MaxAgeSeconds,
    }))
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.success !== false) {
      console.log(`✓ Cloudflare REST API succeeded (HTTP ${res.status}).`)
      success = true

      // Verify
      const getRes = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
      const getRules = await getRes.json()
      console.log('✓ Verified CORS rules:')
      console.log(JSON.stringify(getRules, null, 2))
    } else {
      console.warn(`  → REST API failed (HTTP ${res.status}):`, JSON.stringify(json))
    }
  } catch (err) {
    console.warn(`  → REST API error: ${err.message}`)
  }
}

// ── Attempt 3: wrangler CLI (needs CLOUDFLARE_API_TOKEN in env) ───────────────
if (!success && apiToken) {
  console.log(`\nAttempt 3: wrangler r2 bucket cors set...`)
  const corsJsonPath = resolve(__dirname, 'r2-cors.json')
  try {
    const out = execSync(
      `npx wrangler r2 bucket cors set ${bucket} --file "${corsJsonPath}" --force`,
      {
        cwd: resolve(__dirname, '..'),
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken },
      },
    )
    console.log(out)
    console.log('✓ wrangler cors set succeeded.')
    success = true
  } catch (err) {
    console.error('  → wrangler failed:', err.stdout || err.stderr || err.message)
  }
}

// ── No credentials available ─────────────────────────────────────────────────
if (!success) {
  console.error(`
✗ Could not set CORS. The existing R2 token only has "Object Read & Write" scope.

To fix, add ONE of the following to .env.local:

  Option A — Cloudflare API Token (recommended for scripts):
    1. Go to https://dash.cloudflare.com/profile/api-tokens
    2. Create Token → use "Edit Cloudflare Workers" template
    3. Under "Account Resources" select your account; under "Zone Resources" leave All zones
    4. Add R2 bucket permission: Account > Cloudflare R2 Storage > Edit > bucket = artillery
    5. Create and copy the token
    6. Add to .env.local:
         CLOUDFLARE_API_TOKEN=<paste token here>
    7. Re-run: node scripts/set-r2-cors.mjs

  Option B — R2 Admin API Token (simpler, R2-specific):
    1. Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens
    2. Create API Token → Permission: Admin Read & Write → Bucket: artillery
    3. Copy the Access Key ID and Secret
    4. Add to .env.local:
         CLOUDFLARE_R2_ADMIN_ACCESS_KEY_ID=<access key id>
         CLOUDFLARE_R2_ADMIN_SECRET_ACCESS_KEY=<secret access key>
    5. Re-run: node scripts/set-r2-cors.mjs
`)
  process.exit(1)
}
