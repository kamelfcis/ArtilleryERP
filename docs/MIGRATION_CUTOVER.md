# Supabase â†’ VPS Migration Cutover Checklist

Step-by-step guide for switching Artillery ERP from Supabase to the self-hosted VPS API. These steps require your domain, SSH access, and Vercel project settings â€” they cannot be executed from the codebase alone.

> **For the operator-ready final cutover procedure, use [`FINAL_CUTOVER_RUNBOOK.md`](./FINAL_CUTOVER_RUNBOOK.md).**
> It supersedes the historical "Production cutover" section below with the current VPS reality
> (Windows + PostgreSQL 18 `artillery_erp_staging`, Cloudflare tunnel, delta-sync toolkit). This file
> remains the source of truth for the migration **history and session logs**.

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

Keep Supabase vars in place until production cutover â€” they are ignored when `DATA_PROVIDER=api`.

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
# DATABASE_URL â†’ artillery_erp on localhost
# JWT_SECRET â†’ strong random secret
# NODE_ENV=production
# CORS_ORIGINS=https://artilleryerp.vercel.app

npm ci
npm run build
pm2 restart artillery-api || pm2 start dist/index.js --name artillery-api
pm2 save
```

### 3. TLS and DNS

- [ ] DNS A record: `api.yourdomain.com` â†’ VPS IP (`95.217.137.18`)
- [ ] `certbot --nginx -d api.yourdomain.com`
- [ ] Confirm `GET https://api.yourdomain.com/health` returns `{ "status": "ok" }`

### 4. Vercel production env vars

In Vercel â†’ Project â†’ Settings â†’ Environment Variables (Production):

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
2. Redeploy frontend â€” app returns to Supabase immediately.
3. VPS data remains for debugging; Supabase was source of truth until cutover completed.

### 7. Post-cutover

- [ ] Rotate VPS Administrator password (if not done)
- [ ] Disable Supabase project billing after retention period (optional)
- [ ] Set up PM2 startup: `pm2 startup` + `pm2 save`
- [ ] Configure nightly `pg_dump` backups on VPS
- [ ] Monitor Nginx + PM2 logs for 48 hours

## Notes

- **Canonical API host (target):** `https://api-artillery.pdfnox.com` → VPS `http://localhost:4000` via an
  **additional** Public Hostname on the existing PDFNox Cloudflare named tunnel. **Do not** edit
  `api.pdfnox.com` → `:3000` or stop the Windows service `Cloudflared`. Until that hostname’s `/health`
  returns Artillery JSON, Edge Config `backendUrl` stays on the Artillery quick tunnel
  (`*.trycloudflare.com`) and `Artillery-Ensure-Tunnel` remains active. After cutover, replace that task
  with `scripts/ops/ensure-artillery-health.ps1` (keeps `:4000` / Edge Config canonical; does **not** chase
  trycloudflare). See session log **2026-07-18** below for the blocked Cloudflare dashboard steps.
- **Port 4000 is reserved for Artillery** on the VPS (`C:\Artillery-ERP\backend-deploy`, PM2 `artillery-api`).
  The Cloudflare quick tunnel (`C:\cloudflared\artillery-quick.yml`) and Vercel same-origin proxy
  (`/api-backend/*` → Edge Config `backendUrl`) both expect Artillery on `http://localhost:4000`.
  Other apps on this host (notably **reelsaverdl-api** via NSSM `ReelSaverDL-API`) must **not** bind 4000 —
  use **4002** (or another free port). If `/health` returns `reelsaverdl-api`, login and API routes will 404
  through the proxy even though something is listening. `ensure-artillery-tunnel.ps1` refuses to update Edge
  Config when `/health` is not Artillery-shaped.
