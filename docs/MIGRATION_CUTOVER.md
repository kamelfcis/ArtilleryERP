# Supabase → VPS Migration Cutover Checklist

Step-by-step guide for switching Artillery ERP from Supabase to the self-hosted VPS API. These steps require your domain, SSH access, and Vercel project settings — they cannot be executed from the codebase alone.

## Pre-cutover (staging)

- [ ] VPS bootstrapped via `setup-vps-windows.ps1` (Windows) or `setup-vps.sh` / `setup-wsl-postgres.sh` (WSL/Linux)
- [ ] Supabase data exported (`run-export-local.ps1`, `export-supabase.ps1`, or `.sh`)
- [ ] Dump imported into `artillery_erp_staging` (`import-to-vps.sh`)
- [ ] `verify-counts.sql` row counts match Supabase
- [ ] Backend deployed on VPS staging DB, health check passes: `GET /health`
- [ ] Login works against staging API with a test account
- [ ] Calendar, reservations list, guests list load correctly

### Staging Vercel preview

Create a preview deployment or separate Vercel project:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_DATA_PROVIDER` | `api` |
| `NEXT_PUBLIC_API_URL` | `https://api-staging.yourdomain.com` (or VPS IP for smoke test) |

Keep Supabase vars in place until production cutover — they are ignored when `DATA_PROVIDER=api`.

## Production cutover

### 1. Final data sync

1. Put app in maintenance window (optional banner).
2. Export fresh Supabase dump.
3. Import into `artillery_erp` on VPS (not staging).
4. Run `verify-counts.sql` and compare with Supabase dashboard counts.

### 2. Deploy backend (production)

```bash
# On VPS
cd /path/to/Artillery ERP/backend
cp .env.example .env
# DATABASE_URL → artillery_erp on localhost
# JWT_SECRET → strong random secret
# NODE_ENV=production
# CORS_ORIGINS=https://artilleryerp.vercel.app

npm ci
npm run build
pm2 restart artillery-api || pm2 start dist/index.js --name artillery-api
pm2 save
```

### 3. TLS and DNS

- [ ] DNS A record: `api.yourdomain.com` → VPS IP (`95.216.63.81`)
- [ ] `certbot --nginx -d api.yourdomain.com`
- [ ] Confirm `GET https://api.yourdomain.com/health` returns `{ "status": "ok" }`

### 4. Vercel production env vars

In Vercel → Project → Settings → Environment Variables (Production):

| Variable | New value | Notes |
|----------|-----------|-------|
| `NEXT_PUBLIC_DATA_PROVIDER` | `api` | Switches AuthContext + future API hooks |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | Must match Nginx TLS host |
| `NEXT_PUBLIC_SUPABASE_URL` | *(keep or remove)* | Unused when provider is `api` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(keep or remove)* | Unused when provider is `api` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(keep until Next.js API routes migrated)* | Still needed for server routes not yet on VPS |

Redeploy production after saving env vars.

### 5. Smoke tests (production)

- [ ] Login with SuperAdmin account
- [ ] `/modules` loads, roles correct
- [ ] Calendar page shows reservations for current month
- [ ] Reservations paginated list loads
- [ ] Guests search works
- [ ] Admin: update unit statuses (SuperAdmin/Receptionist)

### 6. Rollback plan

If critical issues appear within the maintenance window:

1. Set Vercel `NEXT_PUBLIC_DATA_PROVIDER=supabase` (revert to previous values).
2. Redeploy frontend — app returns to Supabase immediately.
3. VPS data remains for debugging; Supabase was source of truth until cutover completed.

### 7. Post-cutover

- [ ] Rotate VPS Administrator password (if not done)
- [ ] Disable Supabase project billing after retention period (optional)
- [ ] Set up PM2 startup: `pm2 startup` + `pm2 save`
- [ ] Configure nightly `pg_dump` backups on VPS
- [ ] Monitor Nginx + PM2 logs for 48 hours

## Notes

- **Realtime / Storage**: This migration covers Postgres-backed reads and auth. Supabase Realtime and Storage may still be used until separately migrated.
- **Cookie domain**: Production requires HTTPS on the API subdomain with `SameSite=None; Secure` (configured in backend).
- **CORS**: Backend `CORS_ORIGINS` must include `https://artilleryerp.vercel.app`.

## VPS setup session log (2026-07-01)

Target: `Administrator@95.216.63.81` (Hetzner).

| Check | Result |
|-------|--------|
| TCP port 22 | OK |
| SSH handshake | OK — remote `OpenSSH_for_Windows_8.1` (**Windows Server**, not Linux) |
| Key-based auth | Not configured on this machine |
| Password automation | Not run from CI/agent (no `plink`/`sshpass`; OpenSSH needs interactive password) |
| `setup-vps.sh` | **Not run** — script is Ubuntu/Debian (`apt`, `ufw`, `nginx`); incompatible with bare Windows |
| DBs `artillery_erp`, `artillery_erp_staging` | **Not created** (no authenticated session) |

### Recommended path on this VPS

1. **Option A (matches repo scripts):** Enable WSL2 + Ubuntu on the server, run `setup-vps.sh` inside Linux with `ARTILLERY_DB_PASSWORD` / `ARTILLERY_READONLY_PASSWORD` exported (never commit).
2. **Option B:** Install [PostgreSQL 16 for Windows](https://www.postgresql.org/download/windows/), create roles/DBs with `psql`, run Node backend as a Windows service or PM2 on Windows; skip Nginx or use IIS/reverse proxy.
3. **Security:** After first successful login, add SSH public keys, disable password auth if policy allows, rotate Administrator password.

### Manual SSH test (local terminal)

```powershell
ssh Administrator@95.216.63.81
# Enter password when prompted, then:
ver
# Optional: wsl --status
```

### After PostgreSQL exists — DB import

From your dev machine (with dumps from `export-supabase.ps1`):

```powershell
scp backups/public_schema.dump Administrator@95.216.63.81:C:/Temp/
scp backups/auth_users.sql Administrator@95.216.63.81:C:/Temp/
```

On the VPS (WSL or wherever PostgreSQL listens):

```bash
export VPS_DB_URL="postgresql://artillery_app:YOUR_APP_DB_PASSWORD@localhost:5432/artillery_erp_staging"
bash scripts/migration/import-to-vps.sh /tmp/public_schema.dump /tmp/auth_users.sql
psql "$VPS_DB_URL" -f scripts/migration/verify-counts.sql
```

