# Artillery ERP API

Express + TypeScript backend for the Supabase → VPS migration. Connects directly to PostgreSQL (same schema as Supabase, including `auth.users` for login).

## Quick start (local dev)

```bash
cd backend
cp .env.example .env
# Point DATABASE_URL at Supabase pooler or local Postgres
npm install
npm run dev
```

API listens on `http://localhost:4000`.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | DB ping |
| POST | `/auth/login` | No | Email/password → JWT httpOnly cookie |
| POST | `/auth/logout` | No | Clear cookie |
| GET | `/auth/me` | Yes | User, roles, elevatedOps |
| GET | `/locations` | Yes | Active locations |
| GET | `/units` | Yes | Units (optional `locationId`, `onlyCalendarFields`) |
| GET | `/guests` | Yes | Paginated guests (`page`, `pageSize`, `search`) |
| GET | `/reservations/page` | Yes | Paginated reservations (RPC) |
| GET | `/calendar/window` | Yes | Calendar events for date range |
| POST | `/admin/update-unit-statuses` | SuperAdmin/Receptionist | Run `update_all_unit_statuses` RPC |

## Production (PM2)

```bash
npm run build
pm2 start dist/index.js --name artillery-api
pm2 save
```

Place Nginx in front (see `scripts/migration/setup-vps.sh`).

## Cross-origin cookies

- **Production** (Vercel → VPS): `SameSite=None; Secure` — requires HTTPS on the API domain.
- **Local dev** (`localhost:3000` → `localhost:4000`): same-site; cookies work with `credentials: 'include'`.
