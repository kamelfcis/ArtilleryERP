# Artillery ERP — FINAL CUTOVER RUNBOOK (Supabase → VPS)

> Operator runbook for the **production cutover** of Artillery ERP from Supabase to the
> self-hosted VPS stack (Express API + PostgreSQL 18 + Cloudflare R2). Follow it
> **top-to-bottom** during the maintenance window. Every actionable step has a checkbox;
> every checkpoint has a **VERIFY:** line — do not proceed past a failing VERIFY.
>
> **Secrets policy:** This document uses `<PLACEHOLDERS>` and references secrets **by name
> and location only** (e.g. `C:\Temp\artillery-db-secrets.txt`, "the Vercel token").
> **Never paste real passwords, tokens, or connection strings with credentials into this file.**
>
> Related docs: [`MIGRATION_CUTOVER.md`](./MIGRATION_CUTOVER.md) (session logs & history),
> [`SUPABASE_REMOVAL_REPORT.md`](./SUPABASE_REMOVAL_REPORT.md) (api-mode endpoint coverage),
> [`../database-sync/README.md`](../database-sync/README.md) (delta-sync toolkit).

---

## 1. Overview & goal

**Goal:** make the VPS stack the single source of truth for Artillery ERP and cut the live
users over to the new frontend, with **no Supabase runtime dependency** in `api` mode, **zero
data loss**, and a clean rollback path.

### Target architecture (one screen)

```
                          Users (browser)
                                │  HTTPS
                                ▼
        Vercel  ──  Next.js frontend  (project: artillery-erp-vps)
                    NEXT_PUBLIC_DATA_PROVIDER = api
                    NEXT_PUBLIC_API_URL       = https://<STABLE_API_DOMAIN>
                                │  HTTPS (JWT cookie: artillery_token, HttpOnly/Secure/SameSite=None)
                                ▼
        Stable HTTPS edge  (Cloudflare named tunnel  OR  reverse proxy + TLS)
                                │  → http://localhost:4000
                                ▼
        VPS 95.217.137.18  ──  Express API  (PM2 process: artillery-api, port 4000)
                                │
                                ▼
        PostgreSQL 18  ──  database: artillery_erp_staging   (PROMOTED as production)
                           (old DB artillery_erp left untouched)

        File bytes (uploads / images):  Browser ⇄ Cloudflare R2  (presigned via /api/storage/*)

        Supabase:  NOT in the runtime or build graph in api mode.
                   Old site https://artilleryerp.vercel.app stays live as the rollback target.
```

Key facts this runbook is built on:

- **Frontend (NEW):** Vercel project `artillery-erp-vps` → https://artillery-erp-vps.vercel.app
  (team `healthcare4314-6641s-projects`), `NEXT_PUBLIC_DATA_PROVIDER=api`.
