# Artillery ERP — Scheduled Delta-Sync (Supabase → VPS)

Automation that keeps the VPS PostgreSQL (`artillery_erp_staging`) continuously
caught up with **Supabase (source of truth)** by running the
[`../README.md`](../README.md) delta-sync pipeline **twice daily**, unattended.

Each run does: **compare → backup (`pg_dump -Fc`) → generate → apply (resilient)
→ verify**, writes a timestamped log, and prunes old logs/backups.

> One-way sync only. It **INSERTs missing** + **UPDATEs changed** rows
> (`ON CONFLICT`-safe) and **never** deletes/overwrites VPS-only live rows or
> alters the schema.

## Files

| File | What it does |
|------|--------------|
| `run-sync.ps1` | The runner. Loads creds from the secrets file, runs the 5-step pipeline, logs to `..\logs\`, backs up to `..\backups\`, prunes old files, uses a lock file to prevent overlap. Exit `0` on success (incl. expected conflict skips), non-zero only on a real failure. |
| `register-tasks.ps1` | Creates/updates (or `-Unregister`s) the Windows Scheduled Task with the two daily triggers. |
| `README.md` | This file. |

## Install location (durable)

```
C:\Artillery-ERP\database-sync\              <- git working tree (git pull to update)
  ├─ automation\   run-sync.ps1, register-tasks.ps1, README.md   (committed)
  ├─ logs\         sync_<stamp>.log, run-sync.lock                (gitignored)
  ├─ backups\      pre-sync_<stamp>.dump                          (gitignored)
  └─ reports\      compare/delta/verify reports                   (gitignored)
```

Set up once on the VPS:

```powershell
cd C:\Artillery-ERP
git pull
cd C:\Artillery-ERP\database-sync
npm install
```

## Credentials & non-interactive DB auth (no secrets in git)

`run-sync.ps1` reads everything at runtime from the VPS-only secrets file
`C:\Temp\artillery-db-secrets.txt`:

- `SOURCE_DATABASE_URL` — Supabase session pooler (source of truth).
- `DATABASE_URL_STAGING` — VPS target (`artillery_app`) — used for compare/generate/verify.
- `POSTGRES_SUPERUSER_PASSWORD` — the `postgres` role password (see below).

The **apply** step must run as a superuser because the generated delta uses
`ALTER TABLE … DISABLE TRIGGER USER` (all tables are owned by `postgres`). This
is set up **once, durably** — no per-run `pg_hba.conf` flipping:

1. The `postgres` role has a strong password (stored as
   `POSTGRES_SUPERUSER_PASSWORD` in the secrets file).
2. A secured **pgpass** file `C:\Temp\artillery-pgpass.conf`
   (`127.0.0.1:5432:*:postgres:<pw>`, ACL: Administrators + SYSTEM only) lets
   `psql`/`pg_dump` authenticate non-interactively.
3. `pg_hba.conf` already permits `host all all 127.0.0.1/32 scram-sha-256`, so
   the superuser connects over loopback with no config change.

`run-sync.ps1` points `PGPASSFILE` at that pgpass file for the backup + apply.
**Nothing sensitive is committed.**

## Schedule & timezone

Windows fires triggers at the **VPS local wall-clock time**. This VPS runs on
**Pacific time**; the operator is **UTC+3**.

| Operator intent (UTC+3) | VPS-local trigger (PDT / summer) | VPS-local trigger (PST / winter) |
|---|---|---|
| 16:00 (4 PM) | **06:00** | 05:00 |
| 00:00 (12 AM) | **14:00** | 13:00 |

The default triggers are **06:00** and **14:00** VPS-local, which match the
operator's 16:00 / 00:00 UTC+3 **while Pacific is on PDT (UTC-7)**. When Pacific
switches to PST (UTC-8, ~early November) those same VPS-local times drift to
15:00 / 23:00 UTC+3 — re-align with:

```powershell
powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Times '05:00','13:00'
```

### Register / change / remove

```powershell
# Register with defaults (06:00 & 14:00 VPS-local):
powershell -ExecutionPolicy Bypass -File C:\Artillery-ERP\database-sync\automation\register-tasks.ps1

# Use different VPS-local times:
powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Times '05:00','13:00'

# Inspect:
schtasks /query /tn "Artillery-DeltaSync-TwiceDaily" /v /fo LIST
Get-ScheduledTaskInfo -TaskName "Artillery-DeltaSync-TwiceDaily"

# Run once now (manual test):
Start-ScheduledTask -TaskName "Artillery-DeltaSync-TwiceDaily"

# Freeze for cutover (disable) / re-enable:
Disable-ScheduledTask -TaskName "Artillery-DeltaSync-TwiceDaily"
Enable-ScheduledTask  -TaskName "Artillery-DeltaSync-TwiceDaily"

# Remove entirely:
powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Unregister
```

The task runs as **SYSTEM**, highest privileges, whether logged on or not, with
`MultipleInstances=IgnoreNew` (scheduler-level overlap guard) and
`StartWhenAvailable` (catches up a missed run after downtime).

## Logs, backups, retention

- Logs: `..\logs\sync_<yyyyMMdd-HHmmss>.log` — keep last **30**.
- Backups: `..\backups\pre-sync_<yyyyMMdd-HHmmss>.dump` (`pg_dump -Fc`) — keep last **14**.
- Both are pruned at the end of every run. Change via `-KeepLogs` / `-KeepBackups`
  on `run-sync.ps1`.

## How conflicts are handled (READ THIS)

The apply uses `psql -v ON_ERROR_ROLLBACK=on`, so a row that collides with a
**VPS-only live booking** (unique/exclusion constraint) is skipped per-savepoint
and **everything else still commits**. These skips are EXPECTED and logged, not
failures.

`verify` returns non-zero whenever any Supabase row is still missing from the
VPS — which happens every run because of the **known live booking conflicts**
(currently ~3 reservations). `run-sync.ps1` therefore parses
`reports/verify_report.json` and only **fails** on divergence in tables *outside*
the known-conflict allowlist (`public.reservations`,
`public.reservation_attachments`, configurable via `-KnownConflictTables`).

> ⚠️ **While BOTH systems are live**, this one-way sync keeps pulling
> Supabase → VPS, but the new VPS site is *also* writing to the same DB. So
> booking conflicts (same unit + overlapping dates) can **recur or grow** until a
> real cutover with a write-freeze. The job handles them safely (skips + logs),
> but they need **manual resolution at cutover**. See
> [`../../docs/FINAL_CUTOVER_RUNBOOK.md`](../../docs/FINAL_CUTOVER_RUNBOOK.md) §6.

**At final cutover: `Disable-ScheduledTask` first** (freeze), then do the final
manual sync + conflict resolution per the runbook.

## Exit codes

- `0` — success, including expected conflict skips, or a run skipped because
  another was still in progress.
- non-zero — a real failure (secrets missing, backup failed, generate failed,
  apply connection error, verify divergence in an unexpected table, …). Check
  the newest `..\logs\sync_*.log`.
