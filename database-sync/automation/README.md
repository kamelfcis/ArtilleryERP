# Artillery ERP — Supabase → VPS sync automation

Automation that keeps VPS PostgreSQL (`artillery_erp_staging`) caught up with
**Supabase** until Supabase is decommissioned.

## Active strategy: 10-minute differential mirror

Windows task **`Artillery-DeltaSync-Mirror`** runs every **10 minutes** as SYSTEM:

**compare → generate → apply (resilient) → verify** (no `pg_dump`, no purge)

- **INSERT** missing + **UPDATE** changed rows only.
- **Never deletes** VPS-only rows (safe while both sites may still write).
- Resilient apply (`ON_ERROR_ROLLBACK=on`) skips booking unique-constraint conflicts.
- Logs: `..\logs\mirror_<stamp>.log` (keep ~288 / 48h) plus child `sync_*.log`.

> While both sites write, VPS can still get ahead on some tables; the mirror only
> applies Supabase → VPS. That is intentional until Supabase is frozen.

## Files

| File | What it does |
|------|--------------|
| `run-mirror.ps1` | 10-min wrapper: lock (~25 min stale), calls `run-sync.ps1 -SkipBackup`, retention. |
| `register-mirror-task.ps1` | Creates/updates (or `-Unregister`s) `Artillery-DeltaSync-Mirror`. **Disables** the nightly purge task on register. |
| `run-sync.ps1` | Safe sync pipeline (insert/update only). Supports `-SkipBackup` for frequent runs. |
| `run-reconcile-nightly.ps1` | Full equality pipeline including **purge** of VPS-only rows. Kept for a final cutover equality pass. |
| `register-tasks.ps1` | Registers `Artillery-DeltaSync-Nightly` (disabled while the 10-min mirror is active). |
| `run-reconcile.ps1` | Interactive/manual full reconcile. |
| `README.md` | This file. |

## Install location (durable)

```
C:\Artillery-ERP\database-sync\              <- git working tree (git pull to update)
  ├─ automation\   run-mirror.ps1, register-mirror-task.ps1, …   (committed)
  ├─ logs\         mirror_*.log, sync_*.log, locks               (gitignored)
  ├─ backups\      pre-sync_*.dump / pre-reconcile_*.dump        (gitignored)
  └─ reports\      compare/delta/verify reports                  (gitignored)
```

Set up / refresh on the VPS:

```powershell
cd C:\Artillery-ERP
git pull
cd C:\Artillery-ERP\database-sync
npm install
powershell -ExecutionPolicy Bypass -File automation\register-mirror-task.ps1
```

## Credentials & non-interactive DB auth (no secrets in git)

Runners read everything at runtime from the VPS-only secrets file
`C:\Temp\artillery-db-secrets.txt`:

- `SOURCE_DATABASE_URL` — Supabase session pooler (source of truth for inserts/updates).
- `DATABASE_URL_STAGING` — VPS target (`artillery_app`) — used for compare/generate/verify.
- `POSTGRES_SUPERUSER_PASSWORD` — the `postgres` role password (fallback if pgpass missing).

The **apply** step must run as a superuser because the generated delta uses
`ALTER TABLE … DISABLE TRIGGER USER`. Auth is via the secured pgpass file
`C:\Temp\artillery-pgpass.conf` (ACL: Administrators + SYSTEM only).

**Nothing sensitive is committed.**

## Schedule: 10-minute mirror

```powershell
# Register (every 10 min) and disable nightly purge:
powershell -ExecutionPolicy Bypass -File C:\Artillery-ERP\database-sync\automation\register-mirror-task.ps1

# Inspect:
schtasks /query /tn "Artillery-DeltaSync-Mirror" /v /fo LIST
Get-ScheduledTaskInfo -TaskName "Artillery-DeltaSync-Mirror"

# Run once now (manual test):
schtasks /run /tn "Artillery-DeltaSync-Mirror"
# or: powershell -ExecutionPolicy Bypass -File C:\Artillery-ERP\database-sync\automation\run-mirror.ps1

# Freeze for cutover (disable) / re-enable:
Disable-ScheduledTask -TaskName "Artillery-DeltaSync-Mirror"
Enable-ScheduledTask  -TaskName "Artillery-DeltaSync-Mirror"

# Remove entirely (does not re-enable nightly):
powershell -ExecutionPolicy Bypass -File register-mirror-task.ps1 -Unregister
```

The task runs as **SYSTEM**, highest privileges, whether logged on or not, with
`MultipleInstances=IgnoreNew` and `StartWhenAvailable`.

## Nightly purge reconcile (disabled while mirror is active)

`Artillery-DeltaSync-Nightly` runs **compare → backup → purge VPS-only → generate →
apply → verify**. It is **destructive** (deletes VPS-only rows) and too heavy for
a 10-minute cadence. `register-mirror-task.ps1` **disables** it on register.

To re-enable for a **final equality pass** before/during cutover (after writes on
the new site are frozen, or you accept purging VPS-only rows):

```powershell
Enable-ScheduledTask -TaskName "Artillery-DeltaSync-Nightly"
# Or re-register:
powershell -ExecutionPolicy Bypass -File C:\Artillery-ERP\database-sync\automation\register-tasks.ps1
```

Default nightly trigger: **06:00 VPS-local** (= **00:00 midnight UTC+3** while
Pacific is on PDT). Re-align for PST with `-Times '05:00'`.

## How mirror differs from nightly reconcile

| | 10-min mirror (`run-mirror.ps1`) | Nightly reconcile (`run-reconcile-nightly.ps1`) |
|---|---|---|
| Deletes VPS-only rows | Never | **Yes** (purge step) |
| `pg_dump` every run | **Skipped** (`-SkipBackup`) | Yes |
| Goal | Catch up inserts/updates | **Full equality** with Supabase |
| Schedule | **Every 10 minutes** | Once daily (currently **disabled**) |
| Verify tolerance | Known booking conflicts allowed | Strict (minor live-churn only) |

> ⚠️ At final cutover, **disable `Artillery-DeltaSync-Mirror` first** (freeze),
> then do the manual final sync per
> [`../../docs/FINAL_CUTOVER_RUNBOOK.md`](../../docs/FINAL_CUTOVER_RUNBOOK.md).

## Logs, backups, retention

- Mirror logs: `..\logs\mirror_<yyyyMMdd-HHmmss>.log` — keep last **288** or **48h**.
- Sync logs (child): `..\logs\sync_*.log` — pruned by `run-sync.ps1` retention.
- Backups: only when `run-sync.ps1` is run **without** `-SkipBackup`, or via nightly/manual reconcile (`pre-reconcile_*.dump`).

## Exit codes

- `0` — success, or a run skipped because another was in progress.
- non-zero — a real failure (secrets missing, generate/apply error, severe verify divergence). Check the newest `..\logs\mirror_*.log`.