- **Frontend (OLD):** https://artilleryerp.vercel.app — **untouched**, still on Supabase; this is the rollback target.
- **API:** Express on `95.217.137.18:4000`, PM2 process `artillery-api`, deploy dir `C:\Artillery-ERP\backend-deploy`.
- **HTTPS edge:** PM2 process `cloudflared-tunnel` (currently an **ephemeral** Cloudflare quick tunnel — see §3).
- **DB:** PostgreSQL 18 service `postgresql-x64-18`, database `artillery_erp_staging` (production), `artillery_erp` untouched.
- **Delta-sync toolkit:** durable install at `C:\Artillery-ERP\database-sync` (via `git pull`; `npm install` done). An older copy exists at `C:\Temp\database-sync`.
- **Secrets file (VPS only):** `C:\Temp\artillery-db-secrets.txt` (holds `DATABASE_URL_STAGING=...`, `SOURCE_DATABASE_URL=...`, and `POSTGRES_SUPERUSER_PASSWORD=...` for the non-interactive apply). Secured pgpass: `C:\Temp\artillery-pgpass.conf`.
- **PM2 boot recovery:** scheduled task `Artillery-PM2-Resurrect` → `pm2 resurrect` at system startup.
- **Scheduled nightly reconcile (NEW):** Windows task **`Artillery-DeltaSync-Nightly`** runs the full reconcile (compare → backup → **purge VPS-only rows** → generate → apply → verify) once daily as SYSTEM at **VPS-local 06:00** (= **00:00 midnight UTC+3** while Pacific is on PDT; re-register with `-Times '05:00'` when Pacific is on PST). Logs `C:\Artillery-ERP\database-sync\logs\`, backups `...\backups\`. Supabase = source of truth; VPS-only rows are deleted each run. **DISABLE it before the final cutover freeze** (see §4). Setup/README: [`../database-sync/automation/README.md`](../database-sync/automation/README.md).
- **SSH tooling:** PuTTY `plink`/`pscp` under `C:\Program Files\PuTTY\`, user `Administrator@95.217.137.18`.

---

## 2. Pre-cutover checklist / GO–NO-GO

Do this **before** touching Supabase or the delta sync. All boxes must be ticked to proceed.

- [ ] **Maintenance window agreed** and stakeholders informed (start/end time, who does what, comms channel).
- [ ] **SSH to VPS works** (see §13 cheatsheet). `plink` returns a hostname without prompting.
- [ ] **API healthy:** `GET http://127.0.0.1:4000/health` (on VPS) and via the public edge return `{"status":"ok","database":"connected"}`.
- [ ] **PM2 online:** `artillery-api` and `cloudflared-tunnel` both `online` in `pm2 status`.
- [ ] **Resurrect task present:** scheduled task `Artillery-PM2-Resurrect` exists and last run result = 0.
- [ ] **HTTPS edge reachable:** `GET https://<CURRENT_API_URL>/health` returns 200 (find URL per §13).
- [ ] **Backups exist / can be taken:** confirm you can write to `C:\Temp\` and that `pg_dump.exe` runs (§5 step B).
- [ ] **R2 reachable:** `NEXT_PUBLIC_R2_CDN_URL` (image CDN) loads a known image; storage routes (`/api/storage/*`) respond.
- [ ] **Delta-sync toolkit ready:** `C:\Temp\database-sync` exists with `node_modules` (`npm install` done).
- [ ] **Supabase credentials on hand:** SOURCE session-pooler connection string (Dashboard → Database → Session pooler, port 5432).
- [ ] **Rollback understood:** old site https://artilleryerp.vercel.app confirmed working right now (open it, log in).
- [ ] **(Recommended) Stable API URL prepared** per §3 — strongly preferred before flipping live users.

**GO / NO-GO:** If any box above is unchecked, **STOP** and resolve it first. Do not open the window with a red item.

---

## 3. RECOMMENDED prerequisite — replace the ephemeral tunnel with a STABLE URL

> **Do this before cutting users over.** Skipping it means the app can break on any tunnel restart.

### Why this matters

- **Ephemeral URL churn:** the current `*.trycloudflare.com` quick-tunnel URL is **random and changes
  on every `cloudflared` restart / VPS reboot**. When it changes, the frontend's `NEXT_PUBLIC_API_URL`
  points at a dead host and the whole app fails until you manually update Vercel and redeploy.
- **Third-party-cookie breakage:** the auth cookie `artillery_token` is `HttpOnly; Secure; SameSite=None`.
  Because the API (`*.trycloudflare.com`) and the app (`*.vercel.app`) are **different sites**, that cookie
  is a **third-party cookie** — dropped by Safari and Chrome incognito, so login silently fails for those users.
- **The fix:** serve the API on a **stable domain**, ideally an **`api.` subdomain of the same domain as the
  frontend**, so the cookie becomes **first-party** and works everywhere.

### Options (pick one)

- **Option A — Named Cloudflare Tunnel + custom domain (recommended).** Requires a Cloudflare account and a
  domain. Create a named tunnel (`cloudflared tunnel create artillery`), map a DNS route
  (`cloudflared tunnel route dns artillery api.<yourdomain>`), and run it via a config file mapping
  `api.<yourdomain>` → `http://localhost:4000`. Gives a permanent HTTPS URL.
- **Option B — Reverse proxy + TLS on the VPS.** Point `api.<yourdomain>` DNS A-record → `95.217.137.18`,
  terminate TLS with IIS/Caddy/nginx-for-Windows or `certbot`, and proxy to `http://localhost:4000`.

### Places to update once you have the stable URL `https://api.<yourdomain>`

- [ ] **Vercel env (project `artillery-erp-vps`, Production):** set `NEXT_PUBLIC_API_URL=https://api.<yourdomain>`.
- [ ] **Backend CORS (VPS):** edit `C:\Artillery-ERP\backend-deploy\.env` →
      `CORS_ORIGINS=http://localhost:3000,https://artilleryerp.vercel.app,https://artillery-erp-vps.vercel.app,https://<your-frontend-domain>`
      (include every origin the browser will use; keep existing entries).
- [ ] **Restart API:** `pm2 restart artillery-api && pm2 save`.
- [ ] **Redeploy frontend:** trigger a Vercel production deploy of `artillery-erp-vps` so the new `NEXT_PUBLIC_API_URL` is baked in.

**VERIFY:** `GET https://api.<yourdomain>/health` → `{"status":"ok","database":"connected"}`, and a login on
the new site succeeds **in Safari and a Chrome incognito window** (proves the cookie is first-party).

> If you consciously choose to cut over on the ephemeral quick-tunnel URL anyway, accept that (a) Safari/incognito
> users may not be able to log in, and (b) any tunnel restart requires re-running §13 "read tunnel URL" +
> updating Vercel + redeploying. Document the current URL before starting.

---

## 4. Freeze writes on Supabase (old site) during the window

The final delta sync is only clean if Supabase stops changing while you copy the last rows over. Freezing
writes prevents further divergence between Supabase and the VPS.

- [ ] **Disable the scheduled nightly reconcile FIRST** so it can't run mid-cutover and race the manual final sync:
  `Disable-ScheduledTask -TaskName "Artillery-DeltaSync-Nightly"` (re-enable only if you abort the cutover).
  Confirm no run is in progress (no `C:\Artillery-ERP\database-sync\logs\run-reconcile.lock`).
- [ ] **Announce the freeze** to all users (comms channel): "Do not create/edit bookings on the old site during the window."
- [ ] **Enforce read-only (choose one):**
  - **Preferred:** put the OLD site https://artilleryerp.vercel.app into maintenance/read-only (e.g. a maintenance
    banner / disable write UI, or temporarily set the old project to a maintenance page).
  - **Minimum:** rely on the announced freeze and confirm no active users are still writing (check Supabase
    dashboard activity / recent `updated_at` timestamps going quiet).
- [ ] **Record the freeze time** (UTC) — you'll use it to sanity-check that no rows changed after it.

**VERIFY:** For ~5 minutes after the freeze, the max `updated_at`/`created_at` on `reservations`, `guests`,
`reservation_attachments` in Supabase stops advancing.

---

## 5. FINAL delta-sync (compare → backup → generate → apply → verify)

Run **from the VPS** (the toolkit reaches Supabase outbound and the VPS DB on localhost). SSH in, then work in
`C:\Temp\database-sync`. Full details: [`../database-sync/README.md`](../database-sync/README.md).

> **Reading the TARGET secret:** the VPS holds the real target password in
> `C:\Temp\artillery-db-secrets.txt` (line `DATABASE_URL_STAGING=...`). Read it on the VPS and export it into the
> session — never type it into this doc.

### Non-interactive command pattern (from your dev machine)

Everything below runs **in a PowerShell session on the VPS**. Get that session either by
`ssh Administrator@95.217.137.18` interactively, or run one-liners through PuTTY `plink` from your dev machine:

```powershell
& "C:\Program Files\PuTTY\plink.exe" -batch -ssh Administrator@95.217.137.18 -hostkey "<VPS_HOST_KEY_SHA256>" "<command>"
```

> For multi-line PowerShell over `plink`, the established pattern is to Base64-encode the script and run it with
> `powershell -EncodedCommand <BASE64>` so quoting/newlines survive the SSH transport. For a manual cutover it is
> simpler and safer to open an interactive SSH session and paste each block below.

### A. Compare (see the current gap)

```powershell
cd C:\Temp\database-sync

# SOURCE = Supabase session pooler (port 5432). Paste your real string; do not commit it.
$env:SOURCE_DATABASE_URL = "postgresql://postgres.rroxljxrlaaiwerygwlw:<SUPABASE_PW>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"

# TARGET = VPS staging DB — read the password from the secrets file, then set it.
type C:\Temp\artillery-db-secrets.txt      # shows DATABASE_URL_STAGING=postgresql://artillery_app:<pw>@127.0.0.1:5432/artillery_erp_staging
$env:TARGET_DATABASE_URL = "postgresql://artillery_app:<pw>@127.0.0.1:5432/artillery_erp_staging"

npm run compare
```

**How to read it:** the command prints a `Table | Rows Supabase | Rows VPS | Difference` table and writes
`reports/compare_report.md` (+ `.json`).

- `Difference = 0` on a table means counts line up.
- **Important:** VPS may legitimately have **more** rows than Supabase (VPS-only live bookings created after the
  original import). A matching total does **not** by itself prove every Supabase row is present — that's what
  `verify` (step E) checks by primary key.

**VERIFY:** `reports/compare_report.md` generated; note any tables with a non-zero `Difference` and the
`reservations` / `reservation_attachments` rows for later.

### B. Back up the TARGET first (mandatory safety)

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -Fc `
  -d "$env:TARGET_DATABASE_URL" `
  -f "C:\Temp\pre-deltasync-backup_$(Get-Date -Format yyyyMMdd-HHmmss).dump"
```

**VERIFY:** a new `C:\Temp\pre-deltasync-backup_*.dump` exists and is non-empty (`dir C:\Temp\pre-deltasync-backup_*.dump`).

### C. Generate the delta SQL

```powershell
$env:INSERT_BATCH = "1"    # one statement per row → resilient apply can skip a single conflicting row
npm run generate           # writes delta_sync.sql (wrapped in BEGIN … COMMIT)
```

**VERIFY:** `delta_sync.sql` is written; the generator prints how many INSERT/UPDATE statements it emitted.

### D. Apply transactionally (as a superuser — resilient mode)

The delta issues `ALTER TABLE … DISABLE TRIGGER USER`, which needs table ownership/superuser. Tables are owned by
`postgres` (no stored password), so grant a **temporary, narrowly-scoped local trust** rule, apply as `postgres`,
then **always restore** `pg_hba.conf` (the `finally` block guarantees restoration even on error):

```powershell
$data = "C:\Program Files\PostgreSQL\18\data"
$hba  = Join-Path $data "pg_hba.conf"
Copy-Item $hba "$hba.bak" -Force
try {
  "host    artillery_erp_staging    postgres    127.0.0.1/32    trust`r`n" + (Get-Content $hba -Raw) | Set-Content $hba -Encoding ascii
  & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" reload -D $data
  $env:PGCLIENTENCODING = "UTF8"
  # Resilient: commit everything appliable; per-row savepoint skips rows that
  # collide with VPS-only live data (reported by verify). Use -v ON_ERROR_STOP=1
  # instead for strict all-or-nothing if you expect ZERO conflicts.
  & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -v ON_ERROR_ROLLBACK=on -U postgres -h 127.0.0.1 -d artillery_erp_staging -f delta_sync.sql
} finally {
  Copy-Item "$hba.bak" $hba -Force
  & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" reload -D $data
  Remove-Item "$hba.bak" -Force
}
```

**VERIFY:** `psql` completes; note any per-statement skips it reports. Confirm the temporary trust line is gone
(`type $hba` — no `trust` line for `artillery_erp_staging`).

### E. Verify

```powershell
npm run verify
```

Prints **PASS/FAILED per table + overall** and writes `reports/verify_report.json`. A table passes when **no
Supabase primary key is missing from the VPS** (a higher VPS count is fine — those are preserved live rows).

**VERIFY:** overall result is **PASS** for all tables **except** the known conflicting `reservations` rows
(as of the 2026-07-02 delta-sync: **44/45 tables PASS**, only `public.reservations` diverges on **3** booking
conflicts — `reservation_attachments` is now fully synced). Any *other* FAILED table means a Supabase row didn't
make it — investigate before proceeding. Then go to §6 to resolve the known conflicts.

---

## 6. Resolve the 3 known reservation conflicts

### Known reservation conflicts to resolve (as of 2026-07-02 delta-sync)

> **Current true state after the latest delta-sync:** `verify` = **44/45 tables PASS**. Only
> `public.reservations` diverges: **3 genuine booking conflicts** on the unique constraint
> `reservations_unit_date_range (unit_id, check_in_date, check_out_date)`. All 3 were **safely SKIPPED**
> — **no live rows were deleted or overwritten**. `reservation_attachments` is now **fully synced** (no
> attachment conflict remains). These 3 are **deferred by decision until final cutover.**
>
> **RULE: never blind-delete.** You already took a backup in §5.B. Make a per-decision human choice; do not
> script a mass delete.

There are two distinct situations across the 3 conflicting reservations: one **double-booking** (Conflict A)
and one **unit-swap deadlock** (Conflicts B & C, which must be resolved together).

| # | Type | Reservation (id / number) | Supabase unit | VPS unit | Dates | Status | Notes |
|---|------|---------------------------|---------------|----------|-------|--------|-------|
| A | Double-booking (Supabase row cannot insert) | `92873a2e-fcc1-47f2-afff-9b9e3ffddc32` / `RES-20260702-006085` | `baffff05-fb21-4354-bc13-1d923bc91090` | — (missing on VPS) | 2026-07-02 → 2026-07-03 | pending | Blocked by the VPS-only row below holding the same unit+dates |
| A | Double-booking (VPS-only row holding the slot) | `5d137ba9-2bca-4258-90d4-08cfd5398f88` / `RES-20260701-006047` | — (VPS-only) | `baffff05-fb21-4354-bc13-1d923bc91090` | 2026-07-02 → 2026-07-03 | pending | Live VPS booking occupying the slot the Supabase row wants |
| B | Unit-swap deadlock (blocked UPDATE) | `6bdc2dad-8422-430e-b69f-77936d93b306` / `RES-20260614-004820` | `b649618b-5248-426b-babd-ec2c53de5036` | `2660d8dc-dea8-4d7c-bc4e-877a7cb8cb21` | 2026-07-03 → 2026-07-05 | — | Swapped units with Conflict C; each UPDATE blocked by the other |
| C | Unit-swap deadlock (blocked UPDATE) | `b3730d64-3646-46d2-943b-e7b214c79f3a` / `RES-20260628-005794` | `2660d8dc-dea8-4d7c-bc4e-877a7cb8cb21` | `b649618b-5248-426b-babd-ec2c53de5036` | 2026-07-03 → 2026-07-05 | — | Swapped units with Conflict B; each UPDATE blocked by the other |

#### Conflict A — double-booking (1 Supabase row cannot insert)

- **Supabase row (missing on VPS):** id `92873a2e-fcc1-47f2-afff-9b9e3ffddc32`, `RES-20260702-006085`, unit
  `baffff05-fb21-4354-bc13-1d923bc91090`, dates 2026-07-02 → 2026-07-03, status `pending`.
- **VPS-only row holding that slot:** id `5d137ba9-2bca-4258-90d4-08cfd5398f88`, `RES-20260701-006047`, same
  unit + dates, status `pending`.
- **Resolution (BUSINESS DECISION needed):** decide which reservation keeps unit `baffff05` on 2026-07-02.
  Then either move/cancel the losing one **or** reassign it to a verified-free unit, then re-run the sync.

- [ ] **Conflict A decided:** winner = **VPS row (`RES-20260701-006047`)** / **Supabase row (`RES-20260702-006085`)** (choose one), reason: `<...>`
- [ ] Loser moved to a free unit **or** cancelled (owner-approved)
- [ ] Sync re-run and Conflict A no longer reported by `verify`

#### Conflicts B & C — unit-swap deadlock (2 blocked updates)

In Supabase these two reservations **swapped units**; the VPS still holds the mirrored (pre-swap) assignment, so
**neither UPDATE applies alone** — each is blocked by the other on the `reservations_unit_date_range` constraint.

- **Reservation B** `6bdc2dad-8422-430e-b69f-77936d93b306` (`RES-20260614-004820`): Supabase unit
  `b649618b-5248-426b-babd-ec2c53de5036`, VPS unit `2660d8dc-dea8-4d7c-bc4e-877a7cb8cb21`, dates 2026-07-03 → 2026-07-05.
- **Reservation C** `b3730d64-3646-46d2-943b-e7b214c79f3a` (`RES-20260628-005794`): Supabase unit
  `2660d8dc-dea8-4d7c-bc4e-877a7cb8cb21`, VPS unit `b649618b-5248-426b-babd-ec2c53de5036`, dates 2026-07-03 → 2026-07-05.
- **Resolution (deterministic, no data loss):** apply **BOTH** unit updates in a **single transaction** (or move
  one reservation to a scratch unit/date first, then set both to their final units). No business decision is
  required — the target state is already known from Supabase.

- [ ] **Conflicts B & C applied together** in one transaction (both units set to their Supabase values)
- [ ] `verify` re-run and neither B nor C is reported as diverging

#### Inspection queries (run these first, for the operator)

Confirm the three conflicting reservations' current state (run against whichever side you're inspecting; the
`updated_at` column helps confirm recency):

```sql
SELECT id, reservation_number, unit_id, check_in_date, check_out_date, status, updated_at
FROM public.reservations
WHERE id IN ('92873a2e-fcc1-47f2-afff-9b9e3ffddc32',
             '6bdc2dad-8422-430e-b69f-77936d93b306',
             'b3730d64-3646-46d2-943b-e7b214c79f3a');
```

See what currently occupies each contested unit + date slot:

```sql
SELECT id, reservation_number, unit_id, check_in_date, check_out_date, status
FROM public.reservations
WHERE (unit_id, check_in_date, check_out_date) IN (
  ('baffff05-fb21-4354-bc13-1d923bc91090','2026-07-02','2026-07-03'),
  ('b649618b-5248-426b-babd-ec2c53de5036','2026-07-03','2026-07-05'),
  ('2660d8dc-dea8-4d7c-bc4e-877a7cb8cb21','2026-07-03','2026-07-05'));
```

> **Re-running the final sync:** the delta-sync toolkit now auto-loads `SOURCE_DATABASE_URL` from the VPS secrets
> file, so the final sync re-runs **without re-entering the Supabase password**. Use the re-run commands already in
> this runbook (§5, and the "Re-run the delta sync (catch-up)" cheatsheet in §13).

---

### Generic conflict-resolution procedure (reference)

> The steps below are the general, PK-agnostic procedure the concrete conflicts above are an instance of. Use them
> if new conflicts appear on a later sync, or as the mechanical detail behind the resolutions above.

### What they are

These are **double-bookings**: a Supabase reservation and a **VPS-only live** reservation both claim the **same
unit for overlapping dates**. The VPS enforces the `reservations_unit_date_range` **exclusion/unique constraint**,
so the Supabase row is **refused** on insert (that's why it stays "missing"). A child `reservation_attachment` of
a blocked reservation can likewise only insert once its parent exists.

> **RULE: never blind-delete.** You already took a backup in §5.B. Make a per-decision human choice; do not script
> a mass delete.

### Step 1 — Identify the exact conflicting rows

On the VPS, list what `verify` reported as missing, then inspect both sides. Example queries (adjust to the PKs
`verify` printed):

Find the Supabase reservations missing from the VPS (run against **SOURCE** = Supabase):

```sql
-- Supabase (SOURCE): the candidate rows that failed to sync
SELECT id, unit_id, guest_id, check_in, check_out, status, created_at, updated_at
FROM reservations
WHERE id IN ('<SUPA_RES_ID_1>', '<SUPA_RES_ID_2>');
```

Find the VPS-only rows that block them (run against **TARGET** = `artillery_erp_staging`), matching on unit + date overlap:

```sql
-- VPS (TARGET): the live rows occupying the same unit + overlapping dates
SELECT id, unit_id, guest_id, check_in, check_out, status, created_at, updated_at
FROM reservations
WHERE unit_id IN ('<UNIT_ID_1>', '<UNIT_ID_2>')
  AND daterange(check_in, check_out, '[)') && daterange('<SUPA_CHECKIN>'::date, '<SUPA_CHECKOUT>'::date, '[)')
ORDER BY unit_id, check_in;
```

The blocked attachment (run against **SOURCE**):

```sql
-- Supabase (SOURCE): the attachment whose parent reservation is one of the blocked ones
SELECT id, reservation_id, file_name, file_url, created_at
FROM reservation_attachments
WHERE id = '<SUPA_ATTACHMENT_ID>';
```

### Step 2 — Decide a winner per unit+date (human decision)

For each conflicting unit+date pair, decide which booking is the real one (check guest, source, payment status,
recency, and with the business owner if unclear):

- [ ] **Conflict 1** — unit `<UNIT_ID_1>`, dates `<...>`: winner = **VPS row** / **Supabase row** (circle one), reason: `<...>`
- [ ] **Conflict 2** — unit `<UNIT_ID_2>`, dates `<...>`: winner = **VPS row** / **Supabase row** (circle one), reason: `<...>`

### Step 3 — Apply the decision (manual, backed up)

- **If the VPS row wins:** do nothing to the data — the Supabase row is intentionally not migrated. Record the
  decision so the old Supabase booking can be cancelled/refunded/communicated as needed. The attachment (if its
  parent is the losing Supabase reservation) is also intentionally dropped, or re-attach it to the winning row if
  it's still relevant.
- **If the Supabase row wins:** first **move or cancel the conflicting VPS row** (e.g. reassign it to a free unit,
  or set its status to cancelled after confirming with the owner), which releases the constraint, **then** insert
  the Supabase row. Example (run inside a transaction against **TARGET**, after re-taking a fresh backup):

```sql
BEGIN;
-- 1) Free the constraint: relocate or cancel the VPS-only conflicting booking (owner-approved).
UPDATE reservations SET status = 'cancelled', updated_at = now()
WHERE id = '<VPS_CONFLICTING_RES_ID>';      -- or reassign unit_id to a verified-free unit

-- 2) Now insert the Supabase winner. Easiest: re-run `npm run generate` + resilient apply so the
--    previously-blocked row goes in cleanly; OR insert it explicitly with the columns from Step 1.

-- 3) Re-insert its attachment child if applicable.
COMMIT;   -- ROLLBACK immediately if anything looks wrong
```

**VERIFY:** re-run `npm run verify` (§5.E). The 3 previously-conflicting items are now either resolved (0 missing)
or explicitly documented as "VPS row wins — Supabase row intentionally not migrated." No *unexplained* missing rows remain.

---

## 7. Verify data integrity + app smoke test

### Data counts

- [ ] Re-run `npm run verify` — overall PASS (modulo the documented conflict decisions).
- [ ] Spot-check counts match Supabase for the key tables:

```powershell
# On the VPS, against artillery_erp_staging (uses the temp trust or app role)
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -d artillery_erp_staging -f C:\Artillery-ERP\scripts\migration\verify-counts.sql
```

> The `verify-counts.sql` header baseline (reservations 3230 / guests 3999 / units 170, from 2026-03) is
> **stale** — expect higher live numbers now (units should still be **170**; reservations/guests grow with
> bookings). Compare the VPS numbers against the **current Supabase** counts, not the baseline comment.

**VERIFY:** `units` matches Supabase exactly; `reservations` and `guests` match Supabase (or are higher only by
the count of documented VPS-only rows).

### App smoke test (on the NEW site, api mode)

Do these against https://artillery-erp-vps.vercel.app (or your stable frontend domain):

- [ ] **Login** with a real admin account → dashboard loads (no error toast/crash).
- [ ] **Dashboard** stats render (the `/dashboard/stats` enum-cast fix must be deployed — see Inconsistencies note).
- [ ] **Calendar** lanes show reservations for the current month across locations.
- [ ] **Reservations** paginated list loads; total count matches DB.
- [ ] **Guests** search returns matches; count matches DB.
- [ ] **Units** list shows 170 units.
- [ ] **Write action:** create or edit a reservation (or add a service) → saves and reappears after refresh.
- [ ] **Attachments:** upload a file to a reservation → lands in Cloudflare R2 and is viewable (metadata via `/attachments`, bytes via R2).
- [ ] **Notifications:** pending-booking banner appears within ~15s (api mode uses 15s polling, not realtime — this is by design).

**VERIFY:** all boxes green. Any failure here is a NO-GO for finalizing — investigate or roll back (§10).

---

## 8. Confirm production configuration

- [ ] **Vercel (`artillery-erp-vps`, Production):** `NEXT_PUBLIC_DATA_PROVIDER=api`,
      `NEXT_PUBLIC_API_URL=https://<STABLE_API_DOMAIN>`, `NEXT_PUBLIC_R2_CDN_URL` set.
      (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` may remain — they're inert in api mode but are
      read at build time by `lib/supabase/client.ts`.)
- [ ] **Backend `.env` (VPS `C:\Artillery-ERP\backend-deploy\.env`):** `DATABASE_URL` → `artillery_erp_staging`,
      `NODE_ENV=production`, `PORT=4000`, `JWT_SECRET` set (strong), `COOKIE_NAME=artillery_token`,
      `CORS_ORIGINS` includes the frontend domain(s).
- [ ] **PM2:** `artillery-api` and `cloudflared-tunnel` both `online`; `pm2 save` has been run.
- [ ] **Resurrect task:** `Artillery-PM2-Resurrect` present (survives reboot).
- [ ] **HTTPS edge:** stable tunnel/proxy up; `GET https://<STABLE_API_DOMAIN>/health` = 200.
- [ ] **R2 CDN:** an image URL under `NEXT_PUBLIC_R2_CDN_URL` loads.

**VERIFY:** `pm2 status` shows both processes online; `/health` 200 through the public domain; a fresh login on
the new site succeeds.

> Note: the backend defaults to port **4001** in code (`backend/src/config.ts`) if `PORT` is unset — production
> **must** set `PORT=4000` in `.env` so it matches the tunnel target `http://localhost:4000`. Confirm it.

---

## 9. Post-cutover monitoring (first 24–48h)

Watch these; check at +1h, +6h, +24h, +48h.

- [ ] **API logs:** `pm2 logs artillery-api --lines 200` — watch for 500s, unhandled rejections, DB connection errors.
- [ ] **Tunnel logs:** `C:\cloudflared\artillery-tunnel.log` — watch for reconnects / URL changes (quick tunnel) or edge errors.
- [ ] **PM2 health:** `pm2 status` — no restart loops (rising `↺` restart count); memory not climbing toward OOM
      (this box has ~4 GB RAM).
- [ ] **DB connections:** on the VPS,
      `psql -h 127.0.0.1 -d artillery_erp_staging -c "SELECT count(*) FROM pg_stat_activity WHERE datname='artillery_erp_staging';"`
      — connections should be modest and stable, not growing unbounded.
- [ ] **Frontend:** periodically log in and load dashboard/calendar; watch Vercel deployment/runtime logs for the project.
- [ ] **User reports:** keep the comms channel open for login/booking issues (especially Safari/incognito if you
      cut over on the ephemeral tunnel).

**VERIFY:** after 48h with no critical issues, declare the cutover stable and proceed toward decommission (§11) —
but keep Supabase alive through the retention window.

---

## 10. ROLLBACK plan

Trigger rollback if you hit a **critical** issue (widespread login failure, data corruption, API/tunnel down with
no quick fix). Rollback is fast because the old stack is untouched.

- [ ] **Point users back to the OLD site:** https://artilleryerp.vercel.app (still on Supabase, fully working).
      Communicate the switch-back in the comms channel.
- [ ] **(If you had redirected DNS/links to the new site)** revert those to the old site.
- [ ] **Do NOT delete VPS data** — the `artillery_erp_staging` DB and the `C:\Temp\pre-deltasync-backup_*.dump`
      backups are preserved for debugging.
- [ ] **If a bad delta caused it:** restore the pre-sync backup on the VPS:
      `pg_restore --clean --if-exists -d "$env:TARGET_DATABASE_URL" "C:\Temp\pre-deltasync-backup_<STAMP>.dump"`
      (as superuser; take a fresh backup first).
- [ ] **Keep the Supabase project fully alive** (do NOT pause/delete) through the entire retention window so
      rollback stays possible.

**VERIFY:** users can log in and work on https://artilleryerp.vercel.app; no data was destroyed on the VPS.

**Note on divergence:** if users write on the OLD Supabase site after rollback, Supabase becomes ahead again — a
future re-cutover just re-runs §5 (compare → backup → generate → apply → verify) to catch the VPS back up.

---

## 11. Decommission Supabase (after retention window)

Only after the new stack has been **stable for the agreed retention window (e.g. 2 weeks)** and rollback is no
longer needed.

- [ ] **Confirm stability sign-off** from stakeholders.
- [ ] **Stop Supabase writes permanently:** keep the OLD site in read-only / take it down for writes so no new
      divergence can occur.
- [ ] **Export a final Supabase archive backup** (for cold storage / audit):
      `pg_dump -Fc -d "$SOURCE_DATABASE_URL" -f "C:\Temp\supabase-final-archive_$(Get-Date -Format yyyyMMdd).dump"`
      and copy it somewhere durable (off the VPS).
- [ ] **(Optional) Remove Supabase env from the new project:** delete `NEXT_PUBLIC_SUPABASE_URL` /
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` from the `artillery-erp-vps` Vercel project.
      They're already inert in api mode; only needed if you also want to remove the build-time dependency
      (verify `npm run build` still passes with them unset before relying on this).
- [ ] **Pause, then delete the Supabase project** once the archive is safely stored and the retention window has passed.
- [ ] **Retire the old Vercel project** https://artilleryerp.vercel.app (or leave it showing a maintenance page).

**VERIFY:** final archive dump exists and restores in a test; new stack fully operational without Supabase.

---

## 12. Security hardening / credential rotation

Reference secrets **by location**; rotate values out-of-band. Do this once the cutover is stable.

- [ ] **Rotate the Vercel access token** used for the CLI deploys (deploys are complete; the token used should be revoked/rotated).
- [ ] **Rotate the VPS `Administrator` password.**
- [ ] **Rotate the Supabase DB password** (after final archive; irrelevant once the project is deleted).
- [ ] **Rotate the DB app-user password** (`artillery_app`): change it in Postgres, update `DATABASE_URL` in
      `C:\Artillery-ERP\backend-deploy\.env` and `DATABASE_URL_STAGING` in `C:\Temp\artillery-db-secrets.txt`,
      then `pm2 restart artillery-api && pm2 save`.
- [ ] **Secure/relocate `C:\Temp\artillery-db-secrets.txt`:** it's plaintext under `C:\Temp`. Move it to a
      restricted-ACL location (Administrators-only) or a secrets manager; remove world/other read access.
- [ ] **Tighten `pg_hba.conf`:** confirm no leftover temporary `trust` lines from §5.D; restrict to
      `127.0.0.1`/localhost with `scram-sha-256`; no external Postgres exposure.
- [ ] **Nightly `pg_dump` backups on the VPS:** schedule a task (e.g. `schtasks`) that runs
      `pg_dump -Fc -d "<DATABASE_URL_STAGING>" -f "C:\Backups\artillery_erp_staging_$(Get-Date -Format yyyyMMdd).dump"`
      nightly, with rotation/retention and off-box copy.
- [ ] **Prefer SSH keys over password auth** for `Administrator@95.217.137.18`; add public keys, then disable
      password auth if policy allows.

**VERIFY:** app still healthy after each rotation (`/health` 200, login works); secrets file no longer
world-readable; a nightly backup file appears the next morning.

---

## 13. Appendix — quick-reference cheatsheet

### SSH / file copy to the VPS

```powershell
# Interactive shell
ssh Administrator@95.217.137.18

# Non-interactive single command (PuTTY)
& "C:\Program Files\PuTTY\plink.exe" -batch -ssh Administrator@95.217.137.18 -hostkey "<VPS_HOST_KEY_SHA256>" "hostname"

# Copy a file up / down (PuTTY)
& "C:\Program Files\PuTTY\pscp.exe" -batch local.file Administrator@95.217.137.18:C:/Temp/
& "C:\Program Files\PuTTY\pscp.exe" -batch Administrator@95.217.137.18:C:/Temp/remote.file .
```

### PM2

```powershell
pm2 status                      # list processes (artillery-api, cloudflared-tunnel, ...)
pm2 logs artillery-api --lines 200
pm2 restart artillery-api && pm2 save
pm2 restart cloudflared-tunnel  # NOTE: quick tunnel gets a NEW random URL on restart
pm2 resurrect                   # what the Artillery-PM2-Resurrect task runs at boot
```

### Read the current (quick) tunnel URL

```powershell
# The assigned URL is logged when the tunnel starts:
Select-String -Path C:\cloudflared\artillery-tunnel.log -Pattern "Your quick Tunnel has been created" -Context 0,2
# then update Vercel NEXT_PUBLIC_API_URL to that URL and redeploy (quick-tunnel only).
```

### API health

```powershell
# On the VPS
Invoke-WebRequest http://127.0.0.1:4000/health | Select-Object -Expand Content
# Public edge
Invoke-WebRequest https://<STABLE_API_DOMAIN>/health | Select-Object -Expand Content
```

### Re-run the delta sync (catch-up)

```powershell
cd C:\Temp\database-sync
$env:SOURCE_DATABASE_URL = "postgresql://postgres.rroxljxrlaaiwerygwlw:<SUPABASE_PW>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
$env:TARGET_DATABASE_URL = "postgresql://artillery_app:<pw>@127.0.0.1:5432/artillery_erp_staging"
npm run compare
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -Fc -d "$env:TARGET_DATABASE_URL" -f "C:\Temp\pre-deltasync-backup_$(Get-Date -Format yyyyMMdd-HHmmss).dump"
$env:INSERT_BATCH = "1"; npm run generate
# apply as postgres via the pg_hba trust dance in §5.D, then:
npm run verify
```

### Take a manual DB backup

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -Fc -d "$env:TARGET_DATABASE_URL" -f "C:\Temp\manual-backup_$(Get-Date -Format yyyyMMdd-HHmmss).dump"
```

### Rollback one-liner (summary)

> **Point users to https://artilleryerp.vercel.app** (old Supabase site, untouched & live). VPS data + the
> `C:\Temp\pre-deltasync-backup_*.dump` files are preserved. Keep the Supabase project alive until the retention
> window closes.

---

### Known API surface (for smoke-testing reference)

Express routes mounted in `backend/src/index.ts`: `/health`, `/auth`, `/locations`, `/units`, `/guests`,
`/reservations`, `/calendar`, `/dashboard`, `/staff`, `/notifications`, `/audit-logs`, `/pricing`, `/facilities`,
`/discounts`, `/loyalty`, `/services`, `/payments`, `/room-blocks`, `/admin`, `/inventory`, `/reports`,
`/activity`, `/attachments`. Auth cookie: `artillery_token` (`HttpOnly; Secure; SameSite=None` in production).
