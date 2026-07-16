/**
 * Set Cloudflare R2 bucket CORS for browser PUTs from Vercel / localhost.
 * Usage (from repo root, with .env.local loaded or env already set):
 *   node --env-file=.env.local scripts/ops/set-r2-cors.mjs
 */
import {
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error('Missing CLOUDFLARE_R2_* env vars')
  process.exit(1)
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
})

const CORSConfiguration = {
  CORSRules: [
    {
      AllowedOrigins: [
        'https://artillery-erp-vps.vercel.app',
        'https://artilleryerp.vercel.app',
        'http://localhost:3000',
      ],
      AllowedMethods: ['GET', 'PUT', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    },
  ],
}

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration,
  })
)

const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
console.log('R2_CORS_UPDATED')
console.log(JSON.stringify(current.CORSRules ?? [], null, 2))
