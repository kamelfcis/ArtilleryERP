#!/usr/bin/env bash
# Import Supabase dump into VPS PostgreSQL staging database
# Usage (app role — may fail on Supabase extensions; prefer POSTGRES_ADMIN_URL):
#   export VPS_DB_URL="postgresql://artillery_app:YOUR_PASSWORD@localhost:5432/artillery_erp_staging"
#   ./import-to-vps.sh [/path/to/public_schema.dump] [/path/to/auth_users.sql]
#
# Windows VPS (recommended):
#   export POSTGRES_ADMIN_URL="postgresql://postgres:SUPERUSER_PASSWORD@localhost:5432/postgres"
#   psql "$POSTGRES_ADMIN_URL" -d artillery_erp_staging -f bootstrap-staging-pre-restore.sql
#   pg_restore --no-owner --no-acl --clean --if-exists -U postgres -d artillery_erp_staging public_schema.dump
# Or run bootstrap-staging-windows.ps1 on the server.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPS_DB_URL="${VPS_DB_URL:-}"
POSTGRES_ADMIN_URL="${POSTGRES_ADMIN_URL:-}"
PUBLIC_DUMP="${1:-/tmp/public_schema.dump}"
AUTH_SQL="${2:-/tmp/auth_users.sql}"

if [[ -z "$VPS_DB_URL" && -z "$POSTGRES_ADMIN_URL" ]]; then
  echo "ERROR: Set VPS_DB_URL and/or POSTGRES_ADMIN_URL."
  exit 1
fi

if [[ ! -f "$PUBLIC_DUMP" ]]; then
  echo "ERROR: Public schema dump not found: $PUBLIC_DUMP"
  exit 1
fi

RESTORE_URL="${POSTGRES_ADMIN_URL:-$VPS_DB_URL}"
RESTORE_DB="${RESTORE_DB:-artillery_erp_staging}"

if [[ -n "$POSTGRES_ADMIN_URL" ]]; then
  echo "Bootstrapping extensions/auth in ${RESTORE_DB} (superuser) ..."
  psql "$POSTGRES_ADMIN_URL" -d "$RESTORE_DB" -v ON_ERROR_STOP=1 -f "${SCRIPT_DIR}/bootstrap-staging-pre-restore.sql"
fi

echo "Restoring public schema from ${PUBLIC_DUMP} ..."
if [[ -n "$POSTGRES_ADMIN_URL" ]]; then
  pg_restore --no-owner --no-acl --clean --if-exists -d "$RESTORE_DB" "$PUBLIC_DUMP" || true
else
  pg_restore --no-owner --no-acl --clean --if-exists -d "$RESTORE_URL" "$PUBLIC_DUMP" || true
fi

PSQL_URL="${VPS_DB_URL:-$POSTGRES_ADMIN_URL}"
if [[ -f "$AUTH_SQL" ]]; then
  echo "Importing auth.users from ${AUTH_SQL} ..."
  psql "$PSQL_URL" -d "$RESTORE_DB" -f "$AUTH_SQL"
else
  echo "WARN: auth_users.sql not found at ${AUTH_SQL} — skip auth import"
fi

echo ""
echo "Import complete. Run verify-counts.sql to validate row counts."
