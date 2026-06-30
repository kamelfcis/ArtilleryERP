#!/usr/bin/env bash
# Export Supabase database for VPS migration
# Usage:
#   export SUPABASE_DB_URL="postgresql://postgres.[ref]:[PASSWORD]@...supabase.com:6543/postgres"
#   ./export-supabase.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
mkdir -p "$BACKUP_DIR"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: Set SUPABASE_DB_URL environment variable first."
  echo ""
  echo "Example (replace placeholders — do NOT commit this string):"
  echo '  export SUPABASE_DB_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"'
  exit 1
fi

PUBLIC_DUMP="${BACKUP_DIR}/public_schema.dump"
AUTH_SQL="${BACKUP_DIR}/auth_users.sql"

echo "Exporting public schema to ${PUBLIC_DUMP} ..."
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --schema=public \
  --no-owner \
  --no-acl \
  --file="$PUBLIC_DUMP"

echo "Exporting auth.users to ${AUTH_SQL} ..."
pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --table=auth.users \
  --no-owner \
  --no-acl \
  --file="$AUTH_SQL"

echo ""
echo "Export complete:"
echo "  ${PUBLIC_DUMP}"
echo "  ${AUTH_SQL}"
echo ""
echo "Next: copy files to VPS and run import-to-vps.sh (see README.md)"
