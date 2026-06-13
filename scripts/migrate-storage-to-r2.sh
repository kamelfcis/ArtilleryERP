#!/usr/bin/env bash
# =============================================================================
# Supabase Storage → Cloudflare R2 one-time migration (rclone)
# =============================================================================
#
# PREREQUISITES (manual — Cloudflare dashboard):
#   1. Create an R2 bucket and enable Public Access (or attach a custom domain).
#   2. Create an R2 API token with Object Read & Write on that bucket.
#   3. Note: Account ID, Access Key ID, Secret Access Key, bucket name, public CDN URL.
#   4. Add R2 env vars to .env.local (see comments at bottom of that file).
#
# PREREQUISITES (rclone):
#   Install rclone: https://rclone.org/install/
#
# CONFIGURE TWO S3-COMPATIBLE REMOTES (run once):
#
#   rclone config
#
#   Remote name: supabase
#     type: s3
#     provider: Other
#     env_auth: false
#     access_key_id: <SUPABASE_SERVICE_ROLE_KEY or S3 access key>
#     secret_access_key: <supabase project secret>
#     endpoint: https://rroxljxrlaaiwerygwlw.supabase.co/storage/v1/s3
#     region: us-east-1
#
#   Remote name: r2
#     type: s3
#     provider: Cloudflare
#     env_auth: false
#     access_key_id: <CLOUDFLARE_R2_ACCESS_KEY_ID>
#     secret_access_key: <CLOUDFLARE_R2_SECRET_ACCESS_KEY>
#     endpoint: https://3e14755463cbcc692836b8c18c4775a9.r2.cloudflarestorage.com
#     region: auto
#
# Replace placeholders below before running:
#   R2_BUCKET_NAME=<your_r2_bucket_name>
#
# =============================================================================

set -euo pipefail

R2_BUCKET_NAME="artillery"
# Account ID: 3e14755463cbcc692836b8c18c4775a9
# R2 endpoint: https://3e14755463cbcc692836b8c18c4775a9.r2.cloudflarestorage.com

echo "=== Dry run: unit-images ==="
rclone sync supabase:unit-images "r2:${R2_BUCKET_NAME}/unit-images" --progress --dry-run

echo "=== Dry run: reservation-files ==="
rclone sync supabase:reservation-files "r2:${R2_BUCKET_NAME}/reservation-files" --progress --dry-run

read -r -p "Dry run complete. Proceed with actual sync? [y/N] " confirm
if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo "=== Syncing unit-images ==="
rclone sync supabase:unit-images "r2:${R2_BUCKET_NAME}/unit-images" --progress

echo "=== Syncing reservation-files ==="
rclone sync supabase:reservation-files "r2:${R2_BUCKET_NAME}/reservation-files" --progress

echo "Done. Verify files in Cloudflare R2 dashboard, then run the SQL URL migration."
