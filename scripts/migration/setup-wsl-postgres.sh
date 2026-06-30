#!/usr/bin/env bash
# Run inside WSL Ubuntu after `wsl --install` on Windows Server.
# Delegates to setup-vps.sh (Ubuntu/Debian bootstrap).
#
# Required env (never commit):
#   ARTILLERY_DB_PASSWORD
#   ARTILLERY_READONLY_PASSWORD
# Optional:
#   ARTILLERY_DOMAIN, ARTILLERY_API_PORT
#
# Usage (from Windows PowerShell on VPS):
#   wsl -d Ubuntu
#   export ARTILLERY_DB_PASSWORD='...'
#   export ARTILLERY_READONLY_PASSWORD='...'
#   sudo -E bash scripts/migration/setup-wsl-postgres.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${ARTILLERY_DB_PASSWORD:-}" || -z "${ARTILLERY_READONLY_PASSWORD:-}" ]]; then
  echo "Set ARTILLERY_DB_PASSWORD and ARTILLERY_READONLY_PASSWORD before running." >&2
  exit 1
fi

echo "==> WSL PostgreSQL bootstrap for Artillery ERP"
echo "    Delegating to setup-vps.sh (Ubuntu/Debian)"

if ! command -v lsb_release >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq lsb-release
fi

exec sudo -E bash "${SCRIPT_DIR}/setup-vps.sh"
