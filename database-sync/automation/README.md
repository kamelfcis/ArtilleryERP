# Artillery ERP — Nightly Reconcile (Supabase → VPS)

Automation that keeps the VPS PostgreSQL (`artillery_erp_staging`) **equal** to
**Supabase (source of truth)** by running a full reconcile pipeline **once daily
at midnight (UTC+3)**, unattended.

Each run does: **compare → backup (`pg_dump -Fc`) → purge VPS-only rows →
generate → apply (resilient) → verify**, writes a timestamped log, and prunes
old logs/backups.

> **Destructive one-way reconcile.** Unlike the old safe sync (`run-sync.ps1`),
> this **deletes** rows on the VPS whose primary keys are absent from Supabase,
> then INSERTs missing + UPDATEs changed rows so both databases match.

## Files

| File | What it does |
|------|--------------|
| `run-reconcile-nightly.ps1` | The scheduled runner. Loads creds, runs the 6-step reconcile pipeline, logs to `..\logs\`, backs up to `..\backups\`, prunes old files, uses a lock file. Exit `0` on success. |
| `run-sync.ps1` | Legacy safe sync (insert/update only, never deletes). Kept for manual use. |
| `run-reconcile.ps1` | Interactive/manual full reconcile (same steps, console output). |
| `register-tasks.ps1` | Creates/updates (or `-Unregister`s) the Windows Scheduled Task. Removes the legacy twice-daily task on register. |
| `README.md` | This file. |

## Install location (durable)

```
C:\Artillery-ERP\database-sync\              <- git working tree (git pull to update)
  ├─ automation\   run-reconcile-nightly.ps1, register-tasks.ps1, …   (committed)
  ├─ logs\         reconcile_<stamp>.log, run-reconcile.lock           (gitignored)
  ├─ backups\      pre-reconcile_<stamp>.dump                         (gitignored)
  └─ reports\      compare/delta/purge/verify reports                 (gitignored)
```

Set up once on the VPS:

```powershell
cd C:\Artillery-ERP
git pull
cd C:\Artillery-ERP\database-sync
npm install
powershell -ExecutionPolicy Bypass -File automation\register-tasks.ps1
```

## Credentials & non-interactive DB auth (no secrets in git)

`run-reconcile-nightly.ps1` reads everything at runtime from the VPS-only secrets file
`C:\Temp\artillery-db-secrets.txt`:

- `SOURCE_DATABASE_URL` — Supabase session pooler (source of truth).
- `DATABASE_URL_STAGING` — VPS target (`artillery_app`) — used for compare/generate/purge/verify.
- `POSTGRES_SUPERUSER_PASSWORD` — the `postgres` role password (see below).

The **apply** step must run as a superuser because the generated delta uses
`ALTER TABLE … DISABLE TRIGGER USER`. Auth is via the secured pgpass file
`C:\Temp\artillery-pgpass.conf` (ACL: Administrators + SYSTEM only).

**Nothing sensitive is committed.**

## Schedule & timezone

Windows fires triggers at the **VPS local wall-clock time**. This VPS runs on
**Pacific time**; the operator is **UTC+3**.

| Operator intent (UTC+3) | VPS-local trigger (PDT / summer) | VPS-local trigger (PST / winter) |
|---|---|---|
| **00:00 (midnight)** | **06:00** | 05:00 |

The default trigger is **06:00** VPS-local, which matches midnight UTC+3
**while Pacific is on PDT (UTC-7)**. When Pacific switches to PST (UTC-8,
~early November) that same VPS-local time drifts to 23:00 UTC+3 — re-align with:

```powershell
powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Times '05:00'
```

### Register / change / remove

```powershell
# Register with default (06:00 VPS-local = midnight UTC+3 during PDT):
powershell -ExecutionPolicy Bypass -File C:\Artillery-ERP\database-sync\automation\register-tasks.ps1

# Re-align for PST (05:00 VPS-local = midnight UTC+3 during PST):
powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Times '05:00'

# Inspect:
schtasks /query /tn "Artillery-DeltaSync-Nightly" /v /fo LIST
Get-ScheduledTaskInfo -TaskName "Artillery-DeltaSync-Nightly"

# Run once now (manual test):
Start-ScheduledTask -TaskName "Artillery-DeltaSync-Nightly"

# Freeze for cutover (disable) / re-enable:
Disable-ScheduledTask -TaskName "Artillery-DeltaSync-Nightly"
Enable-ScheduledTask  -TaskName "Artillery-DeltaSync-Nightly"

# Remove entirely:
powershell -ExecutionPolicy Bypass -File register-tasks.ps1 -Unregister
```

The task runs as **SYSTEM**, highest privileges, whether logged on or not, with
`MultipleInstances=IgnoreNew` and `StartWhenAvailable`.

## Logs, backups, retention

- Logs: `..\logs\reconcile_<yyyyMMdd-HHmmss>.log` — keep last **30**.
- Backups: `..\backups\pre-reconcile_<yyyyMMdd-HHmmss>.dump` — keep last **14**.
- Both are pruned at the end of every run.

## How reconcile differs from safe sync

| | Safe sync (`run-sync.ps1`) | Nightly reconcile (`run-reconcile-nightly.ps1`) |
|---|---|---|
| Deletes VPS-only rows | Never | **Yes** (purge step) |
| Goal | Catch up inserts/updates | **Full equality** with Supabase |
| Verify tolerance | Known booking conflicts allowed | **Strict** (minor live-churn tolerance only) |
| Schedule | Was twice daily (removed) | **Once daily at midnight UTC+3** |

> ⚠️ **While BOTH systems are live**, new VPS-only bookings can reappear between
> runs and will be purged on the next nightly reconcile. At final cutover,
> **disable this task first** (freeze), then do the manual final sync per
> [`../../docs/FINAL_CUTOVER_RUNBOOK.md`](../../docs/FINAL_CUTOVER_RUNBOOK.md).

## Exit codes

- `0` — success, or a run skipped because another was in progress.
- non-zero — a real failure (secrets missing, backup failed, purge/generate/apply
  error, verify divergence beyond tolerance). Check the newest `..\logs\reconcile_*.log`.
