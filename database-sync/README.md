# Artillery ERP — Database Delta Sync Toolkit

Re-runnable **delta synchronization + verification** for making the VPS
PostgreSQL database an exact copy of Supabase, **without ever losing data**.

- **SOURCE (source of truth):** Supabase PostgreSQL (`public` schema).
- **TARGET (kept in sync):** VPS PostgreSQL 18, database `artillery_erp_staging`
  (the DB the live site writes to).

The toolkit only ever **INSERTs missing rows** and **UPDATEs changed rows**. It
**never** issues `DELETE`, `TRUNCATE`, `DROP`, or `ALTER`. All connection
strings are read from **environment variables** — no credentials are hardcoded
or committed.

## Files

| File | Purpose |
|------|---------|
| `common.ts` | Shared helpers: pooled connections (TLS auto-enabled for Supabase), schema introspection (columns, PK, uniques, indexes, FKs, serial sequences, row counts), raw-text value serialization with explicit `::type` casts, and FK topological sort. |
| `compare_databases.ts` | **Step 1 & 2.** Introspects both DBs and prints a schema comparison + a row-count comparison (`Table | Rows Supabase | Rows VPS | Difference`). Writes `reports/compare_report.md` and `.json`. |
| `generateDelta.ts` | **Steps 3–7.** Detects missing rows (by composite PK, else uuid `id`, else int `id`) and changed rows (via `updated_at`, else full-column compare). Writes `delta_sync.sql`: `INSERT … ON CONFLICT (pk) DO NOTHING` for missing rows + `UPDATE … WHERE pk … (with an `updated_at` guard so newer target rows are never clobbered)` for changed rows, ordered FK-safe (topological sort), plus `setval()` sequence repair. Reads stream via server-side cursors (100k+ rows OK). |
| `verifySync.ts` | **Step 8.** Re-counts both DBs, checks no source PKs remain missing in the target, prints PASS/FAILED per table + overall (non-zero exit on failure). Writes `reports/verify_report.json`. |
| `delta_sync.sql` | **Generated** by `generateDelta.ts`; wrapped in `BEGIN; … COMMIT;`. Apply transactionally — any error rolls the whole thing back. |
| `package.json` / `tsconfig.json` | Isolated to this folder (root deps untouched). |

## How it handles the tricky bits

- **Primary keys:** composite PK if present, else a `uuid` column named `id`,
  else an integer `id`. Tables with none are skipped and reported.
- **Change detection:** `updated_at` when the column exists (only overwrites
  when `target.updated_at <= source.updated_at`, so live target edits that are
  newer are preserved); otherwise a full-column raw-value compare.
- **Session normalization:** both connections `SET TIME ZONE 'UTC'` + fixed
  datestyle/float/bytea/interval styles, so identical rows on PG17 (Supabase)
  and PG18 (VPS) produce identical text and are NOT falsely flagged as changed.
- **FK-safe ordering:** foreign keys are read from the catalog and tables are
  topologically sorted so parents are inserted before children. `SET CONSTRAINTS
  ALL DEFERRED` is emitted for any deferrable constraints.
- **Live-target triggers:** the target carries business-logic triggers (e.g.
  no-double-booking), audit triggers and `updated_at` triggers. The generated
  SQL wraps the load in `ALTER TABLE … DISABLE/ENABLE TRIGGER USER` for the
  touched tables (net-zero, auto-reverts on ROLLBACK) so the sync is faithful
  and side-effect-free. **FK and CHECK constraints stay fully enforced.**
  Because this ALTER requires table ownership/superuser, apply as a superuser
  (see below).
- **Conflict safety on a LIVE target:** INSERTs use bare `ON CONFLICT DO
  NOTHING`, so a row that collides with target-only data on the PK *or any*
  unique/exclusion constraint is skipped, never clobbered. Applying with
  `-v ON_ERROR_ROLLBACK=on` additionally skips (per-statement savepoint) any
  row whose UPDATE/INSERT would violate a constraint (e.g. a unit already
  booked for those dates by a VPS-only reservation). `verifySync.ts` reports
  exactly what remained unsynced.
- **`auth` schema:** `auth.users` / `auth.identities` are synced **INSERT-only**
  and ordered before `public`, so public rows that FK to `auth.users` resolve.
  They are never updated by this tool.
- **Sequences:** every serial/identity column gets
  `SELECT setval(pg_get_serial_sequence(...), MAX(col))` appended (this schema
  is all-UUID, so there are usually none).
- **Fidelity (PG17 → PG18):** values are read as Postgres' raw text output and
  re-emitted with explicit `::type` casts, so timestamps, numerics, json,
  arrays, enums and bytea round-trip exactly.

## Running it (on the VPS — recommended)

