#!/usr/bin/env bash
# Import Supabase dump into VPS PostgreSQL staging database
# Usage:
#   export VPS_DB_URL="postgresql://artillery_app:YOUR_PASSWORD@localhost:5432/artillery_erp_staging"
#   ./import-to-vps.sh [/path/to/public_schema.dump] [/path/to/auth_users.sql]

set -euo pipefail

VPS_DB_URL="${VPS_DB_URL:-}"
PUBLIC_DUMP="${1:-/tmp/public_schema.dump}"
AUTH_SQL="${2:-/tmp/auth_users.sql}"

if [[ -z "$VPS_DB_URL" ]]; then
  echo "ERROR: Set VPS_DB_URL environment variable."
  echo '  export VPS_DB_URL="postgresql://artillery_app:YOUR_PASSWORD@localhost:5432/artillery_erp_staging"'
  exit 1
fi

if [[ ! -f "$PUBLIC_DUMP" ]]; then
  echo "ERROR: Public schema dump not found: $PUBLIC_DUMP"
  exit 1
fi

echo "Restoring public schema from ${PUBLIC_DUMP} ..."
pg_restore --no-owner --no-acl --clean --if-exists -d "$VPS_DB_URL" "$PUBLIC_DUMP" || true

if [[ -f "$AUTH_SQL" ]]; then
  echo "Importing auth.users from ${AUTH_SQL} ..."
  psql "$VPS_DB_URL" -f "$AUTH_SQL"
else
  echo "WARN: auth_users.sql not found at ${AUTH_SQL} — skip auth import"
fi

echo ""
echo "Import complete. Run verify-counts.sql to validate row counts."