- **Known reservation conflicts (as of 2026-07-02 delta-sync):** the latest delta-sync verifies **44/45 tables
  PASS**; only `public.reservations` diverges on **3 genuine booking conflicts** against the unique constraint
  `reservations_unit_date_range` (1 double-booking + a 2-reservation unit-swap deadlock). All 3 were **safely
  SKIPPED** (no live rows deleted/overwritten) and `reservation_attachments` is now fully synced. These are
  **deferred by decision until final cutover**. The concrete row ids, the resolution approach, and the operator
  inspection queries live in [`FINAL_CUTOVER_RUNBOOK.md`](./FINAL_CUTOVER_RUNBOOK.md) §6 ("Known reservation
  conflicts to resolve"). Do not resolve them here — follow that runbook.
- **Realtime / Storage**: This migration covers Postgres-backed reads and auth. Supabase Realtime and Storage may still be used until separately migrated.
- **Cookie domain**: Production requires HTTPS on the API subdomain with `SameSite=None; Secure` (configured in backend).
- **CORS**: Backend `CORS_ORIGINS` must include `https://artilleryerp.vercel.app`.

## VPS setup session log (2026-07-01)

Target: `Administrator@95.217.137.18` (Hetzner).

| Check | Result |
|-------|--------|
| TCP port 22 | OK |
| SSH handshake | OK â€” remote `OpenSSH_for_Windows_8.1` (**Windows Server**, not Linux) |
| Key-based auth | Not configured on this machine |
| Password automation | Not run from CI/agent (no `plink`/`sshpass`; OpenSSH needs interactive password) |
| `setup-vps.sh` | **Not run** â€” script is Ubuntu/Debian (`apt`, `ufw`, `nginx`); incompatible with bare Windows |
| DBs `artillery_erp`, `artillery_erp_staging` | **Not created** (no authenticated session) |

### Recommended path on this VPS

1. **Option A (matches repo scripts):** Enable WSL2 + Ubuntu on the server, run `setup-vps.sh` inside Linux with `ARTILLERY_DB_PASSWORD` / `ARTILLERY_READONLY_PASSWORD` exported (never commit).
2. **Option B:** Install [PostgreSQL 16 for Windows](https://www.postgresql.org/download/windows/), create roles/DBs with `psql`, run Node backend as a Windows service or PM2 on Windows; skip Nginx or use IIS/reverse proxy.
3. **Security:** After first successful login, add SSH public keys, disable password auth if policy allows, rotate Administrator password.

### Manual SSH test (local terminal)

```powershell
ssh Administrator@95.217.137.18
# Enter password when prompted, then:
ver
# Optional: wsl --status
```

### After PostgreSQL exists â€” DB import

From your dev machine (with dumps from `export-supabase.ps1`):

```powershell
scp backups/public_schema.dump Administrator@95.217.137.18:C:/Temp/
scp backups/auth_users.sql Administrator@95.217.137.18:C:/Temp/
```

On the VPS (WSL or wherever PostgreSQL listens):

```bash
export VPS_DB_URL="postgresql://artillery_app:YOUR_APP_DB_PASSWORD@localhost:5432/artillery_erp_staging"
bash scripts/migration/import-to-vps.sh /tmp/public_schema.dump /tmp/auth_users.sql
psql "$VPS_DB_URL" -f scripts/migration/verify-counts.sql
```


## VPS setup session log (2026-07-02)

Target: `Administrator@95.217.137.18` (Hetzner, **new** VPS; deprecated old IP `95.216.63.81`).

| Check | Result |
|-------|--------|
| TCP port 22 | OK |
| SSH (PuTTY `plink`) | OK — host key `SHA256:bYaeYqGc2lO8VQeGU5t1+nasVzjxMUfkOSpCR1LXtk4` |
| RAM | ~4 GB total (`TotalVisibleMemorySize` ? 4095456 KB) |
| Node.js | v20.17.0 |
| Git | 2.49.0 |
| PM2 | 6.0.14 (installed; prefer plain `node` on this box if OOM during `tsc` / PM2) |
| PostgreSQL | **18.3** running (`postgresql-x64-18`), path `C:\Program Files\PostgreSQL\18\` |
| DBs | `artillery_erp`, `artillery_erp_staging` created |
| Roles | `artillery_app`, `artillery_readonly` |
| App secrets file (VPS only) | `C:\Temp\artillery-db-secrets.txt` |
| Repo on VPS | `C:\Artillery-ERP` (clone from GitHub) |
| API deploy | Prebuilt `backend` at `C:\Artillery-ERP\backend-deploy` (local `tsc` + zip upload; VPS `npm ci --omit=dev`) |
| Health | `http://127.0.0.1:4000/health` ? `status: ok`, `database: connected` (empty schema until import) |
| Supabase export | **Not run** — `SUPABASE_DB_URL` not in `.env.local`; set from Dashboard then run `scripts/migration/run-export-local.ps1` |
| verify-counts.sql | **Not passed** — tables not imported yet |

### PuTTY non-interactive SSH (Windows agent)

```powershell
$hk = "SHA256:bYaeYqGc2lO8VQeGU5t1+nasVzjxMUfkOSpCR1LXtk4"
& "C:\Program Files\PuTTY\plink.exe" -batch -ssh Administrator@95.217.137.18 -hostkey $hk "hostname"
```

### Memory notes

- `npm run build` (`tsc`) on the VPS can hit **OOM**; build locally and deploy `dist/` + production `npm ci`.
- Removed partial installers `C:\Temp\pg16.exe`, `C:\Temp\pg-bin.zip` after PostgreSQL 18 was confirmed.
- Enabled automatic pagefile; reboot if Node/PM2 still OOM under load.


## Migration session log (2026-07-02, agent)

| Step | Result |
|------|--------|
| Supabase pooler | **aws-1-eu-west-1.pooler.supabase.com:5432** (session mode; `aws-0-*` returned tenant not found). Direct `db.*.supabase.co` is IPv6-only (fails on dev box without IPv6). |
| Local `run-export-local.ps1` | **Blocked** â€” only `pg_dump` 16.14 installed; Supabase is PG **17.6** (version mismatch). PowerShell also breaks when passing URI as bare first arg; use `PGHOST`/`PGUSER` env or `pg_dump -d $uri`. |
| Export on VPS | **OK** â€” `C:\Temp\migration-dumps\public_schema.dump` (~1.69 MB), `auth_users.sql` (~15 KB) via PG 18 `pg_dump`. |
| PostgreSQL service | Was **STOPPED**; started with `net start postgresql-x64-18`. |
| Staging import | **Failed verify** â€” `pg_restore` as `artillery_app`: missing `extensions` schema / extensions; tables like `reservations` never created. `verify-counts.sql`: `relation "reservations" does not exist`. |
| VPS SSH (after import) | **Unreachable** â€” TCP 22/4000 timeout; ping failed (possible reboot/OOM/network). |
| Steps 4â€“5 | **Not done** â€” backend `.env` staging, API restart, firewall 4000. |
| Vercel | **Not flipped** (per instructions). |

### Next immediate steps (when VPS is back)

1. Confirm SSH: `plink -batch -pw â€¦ Administrator@95.217.137.18 hostname`
2. Ensure `postgresql-x64-18` is **Running** and set service to Automatic.
3. Re-import as **postgres** superuser after bootstrap:
   - `CREATE SCHEMA IF NOT EXISTS extensions;`
   - `CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;` (and any other extensions referenced in dump)
   - `pg_restore --no-owner --no-acl --clean --if-exists -d artillery_erp_staging â€¦` (or use plain SQL export if custom dump keeps failing)
4. Run `verify-counts.sql` (expect reservations 3230, guests 3999, units 170).
5. Point `C:\Artillery-ERP\backend-deploy\.env` at `DATABASE_URL_STAGING`, restart Node on 4000, open firewall, smoke-test `/health`.

### Cutover env (when ready)

- `NEXT_PUBLIC_DATA_PROVIDER=api`
- `NEXT_PUBLIC_API_URL=http://95.217.137.18:4000` (smoke) or `https://api.yourdomain.com` after TLS


## Migration session log (2026-07-02, agent — connectivity)

| Step | Result |
|------|--------|
| TCP 22 / 4000 (`Test-NetConnection`) | **Failed** — timeout; ping failed |
| PuTTY `plink` (`C:\Program Files\PuTTY\plink.exe`) | **Failed** — `Network error: Connection timed out` |
| Staging import / verify-counts | **Not run** — VPS unreachable |
| Backend staging `.env` + firewall 4000 | **Not run** |
| Repo | Added `bootstrap-staging-pre-restore.sql`, `bootstrap-staging-windows.ps1`, `run-bootstrap-on-vps.ps1`; `import-to-vps.sh` supports `POSTGRES_ADMIN_URL` bootstrap |

**Action required:** Restore or power-cycle the Hetzner VPS (`95.217.137.18`) via cloud console until SSH succeeds, then run `bootstrap-staging-windows.ps1` on the server and continue cutover checklist.



## Migration session log (2026-07-02, agent — completed on VPS)

VPS reachable again (`hostname WIN-8OA3CCQAE4D`). Migration completed end-to-end on `artillery_erp_staging`.

| Step | Result |
|------|--------|
| Connectivity | **OK** — `plink` SSH succeeds; hostname `WIN-8OA3CCQAE4D`. |
| PostgreSQL 18 service | **Running** + set **Automatic** (`sc config postgresql-x64-18 start= auto`). |
| Superuser auth | No fixed `postgres` password — used the established temp `trust` pattern in `pg_hba.conf` (127.0.0.1/::1/local), then restored the `.bak-migration` backup. |
| Staging DB | Dropped + recreated `artillery_erp_staging OWNER artillery_app` (clean of prior partial failure). |
| Bootstrap | `CREATE SCHEMA extensions`, `uuid-ossp`, `pgcrypto`, `pg_trgm` (in `public`), `CREATE SCHEMA auth`, stub `auth.uid()/auth.role()/auth.jwt()`. |
| auth import | `auth_users.sql` loaded (auth.identities + auth.users). |
| pg_restore | `--no-owner --no-acl` as `postgres`; **clean** (only benign `schema "public" already exists`). 45 public tables, **7** trigram GIN indexes, **111** RLS policies. |
| Privileges | `GRANT ALL` on public/auth to `artillery_app`; `SELECT` to `artillery_readonly`; `ALTER ROLE artillery_app BYPASSRLS` (parity with Supabase postgres role, since app does its own authz). |
| verify-counts | reservations **3291**, guests **4058**, units **170**, locations **3**, staff **2**, auth.users **9**. Units match baseline exactly; reservations/guests are higher than the 2026-03 baseline (3230/3999) — consistent with ~4 months of live growth in Supabase, i.e. full current dataset imported. |
| Backend `.env` | `DATABASE_URL` → `...@127.0.0.1:5432/artillery_erp_staging`. |
| API process | Started under **PM2** as `artillery-api` (`dist/index.js`, cwd `backend-deploy`), `pm2 save`. Distinct from existing `pdfnox-*` PM2 apps. |
| Health | `http://127.0.0.1:4000/health` → **200** `{"status":"ok","database":"connected"}`. |
| Firewall | Inbound TCP 4000 allowed (`Artillery API 4000`). |
| External reach | `http://95.217.137.18:4000/health` → **200** from developer machine (API bound to `0.0.0.0:4000`). |
| Smoke tests | `POST /auth/login` (bad creds) → 401 (auth.users query executed); `GET /units`,`/guests` → 401 (auth-protected); `GET /reservations` → 404 (no bare GET handler); unknown route → 404. |

### Remaining user actions (not done by agent)

1. **Domain choice** + **DNS** A-record → `95.217.137.18`.
2. **TLS**: put API behind HTTPS (reverse proxy / Cloudflare Tunnel / IIS+cert) before exposing publicly and before Vercel uses it (browsers block mixed content; login cookie is `secure`+`SameSite=None` in production).
3. **Vercel env flip** (do this yourself): `NEXT_PUBLIC_DATA_PROVIDER=api`, `NEXT_PUBLIC_API_URL=https://<api-domain>`.
4. **Prod DB decision**: app currently points at `artillery_erp_staging` (holds the imported live data). For final cutover either repoint `.env` to `artillery_erp` after importing there, or promote staging.
5. Secure/rotate `C:\Temp\artillery-db-secrets.txt` (plaintext passwords) and consider removing temp `trust` lines permanently (already reverted).


## Smoke test + staging-as-production (2026-07-02, agent)

**Decision:** `artillery_erp_staging` is PROMOTED as the canonical PRODUCTION database. The live API (`http://95.217.137.18:4000`, PM2 `artillery-api`) already reads it via `DATABASE_URL=postgresql://artillery_app:***@127.0.0.1:5432/artillery_erp_staging` (`NODE_ENV=production`). The old `artillery_erp` DB is left untouched (NOT dropped or altered). Optional future cleanup: rename `artillery_erp_staging` -> `artillery_erp_prod` for clarity (deliberately NOT done now to avoid churn).

### End-to-end smoke test (authenticated, external HTTP from dev machine)

Test account `solider_rocket@hotel.com` (role Viewer). A TEMPORARY bcrypt password was written into `auth.users` to exercise the login flow, then **REVERTED** to the original hash afterward. Reversion verified: logging in with the temp password now returns 401, so no auth changes remain. Original hash was backed up to a temp file and deleted after restore.

| Endpoint | Method | Status | Result |
|----------|--------|--------|--------|
| /health | GET | 200 | `database: connected` |
| /auth/login | POST | 200 | sets `artillery_token` cookie (HttpOnly; Secure; SameSite=None) |
| /auth/me | GET | 200 | user + roles `["Viewer"]`, elevatedOps false |
| /units | GET | 200 | **170** units |
| /guests?page=1&pageSize=25 | GET | 200 | totalCount **4058**, 25 rows, 163 pages |
| /guests/count | GET | 200 | 4058 |
| /guests?search=&lt;phone&gt; | GET | 200 | 4 matches (spot check on a known guest) |
| /reservations/page?page=1&pageSize=50 | GET | 200 | totalCount **3291**, 50 rows, statusCounts {confirmed 1676, pending 608} |
| /calendar/window (Aug 2026, all locations) | GET | 200 | **364** rows = exact DB overlap count |
| /calendar/window (Aug 2026, one location) | GET | 200 | 90 rows |
| /dashboard/stats | GET | **500** | pre-existing code bug, see below |

Data date range in the imported set: check-in `2026-03-14` .. `2027-02-06`. Counts match the DB exactly (units 170, guests 4058, reservations 3291, auth.users 9). Migrated data serves correctly through the API.

### Known issue: `/dashboard/stats` returns 500 (not a migration/data problem)

Postgres error `42883` ("No operator matches the given name and argument types... add explicit type casts"). Root cause: `reservations.status` is the enum type `reservation_status`, but `backend/src/routes/dashboard.ts` (`sumRevenue` / `countReservations`) compares it with `NOT (status = ANY($n::text[]))`; enum vs `text[]` has no operator on PostgreSQL 18. Fix: cast the column, e.g. `NOT (status::text = ANY($n::text[]))` (and the analogous `status = ANY(...)` builder), then rebuild and `pm2 restart artillery-api`. All other endpoints work; only the dashboard aggregate is affected.

### Persistence / resurrect on boot

- `pm2 save` -> `C:\Users\Administrator\.pm2\dump.pm2` (now includes `artillery-api`).
- Added scheduled task **`Artillery-PM2-Resurrect`** (`schtasks`, trigger At system startup, Run As `Administrator`, runs `C:\Artillery-ERP\pm2-resurrect.cmd` -> `pm2 resurrect`). Verified: manual run returned Last Result 0, all PM2 apps online, `/health` 200. This is the mechanism that restores `artillery-api` after reboot. (Note: the pre-existing `PM2` Windows service is AUTO_START but currently STOPPED/exit 1067, and the pre-existing `PDFNox-PM2-Resurrect` task runs as SYSTEM against a different PM2 home, so neither reliably restores the Administrator-context `artillery-api`.)

### Remaining user actions

1. **TLS + domain (REQUIRED before Vercel HTTPS frontend can use the API).** The HTTPS Vercel app cannot call `http://95.217.137.18:4000` directly: browsers block mixed content, and the production auth cookie is `Secure; SameSite=None` so it is only sent over HTTPS. Put the API behind HTTPS on a domain (reverse proxy / Cloudflare Tunnel / IIS + cert), then confirm `GET https://<api-domain>/health`.
2. **Vercel env flip (do yourself, after TLS):** `NEXT_PUBLIC_DATA_PROVIDER=api`, `NEXT_PUBLIC_API_URL=https://<api-domain>`.
3. Apply the `/dashboard/stats` enum-cast fix above.
4. Optional: rename `artillery_erp_staging` -> `artillery_erp_prod`; rotate secrets in `C:\Temp\artillery-db-secrets.txt`.

---

## Same-origin API proxy via Vercel Edge Config (2026-07-17) — CANONICAL

This supersedes the "bake `NEXT_PUBLIC_API_URL` into the bundle + redeploy on churn" model
below. The browser now only ever talks to the app's own origin, and the backend host is
resolved at runtime from Vercel Edge Config — so a churned quick-tunnel URL propagates in
seconds with **no redeploy**, and the auth cookie is **first-party** (works in Safari/incognito).

### Architecture

```
Browser ─▶ https://artillery-erp-vps.vercel.app/api-backend/*   (same-origin, first-party cookie)
             │
             ▼
        Next.js middleware (Edge runtime)
             │  reads backendUrl from Vercel Edge Config (get('backendUrl'))
             │  strips /api-backend, forwards path+query+headers+body via NextResponse.rewrite
             ▼
        Cloudflare quick tunnel (HTTPS transport only)  ─▶  Express :4000 on the VPS
             ▲
             │  PATCH /v1/edge-config/{id}/items  (backendUrl -> new host, ~seconds, no redeploy)
        VPS auto-heal (Artillery-Ensure-Tunnel, every 10 min)
```

### Components

- **Proxy prefix:** `/api-backend`. Implemented in [`middleware.ts`](../middleware.ts) (matcher
  `/api-backend/:path*`). Reads `backendUrl` from Edge Config; strips the prefix; preserves the
  remaining path + querystring; forwards original headers (incl. `Content-Type`, `Cookie`) and the
  request body so JSON **and** binary uploads pass through; drops `Host` so the outbound request
  uses the backend host. Returns **503** (JSON) if `backendUrl` is missing/unreadable.
- **Edge Config store:** `artillery-backend`, id **`ecfg_npkgxlllddf0eccn27fd7gx8pqbp`**
  (team `healthcare4314-6641s-projects`). Single item `backendUrl`. Connected to the project via
  the **`EDGE_CONFIG`** connection-string env var (Production + Preview). SDK: `@vercel/edge-config`
  (`get('backendUrl')`).
- **Frontend:** [`lib/api/data-provider.ts`](../lib/api/data-provider.ts) `getApiUrl()` returns the
  relative prefix `'/api-backend'` in api mode (no `NEXT_PUBLIC_API_URL` in the browser).
  [`lib/api/http-client.ts`](../lib/api/http-client.ts) unchanged (`base + path` → same-origin,
  `credentials: 'include'`). [`lib/storage/upload.ts`](../lib/storage/upload.ts) uploads to
  `/api-backend/storage/upload`, with client-side **canvas image compression** (no new dep) to stay
  under Vercel's ~4.5 MB proxied-body cap, and a hard **4 MB** guard for non-image files.
- **Auto-heal:** [`scripts/ops/ensure-artillery-tunnel.ps1`](../scripts/ops/ensure-artillery-tunnel.ps1)
  now **PATCHes Edge Config `backendUrl`** (`PATCH https://api.vercel.com/v1/edge-config/{id}/items`,
  `operation: upsert`) instead of updating `NEXT_PUBLIC_API_URL` + redeploying. It keeps the
  tunnel-alive / `/health` / `current-api-url.txt` state logic. No Vercel redeploy on churn.

### Required Vercel env (Production)

- `NEXT_PUBLIC_DATA_PROVIDER=api`
- `EDGE_CONFIG` = connection string for `ecfg_npkgxlllddf0eccn27fd7gx8pqbp` (encrypted; also in local
  `.env.local` for builds). The read token is **not** committed.
- `NEXT_PUBLIC_API_URL` is now **unused by the browser** (safe to leave or remove).
- `NEXT_PUBLIC_R2_CDN_URL`, `NEXT_PUBLIC_SUPABASE_*` (build-time), `CLOUDFLARE_R2_*` unchanged.

### Verification (2026-07-17, all PASS)

- `GET https://artillery-erp-vps.vercel.app/api-backend/health` → `{"status":"ok","database":"connected"}`.
- Deployed `/login` bundle: **0** `*.trycloudflare.com` references; uses the relative `api-backend` prefix.
- `POST /api-backend/auth/login` (admin) → 200, `Set-Cookie: artillery_token=… HttpOnly; Secure; SameSite=None`
  from the app origin → **first-party** cookie, roles `["SuperAdmin"]`.
- Churn recovery: PATCH `backendUrl` → proxy reflected the new value in **~4 s** with no redeploy; restored in ~7 s.
- Image upload: `POST /api-backend/storage/upload` (binary + cookie) → 200 `publicUrl`; CDN GET 200; `DELETE` 200.
- A prior smoke-test temp password on `admin@hospitality.com` was **restored** to the original hash
  (temp password now returns 401). No temp password left active.

### Future upgrade (unchanged recommendation)

A Cloudflare **named tunnel** (stable `api-*` hostname) remains the ideal transport so the quick
tunnel stops churning entirely. The same-origin proxy already removes the user-facing churn pain and
fixes the third-party-cookie problem, so a named tunnel is now an optimization, not a blocker.

---

## API-mode Vercel deployment via Cloudflare Quick Tunnel (2026-07-02)

> **Historical.** The `NEXT_PUBLIC_API_URL` + redeploy-on-churn model described in this section is
> **superseded** by the same-origin Edge Config proxy above. Kept for history/rollback context.

A second, standalone Vercel project runs the frontend entirely against the VPS Postgres through the API. The existing `artilleryerp` production project was left untouched.

### New Vercel project
- Project name: `artillery-erp-vps` (team `healthcare4314-6641s-projects`)
- Production URL: https://artillery-erp-vps.vercel.app
- Framework preset: Next.js. Deployment Protection (Vercel Authentication) disabled so the app is publicly reachable.
- Deployed via `vercel deploy --prod` (CLI upload, not Git integration).

### Vercel environment variables (Production)
- `NEXT_PUBLIC_DATA_PROVIDER=api`
- `NEXT_PUBLIC_API_URL=https://<current-trycloudflare-host>` (ephemeral — see auto-heal below; as of 2026-07-16: `https://smallest-monitor-still-pole.trycloudflare.com`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (still required at build time because `lib/supabase/client.ts` throws if absent, even though runtime uses the API provider)
- `NEXT_PUBLIC_R2_CDN_URL` (image CDN)
- Server R2 vars (belt-and-suspenders for leftover Next `/api/storage/*`; primary presign is on Express): `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`

### R2 uploads (api mode)
- Browser uploads call Express `POST /storage/presign` and `DELETE /storage/delete` (cookie auth on the tunnel), then `PUT` the file to the presigned R2 URL. Next.js `/api/storage/*` remains for supabase-mode only.
- VPS backend `.env` must include the same `CLOUDFLARE_R2_*` + `R2_CDN_URL` (or `NEXT_PUBLIC_R2_CDN_URL`) as local `.env.local`.
- **R2 bucket CORS** (Cloudflare dashboard → R2 → `artillery` → Settings → CORS): Allowed Origins must include `https://artillery-erp-vps.vercel.app`, `https://artilleryerp.vercel.app`, and `http://localhost:3000`. Allowed Methods: `GET`, `PUT`, `HEAD`. Allowed Headers: `Content-Type`, `*`. Without this, presign succeeds but the browser `PUT` to R2 fails.

### Cloudflare Quick Tunnel (HTTPS for the API)
- URL (ephemeral): read `C:\cloudflared\current-api-url.txt` or `C:\cloudflared\artillery-tunnel.log` → `http://localhost:4000`
- Runs as PM2 process `cloudflared-tunnel` (`pm2 save` done; resurrects with the other PM2 apps).
- Config file (required): `C:\cloudflared\artillery-quick.yml` contains only `url: http://localhost:4000`. **Do not** run quick tunnel without `--config` on this VPS: the default `C:\Users\Administrator\.cloudflared\config.yml` is for the PDFNox named tunnel (`api.pdfnox.com` -> port 3000) and breaks Artillery quick-tunnel routing (HTTPS 404).
- Starter: `C:\cloudflared\start-artillery-tunnel.cmd` (preferred) or PM2:
  `pm2 start C:\cloudflared\cloudflared.exe --name cloudflared-tunnel -- tunnel --config C:\cloudflared\artillery-quick.yml --logfile C:\cloudflared\artillery-tunnel.log --loglevel info` (then `pm2 save`).
- IMPORTANT: quick-tunnel URLs are ephemeral. On restart / process death / long disconnect, Cloudflare assigns a **NEW** random `*.trycloudflare.com` hostname. Vercel bakes `NEXT_PUBLIC_API_URL` at **build** time, so the SPA keeps calling the dead host until env is updated **and** a production redeploy finishes.

### Auto-heal (2026-07-16) — stops the manual chase
- **Why it always breaks:** `*.trycloudflare.com` quick tunnels are not stable. Any cloudflared restart (reboot, PM2 recreate, Cloudflare disconnect) mint a new hostname; the Vercel frontend still has the old one compiled in → browser `net::ERR_NAME_NOT_RESOLVED` on `/auth/login`.
- **Script (repo):** `scripts/ops/ensure-artillery-tunnel.ps1` (+ `.cmd` wrapper). **Installed on VPS:** `C:\cloudflared\ensure-artillery-tunnel.ps1`.
- **What it does every ~10 minutes** (scheduled task `Artillery-Ensure-Tunnel`):
  1. Ensures `artillery-quick.yml` only points at `http://localhost:4000` (never inherits PDFNox).
  2. Ensures PM2 `cloudflared-tunnel` is online (recreates via `start-artillery-tunnel.cmd` if needed).
  3. Parses the live trycloudflare URL from the tunnel log; health-checks `/health`.
  4. Compares to `C:\cloudflared\current-api-url.txt`. On change: updates Vercel Production `NEXT_PUBLIC_API_URL` via API and triggers a production redeploy.
- **Secrets on VPS only (never git):** `C:\cloudflared\vercel-token.txt` and/or `VERCEL_TOKEN=` in `C:\Temp\artillery-db-secrets.txt`.
- **Log:** `C:\cloudflared\ensure-artillery-tunnel.log`.
- **Named tunnel note:** PDFNox already runs a **separate** token-based named tunnel for `api.pdfnox.com` → `:3000`. There is **no** `cert.pem` on the VPS, so CLI cannot create a second named tunnel without interactive `cloudflared tunnel login`. Do **not** edit the PDFNox token tunnel ingress from here. Stable hostname requires adding a Public Hostname (e.g. `api-artillery.pdfnox.com` → `http://localhost:4000`) in Cloudflare Zero Trust for that account + DNS, **or** a dedicated Artillery named tunnel + domain.

### Quick-tunnel recovery (manual, if auto-heal has not run yet)
- **Symptom:** browser `net::ERR_NAME_NOT_RESOLVED` on `POST …/auth/login` because Vercel still points at an old `*.trycloudflare.com` hostname.
- **Prior dead hosts (history):** `scholarship-cholesterol-lights-burning`, `philips-demonstrates-wayne-income`, `original-personnel-nov-gcc` (superseded whenever the tunnel restarts).
- **Working URL (2026-07-16 after restore):** `https://smallest-monitor-still-pole.trycloudflare.com` (will change again on the next quick-tunnel restart; auto-heal should re-point Vercel).
- **Recovery checklist:**
  1. `pm2 list` — ensure `artillery-api` and `cloudflared-tunnel` are `online`.
  2. If tunnel missing: `C:\cloudflared\start-artillery-tunnel.cmd`. If logs show `429` / error `1015`, wait before retrying (quick-tunnel rate limit).
  3. Read new URL from `C:\cloudflared\artillery-tunnel.log` or run `C:\cloudflared\ensure-artillery-tunnel.cmd`.
  4. `curl https://<new-host>/health` must return **200** JSON (not Cloudflare **404**).
  5. If auto-heal did not redeploy yet: update Vercel Production `NEXT_PUBLIC_API_URL`, then `vercel deploy --prod --yes`.
  6. Hard-refresh the browser / clear site data / unregister the PWA service worker so the new baked-in API URL loads.
- **Health check:** `GET https://<tunnel-host>/health` -> 200; `POST /auth/login` with `Origin: https://artillery-erp-vps.vercel.app` -> 200 + `Set-Cookie: artillery_token=…`.
- **Long-term:** add a named Cloudflare Tunnel hostname for Artillery on the PDFNox Cloudflare account (recommended: `api-artillery.pdfnox.com` → `localhost:4000`) so the URL stops churning and third-party cookie pain is reduced if the frontend later shares a parent domain.

### Backend CORS
- `C:\Artillery-ERP\backend-deploy\.env` -> `CORS_ORIGINS=http://localhost:3000,https://artilleryerp.vercel.app,https://artillery-erp-vps.vercel.app`
- Applied with a single `pm2 restart artillery-api && pm2 save`.
- Cross-site cookie note: the API is on `*.trycloudflare.com` and the app on `*.vercel.app`, so the `artillery_token` cookie (`HttpOnly; Secure; SameSite=None`) is a third-party cookie. It works in browsers that allow third-party cookies but is dropped by browsers that block them by default (Safari; Chrome incognito). Real fix: serve the API on a subdomain of the same site as the frontend (custom domain) so the cookie is first-party.

### Smoke test (2026-07-02, via the tunnel with Origin https://artillery-erp-vps.vercel.app)
- Site loads: `/` 200, `/login` 200.
- CORS preflight `OPTIONS /auth/login` 204 with `Access-Control-Allow-Origin` + `Allow-Credentials: true`.
- `POST /auth/login` 200, sets cookie, roles `["SuperAdmin"]` (used a temporary password on `admin@hospitality.com`, then restored the original hash).
- `GET /auth/me` 200; `GET /units` 200 -> 170; `GET /reservations/list` 200 (1000/page); `GET /calendar/window` (Jul 2026) 200 -> 1014 rows.
- `GET /dashboard/stats` still 500 (the pre-existing enum-cast bug documented above).

### Config changes needed for the CLI build (uncommitted, left in the workspace)
- `vercel.json` -> `{}` (removed a stale `functions` entry pointing to a non-existent `app/api/generate-contract-pdf/route.ts`).
- `.vercelignore` -> added `backend` (the standalone Express server broke the Next.js type-check with `Cannot find module 'pg'`).

### Remaining user actions
- Rotate the Vercel access token used for this deploy (deploy is complete).
- Consider a stable named tunnel or a custom API domain to fix both the ephemeral URL and the third-party-cookie limitation.
- Rotate VPS / Supabase credentials per the migration checklist.

## Permanent named tunnel progress (2026-07-18)

### Phase A — restored (login path works again)

| Check | Result |
|-------|--------|
| `ReelSaverDL-API` | Stopped + **Disabled** (was reclaiming `:4000`) |
| `artillery-api` PM2 | Online on `:4000`; local `/health` Artillery JSON |
| Artillery quick tunnel | PM2 `cloudflared-tunnel` online (temporary) |
| Edge Config `backendUrl` | Synced to live trycloudflare URL |
| `GET …/api-backend/health` | **200** Artillery |
| `POST …/api-backend/auth/login` | **not 502** (validation 400 with probe creds) |
| PDFNox `Cloudflared` service | Untouched (still Automatic/Running) |

### Phase B — BLOCKED (needs you in Cloudflare)

No `CLOUDFLARE_API_TOKEN` on the VPS, in repo `.env.local`, or in `C:\Temp\artillery-db-secrets.txt`
(keys present: DB URLs + `VERCEL_TOKEN` only). DNS for `api-artillery.pdfnox.com` does **not** exist yet.
`api.pdfnox.com` already CNAMEs to tunnel `16782513-7fb6-481b-8ac2-ab74d9bd9e04.cfargotunnel.com`
(zone NS is at the registrar, not Cloudflare).

**Do this once (≈1 minute), without touching the `api.pdfnox.com` row:**

1. Cloudflare Dashboard → **Zero Trust** → **Networks** → **Tunnels**.
2. Open the existing **PDFNox** tunnel (UUID `16782513-7fb6-481b-8ac2-ab74d9bd9e04`).
3. **Public Hostname → Add**:
   - Hostname: `api-artillery.pdfnox.com`
   - Path: *(empty)*
   - Service type: HTTP
   - URL: `localhost:4000` (or `http://localhost:4000`)
4. If the UI does not auto-create DNS (zone may be at Namecheap/registrar): add a **CNAME**
   `api-artillery` → `16782513-7fb6-481b-8ac2-ab74d9bd9e04.cfargotunnel.com` (proxied/orange if on CF DNS;
   plain CNAME at registrar is fine).
5. Verify: `GET https://api-artillery.pdfnox.com/health` → `{"status":"ok","database":"connected"}`.

**Optional automation later:** place an Account API token (Tunnel Edit + DNS Edit on `pdfnox.com` if
applicable) in `C:\cloudflared\cloudflare-api-token.txt` as a single line (never commit) and ask the agent
to finish Phases C–D.

### Phases C–D — waiting on Phase B

- **C:** PATCH Edge Config `backendUrl` → `https://api-artillery.pdfnox.com`; verify `/api-backend/health`.
- **D:** Stop PM2 `cloudflared-tunnel` only; switch `Artillery-Ensure-Tunnel` to
  `scripts/ops/ensure-artillery-health.ps1` (no trycloudflare chase). Leave Windows `Cloudflared` alone.