The VPS Postgres listens on `localhost:5432` and is not exposed externally, so
run the pipeline **from the VPS** (Node 20 is installed there). The VPS also has
outbound internet to reach Supabase.

### 1. Install

```powershell
cd C:\Artillery-ERP\database-sync   # or wherever you copied this folder
npm install
```

### 2. Set the two connection strings (env vars — never commit these)

**SOURCE — Supabase session pooler** (from the Supabase dashboard → Database →
Connection string → Session pooler, port 5432; append `?sslmode=require`):

```powershell
$env:SOURCE_DATABASE_URL = "postgresql://postgres.<ref>:<PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

**TARGET — VPS staging DB.** The real password lives on the VPS in
`C:\Temp\artillery-db-secrets.txt` (line `DATABASE_URL_STAGING=...`). Read it and
export it:

```powershell
# shows DATABASE_URL_STAGING=postgresql://artillery_app:<pw>@127.0.0.1:5432/artillery_erp_staging
type C:\Temp\artillery-db-secrets.txt
$env:TARGET_DATABASE_URL = "postgresql://artillery_app:<pw>@127.0.0.1:5432/artillery_erp_staging"
```

### 3. Compare

```powershell
npm run compare
```

Prints the row-count diff and writes `reports/compare_report.md`.

### 4. Back up the target FIRST (safety)

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -Fc `
  -d "$env:TARGET_DATABASE_URL" `
  -f "C:\Temp\pre-deltasync-backup_$(Get-Date -Format yyyyMMdd-HHmmss).dump"
```

### 5. Generate the delta

```powershell
# INSERT_BATCH=1 makes each row its own statement, so the resilient apply below
# can skip an individual conflicting row instead of a whole batch.
$env:INSERT_BATCH = "1"
npm run generate      # -> delta_sync.sql
```

### 6. Apply transactionally (as a superuser — required for trigger disable)

The delta issues `ALTER TABLE … DISABLE TRIGGER USER`, which needs the table
owner/superuser. On this VPS the tables are owned by `postgres` and there is no
stored `postgres` password, so grant a **temporary, narrowly-scoped** local
trust rule, apply as `postgres`, then restore `pg_hba.conf`:

```powershell
$data = "C:\Program Files\PostgreSQL\18\data"
$hba  = Join-Path $data "pg_hba.conf"
Copy-Item $hba "$hba.bak" -Force
try {
  "host    artillery_erp_staging    postgres    127.0.0.1/32    trust`r`n" + (Get-Content $hba -Raw) | Set-Content $hba -Encoding ascii
  & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" reload -D $data
  $env:PGCLIENTENCODING = "UTF8"
  # RESILIENT apply: commit everything that can be applied, skip rows that
  # conflict with VPS-only live data (reported by verify).
  & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -v ON_ERROR_ROLLBACK=on -U postgres -h 127.0.0.1 -d artillery_erp_staging -f delta_sync.sql
} finally {
  Copy-Item "$hba.bak" $hba -Force
  & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" reload -D $data
  Remove-Item "$hba.bak" -Force
}
```

Everything is inside one `BEGIN … COMMIT`. For a STRICT all-or-nothing apply
(no live conflicts expected) use `-v ON_ERROR_STOP=1` instead of
`ON_ERROR_ROLLBACK=on`; then any error rolls the whole file back.

> If a future setup grants the app role ownership or superuser, you can apply
> directly with `psql "$TARGET_DATABASE_URL" -v ON_ERROR_ROLLBACK=on -f delta_sync.sql`
> and skip the trust dance.

### 7. Verify

```powershell
npm run verify
```

PASS/FAILED per table + overall. Exit code is non-zero if any table fails.
A table can legitimately show the VPS row count **higher** than Supabase
(VPS-only live rows are preserved, never deleted); `verify` still PASSes as long
as no Supabase PK is missing from the VPS.

## Re-running

The whole pipeline is idempotent: `ON CONFLICT DO NOTHING` inserts and
guarded updates mean you can run compare → generate → apply → verify as many
times as you like. Re-run after any period of Supabase writes to catch up the
VPS.

## Bash / Linux equivalents

```bash
export SOURCE_DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
export TARGET_DATABASE_URL="postgresql://artillery_app:<pw>@127.0.0.1:5432/artillery_erp_staging"
npm install
npm run compare
pg_dump -Fc -d "$TARGET_DATABASE_URL" -f "/tmp/pre-deltasync-backup_$(date +%Y%m%d-%H%M%S).dump"
INSERT_BATCH=1 npm run generate
# Apply as a superuser/owner (needed for DISABLE TRIGGER USER); resilient mode:
psql "postgresql://postgres@127.0.0.1:5432/artillery_erp_staging" -v ON_ERROR_ROLLBACK=on -f delta_sync.sql
npm run verify
```
