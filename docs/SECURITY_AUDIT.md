# Artillery ERP — Security Audit & Remediation

Date: 2026-07-28  
Scope: Frontend (Vercel), Express API (VPS), Postgres, R2 storage, ops scripts.

## Architecture note

Browser → Vercel edge proxy → Express (`artillery-api`) → Postgres / R2.  
Frontend role checks are UI-only. The API uses a privileged DB pool, so **every route must authorize**. Client query flags must not decide access scope.

---

## Critical

| ID | Finding | Fix |
|----|---------|-----|
| C1 | `buildUpdateSet` interpolated raw object keys; reservations POST used `Object.keys(req.body)` for INSERT | Identifier allowlist `/^[a-z_][a-z0-9_]*$/i`; `pickFields` / `buildInsert` on all mutating routes |
| C2 | Most writes only required `requireAuth` (Viewer could call APIs) | `requireAnyRole` on mutating routes matching UI permissions |
| C3 | Client `restrictedBranchManager` / `rocketUserId` trusted for list scoping | Derive BranchManager / Rocket scope from `req.user` + DB |

## High

| ID | Finding | Fix |
|----|---------|-----|
| H1 | `GET /admin/users` returned all emails to any auth user | SuperAdmin-only full list; calendar uses `created_by_email`; `GET /admin/rocket-user` for rocket id |
| H2 | No server overlap check on reservation write | Overlap SQL on POST/PATCH → **409** |
| H3 | R2 path traversal; any auth user upload/delete | Path sanitize, contentType allowlist, delete restricted |
| H4 | Dual Next/Express admin surfaces | Document: api-mode must not ship service-role; Express is source of truth |

## Medium

| ID | Finding | Fix |
|----|---------|-----|
| M1 | No login rate limit | `express-rate-limit` on `/auth/login` (10/min/IP) |
| M2 | 7d JWT, no revocation on password change | `token_version` on `user_accounts`; bump on password change; checked in `requireAuth` |
| M3 | Calendar tooltip `innerHTML` XSS | `escapeHtml` on dynamic fields |
| M4 | Unlimited JSON body | `express.json({ limit: '1mb' })` |
| M5 | DB sync purge toolkit | Keep scheduled sync **disabled**; require `ALLOW_PURGE=true` before any future enable |
| M6 | Ops password scripts in workspace | `scripts/ops/` in `.gitignore`; do not commit |
| M7 | Weak password min length | Change-password / create-user min **10** |

## Low

| ID | Finding | Fix / status |
|----|---------|--------------|
| L1 | Location filters sometimes client-hinted | Server scope for BM/Rocket lists |
| L2 | R2 health leaked raw errors | Generic client message |
| L3 | Credentials historically shared | **Rotation checklist** below (manual) |
| L4 | FullCalendar license banner | Non-security; configure key separately |
| L5 | Inconsistent allowlisting | Standardized on `pickFields` / `buildInsert` |

---

## Sync toolkit status

Scheduled Supabase→VPS mirror / purge tasks must stay **disabled** in production after cutover. Do not re-enable without an explicit cutover decision. Any future purge path must require env `ALLOW_PURGE=true` and default to dry-run.

---

## Secret rotation checklist (manual — do not automate from chat)

Do these from a secure admin session; update secrets in VPS env / Vercel / R2 as needed:

1. Rotate VPS `Administrator` password (prefer SSH key-only afterward).
2. Rotate Postgres app role password (`artillery_app` / `DATABASE_URL`).
3. Rotate `JWT_SECRET` (forces all users to re-login).
4. Rotate Cloudflare R2 access keys if exposed.
5. Rotate any Supabase service-role keys still present in Vercel; ensure they are **not** `NEXT_PUBLIC_*`.
6. Confirm admin passwords reset via ops scripts were rotated again after script use.
7. Revoke old Plink/SSH sessions and remove plaintext secrets from chat logs / scratch files.

---

## Verification checklist

1. Login as SuperAdmin / Receptionist / Viewer / BranchManager.
2. Viewer: raw API write → **403**.
3. Overlapping reservation create/update → **409**.
4. Calendar tooltip with `<script>` in guest name → escaped, no exec.
5. Upload with `../` path → **400**.
6. `/health`, calendar, reservation creator/editor fields still work.
7. Password change → old JWT rejected.

---

## Out of scope (this wave)

- Rewriting frontend off Express  
- Re-enabling Supabase→VPS mirror  
- Full Postgres RLS / per-request SET ROLE  
- Dropping enum values  
