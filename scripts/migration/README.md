# Supabase أ¢â€ â€™ VPS Database Migration

Step-by-step guide to export data from Supabase and import into a self-hosted PostgreSQL instance on your VPS.

## Prerequisites

- Supabase project dashboard access (Database settings أ¢â€ â€™ connection string)
- PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`) installed locally
- VPS with PostgreSQL 14+ (see `setup-vps.sh`)
- **Never commit** connection strings, service keys, or SSH passwords to git

## Expected row counts (verify after import)

| Table | Expected count |
|-------|----------------|
| reservations | 3230 |
| guests | 3999 |
| units | 170 |

Run `verify-counts.sql` after import to confirm.

---

## Step 1 أ¢â‚¬â€‌ Export from Supabase

### Option A: Windows (PowerShell)

```powershell
cd scripts/migration
.\export-supabase.ps1
```

The script prints the exact `pg_dump` commands. Set your Supabase connection string in the environment first:

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
.\export-supabase.ps1
```

### Option B: Bash (Git Bash / WSL / macOS / Linux)

```bash
export SUPABASE_DB_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
./export-supabase.sh
```

### What gets exported

1. **Public schema** أ¢â‚¬â€‌ all tables, views, functions, indexes (custom format dump)
2. **Auth users** أ¢â‚¬â€‌ `auth.users` rows needed for login (bcrypt passwords preserved)

### Option C: One-command local export (Windows)

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
.\scripts\migration\run-export-local.ps1
```

Writes to `migration-dumps/` (gitignored): full SQL, `public_schema_*.dump`, and `auth_users_*.sql`.

---

## Step 2 أ¢â‚¬â€‌ Prepare VPS database

### Windows Server (Hetzner `95.217.137.18`)

This VPS runs **Windows Server** with OpenSSH أ¢â‚¬â€‌ the Linux `setup-vps.sh` cannot run directly on the host OS.

**Option A أ¢â‚¬â€‌ WSL2 + Ubuntu (recommended, matches Linux scripts):**

```powershell
# On VPS (interactive SSH أ¢â‚¬â€‌ password prompt):
ssh Administrator@95.217.137.18

$env:ARTILLERY_DB_PASSWORD = 'YOUR_SECURE_PASSWORD'
$env:ARTILLERY_READONLY_PASSWORD = 'YOUR_READONLY_PASSWORD'
Set-ExecutionPolicy Bypass -Scope Process -Force
.\scripts\migration\setup-vps-windows.ps1
```

After reboot (if WSL was freshly installed), inside Ubuntu:

```bash
export ARTILLERY_DB_PASSWORD='...'
export ARTILLERY_READONLY_PASSWORD='...'
sudo -E bash scripts/migration/setup-wsl-postgres.sh
```

**Option B أ¢â‚¬â€‌ Native PostgreSQL 16 on Windows:** see output of `setup-vps-windows.ps1 -SkipWslInstall`.

### Linux VPS

```bash
export ARTILLERY_DB_PASSWORD='...'
export ARTILLERY_READONLY_PASSWORD='...'
sudo -E bash scripts/migration/setup-vps.sh
```

Then create staging DB if not created by script:

```bash
sudo -u postgres psql <<'EOF'
CREATE USER artillery_app WITH PASSWORD 'YOUR_SECURE_PASSWORD';
CREATE DATABASE artillery_erp_staging OWNER artillery_app;
GRANT ALL PRIVILEGES ON DATABASE artillery_erp_staging TO artillery_app;
EOF
```

---


### Windows PostgreSQL 18 (extensions schema fix)

If `pg_restore` as `artillery_app` fails with **schema "extensions" does not exist**, run on the VPS as **postgres**:

```powershell
$env:POSTGRES_SUPERUSER_PASSWORD = 'postgres-superuser-password'
Set-ExecutionPolicy Bypass -Scope Process -Force
cd C:\Artillery-ERP\scripts\migration
.\bootstrap-staging-windows.ps1 ``
  -PublicDump 'C:\Temp\migration-dumps\public_schema.dump' ``
  -AuthSql 'C:\Temp\migration-dumps\auth_users.sql'
```

Dev machine (env vars only, never commit): `run-bootstrap-on-vps.ps1`. SQL-only: `bootstrap-staging-pre-restore.sql`.

---

## Step 3 أ¢â‚¬â€‌ Import to VPS

Copy dump files to the VPS:

```bash
scp backups/public_schema.dump Administrator@95.217.137.18:/tmp/
scp backups/auth_users.sql Administrator@95.217.137.18:/tmp/
```

On the VPS:

```bash
export VPS_DB_URL="postgresql://artillery_app:YOUR_PASSWORD@localhost:5432/artillery_erp_staging"
bash import-to-vps.sh
```

Or run manually:

```bash
pg_restore --no-owner --no-acl -d "$VPS_DB_URL" /tmp/public_schema.dump
psql "$VPS_DB_URL" -f /tmp/auth_users.sql
```

---

## Step 4 أ¢â‚¬â€‌ Verify

```bash
psql "$VPS_DB_URL" -f verify-counts.sql
```

All counts should match the expected values above (ط¢آ±0).

---

## Step 5 أ¢â‚¬â€‌ Configure backend API

On the VPS (or locally pointing at staging DB):

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL to VPS connection string
# Set JWT_SECRET (openssl rand -base64 32)
npm install
npm run dev   # or npm run build && npm start
```

Test:

```bash
curl http://localhost:4001/health
```

---

## Step 6 أ¢â‚¬â€‌ Switch frontend (optional, gradual)

In the Next.js `.env.local`:

```
NEXT_PUBLIC_DATA_PROVIDER=api
NEXT_PUBLIC_API_URL=http://localhost:4001
```

Keep `supabase` as default until all hooks are migrated.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `pg_dump` not found | Install PostgreSQL client: https://www.postgresql.org/download/ |
| Auth login fails after import | Ensure `auth.users` import ran; check `encrypted_password` is not null |
| RPC not found | Re-run `supabase/migrations/*.sql` on VPS if dump missed functions |
| SSH connection refused | Use Hetzner console; configure SSH keys (see `backend/README.md`) |
| `schema "extensions" does not exist` | Run `bootstrap-staging-windows.ps1` or `bootstrap-staging-pre-restore.sql` as postgres before `pg_restore`  |
| Row count mismatch | Compare export date vs live Supabase; re-export if data changed |

---

## Security checklist

- [ ] `.env` and `.env.local` are gitignored
- [ ] VPS firewall allows PostgreSQL only from localhost (or VPN)
- [ ] `COOKIE_SECURE=true` on production API
- [ ] Supabase service role key removed from frontend before cutover


