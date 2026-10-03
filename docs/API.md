# Ortak Plan — Architecture & API Contract

This file is the single source of truth shared by the backend (`server/`) and the
frontend (`client/`). Change it only together with both sides.

## Product summary

A Notion-like planner for a couple (a "household" of 2 users, but the code must not
hard-limit it to 2). Each user has their own pages, calendar events, tasks and goals.
Every item has a `visibility`:

- `shared` (default) — visible to all members of the household
- `private` — visible only to its owner

Views can be scoped:

- `mine` — only items I own (private + shared)
- `partner` — only items owned by other household members that are `shared`
- `merged` — everything I can see (mine + partners' shared), each item rendered with
  the owner's single-letter `initial` badge and `color`

UI language: **Turkish**. Code/identifiers: English.

## Stack

- Node 22, npm workspaces monorepo: `server/` and `client/`, root `package.json`.
- Backend: Express 5, **PostgreSQL**, `bcryptjs`, `jsonwebtoken`, `zod` for validation.
  Plain ESM JavaScript (`"type": "module"`). Small async DB layer in `server/src/db.js`
  (`query` / `one` / `many` / `exec` / `tx`, `?` placeholders):
  - `DATABASE_URL` set → `postgres` (postgres.js) driver, prepared statements off and a
    pool of 2 (`PG_POOL_MAX`) so it works behind Supabase's transaction pooler (port 6543)
    and in serverless functions; SSL required for non-local hosts (`?sslmode=disable` opts out).
  - `DATABASE_URL` unset → **PGlite** (Postgres compiled to WASM), data in
    `server/data/pglite` (gitignored, overridable by `PGLITE_DIR`); tests use in-memory
    PGlite (or `TEST_DATABASE_URL`).
  - Schema: `server/sql/schema.sql` (idempotent), applied by `npm run db:migrate` and
    automatically on the first query of a process when tables are missing. Dates/times are
    ISO-8601 `TEXT COLLATE "C"`, page content is `JSONB`, flags are `BOOLEAN`.
  Port `PORT` (default 3001). `npm start` also serves `client/dist` statically with SPA fallback.
- Deployment: Vercel — `api/index.js` exports the Express app as one serverless function
  (`/api/*` rewritten to it), the client is served from `client/dist` with an SPA
  fallback (`vercel.json`). Database: Supabase Postgres. `JWT_SECRET` is mandatory when
  `NODE_ENV=production`.
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS, `react-router-dom`, `date-fns`
  (with `tr` locale, weeks start Monday). Dev server 5173 proxies `/api` → `http://localhost:3001`.
- Root scripts: `npm run dev` (both, via `concurrently`), `npm run build`, `npm start`,
  `npm test`, `npm run seed`, `npm run db:migrate`, `npm run e2e`.

## Conventions

- All endpoints under `/api`, JSON in/out. Auth via `Authorization: Bearer <jwt>`.
- IDs: integers. Timestamps: ISO 8601 strings. Dates (no time): `YYYY-MM-DD`.
- Errors: HTTP status + `{ "error": "message in Turkish" }`. 400 validation, 401 unauth,
  403 not owner, 404 not found / not visible.
- Only the owner may update/delete an item. Exception: any household member may
  update `status`/`position` of a **shared** task (move it on the board) and toggle
  `done`/`progress` of a shared goal.
- Every item object returned by the API includes an `owner` summary:
  `{ "id", "name", "initial", "color" }`.
- List endpoints accept `scope=mine|partner|merged` (default `merged`).

## Data model

```
households(id, name, invite_code UNIQUE, created_at)
users(id, household_id, name, email UNIQUE, password_hash, initial CHAR(1), color, created_at)
events(id, household_id, owner_id, title, description, start, end, all_day BOOL,
       location, color NULL, visibility, created_at, updated_at)
tasks(id, household_id, owner_id, assignee_id NULL, title, description,
      status 'todo'|'doing'|'done', priority 'low'|'medium'|'high',
      due_date NULL, position REAL, visibility, created_at, updated_at, completed_at NULL)
goals(id, household_id, owner_id, title, description,
      period 'daily'|'weekly'|'monthly', period_start DATE, progress INT 0-100,
      done BOOL, visibility, created_at, updated_at)
pages(id, household_id, owner_id, parent_id NULL, title, icon, content JSON,
      period NULL|'daily'|'weekly'|'monthly', period_start DATE NULL,
      visibility, position REAL, created_at, updated_at)
```

`period_start` normalisation (server enforces): daily → the day; weekly → Monday of
that week; monthly → first day of the month.

### Page `content` (Notion-like blocks)

`content` is a JSON array of blocks:

```json
{ "id": "uuid", "type": "paragraph|heading1|heading2|heading3|todo|bullet|numbered|quote|divider|callout|code|toggle",
  "text": "plain text", "checked": false, "children": [] }
```

```json
{ "id": "uuid", "type": "toggle", "text": "Seçenekler", "collapsed": false, "children": [ … ] }
```

- `checked` is used only by `todo`.
- `children` holds nested blocks: a `toggle`'s content, or list items indented with
  Tab under a `todo` / `bullet` / `numbered` / `toggle` block (Shift+Tab outdents).
- `collapsed` (toggle only) persists the open/closed state; missing means closed.

Backend stores `content` opaquely (validates it is an array), so these fields round-trip
unchanged.

## Endpoints

### Auth
- `POST /api/auth/register` `{ name, email, password, initial?, color?, inviteCode? }`
  → `201 { token, user }`. Without `inviteCode` a new household is created (named
  "<name> ailesi"); with a valid one the user joins that household. `initial` defaults
  to the first letter of `name` uppercased; `color` defaults to a palette colour.
- `POST /api/auth/login` `{ email, password }` → `{ token, user }`
- `GET /api/auth/me` → `{ user, household: { id, name, inviteCode, members: [ownerSummary] } }`
- `PATCH /api/auth/me` `{ name?, initial?, color?, password? }` → `{ user }`

`user` = `{ id, name, email, initial, color, householdId }`

### Household
- `GET /api/household` → `{ id, name, inviteCode, members: [ownerSummary] }`
- `PATCH /api/household` `{ name }` → same shape
- `POST /api/household/invite-code` → regenerates, returns same shape

### Events (calendar entries)
- `GET /api/events?from=ISO&to=ISO&scope=` → `[event]` overlapping the range
- `POST /api/events` `{ title, description?, start, end?, allDay?, location?, color?, visibility? }`
- `GET|PATCH|DELETE /api/events/:id`

`event` = `{ id, title, description, start, end, allDay, location, color, visibility, owner, createdAt, updatedAt }`
(`end` defaults to `start`.)

Event time storage (normalised by the server on every write):

- **All-day** (`allDay: true`): `start`/`end` are calendar dates `YYYY-MM-DD`, `end` inclusive.
  A date-time sent for an all-day event is converted to its date in `tz`.
- **Timed**: `start`/`end` are UTC instants `YYYY-MM-DDTHH:MM:SS.sssZ`. Inputs with an
  offset are converted; inputs without offset (`2026-10-10T09:00`) or plain dates are
  wall-clock times in `tz`.

`tz` (optional IANA zone, e.g. `Europe/Istanbul`) may be sent as a body field on
`POST/PATCH /api/events` and as a query param on `GET /api/events`, `/api/calendar` and
`/api/dashboard`. It defaults to the household zone `APP_TIMEZONE` (default
`Europe/Istanbul`). Date bounds (`from`/`to`/`date`) are whole local days in `tz`:
all-day events match by date (so they show on their date in any zone), timed events
match by instant overlap (so an event spanning several days matches each of them; an
event ending exactly at midnight does not leak into the next day). The client always
sends the browser's zone.

### Tasks (kanban: Yapılacak / Yapılıyor / Yapıldı)
- `GET /api/tasks?scope=&status=&dueFrom=&dueTo=` → `[task]` ordered by `status, position`
- `POST /api/tasks` `{ title, description?, status?, priority?, dueDate?, assigneeId?, visibility? }`
  (new task goes to the end of its column)
- `GET|PATCH|DELETE /api/tasks/:id`
- `POST /api/tasks/:id/move` `{ status, position }` — reorders; sets `completedAt` when status becomes `done`

`task` = `{ id, title, description, status, priority, dueDate, position, visibility, owner, assignee: ownerSummary|null, completedAt, createdAt, updatedAt }`

### Goals (daily / weekly / monthly)
- `GET /api/goals?period=&from=DATE&to=DATE&scope=` → `[goal]` whose `periodStart` is in range
- `POST /api/goals` `{ title, description?, period, periodStart, progress?, visibility? }`
- `GET|PATCH|DELETE /api/goals/:id`

`goal` = `{ id, title, description, period, periodStart, periodEnd, progress, done, visibility, owner, createdAt, updatedAt }`
(`periodEnd` computed: last day of the period.)

### Pages (Notion-like documents, and daily/weekly/monthly plans)
- `GET /api/pages?scope=&parentId=&period=&from=&to=` → `[pageSummary]` (no `content`)
  - `parentId=root` → only top-level pages
- `POST /api/pages` `{ title?, icon?, parentId?, content?, period?, periodStart?, visibility? }`
- `GET /api/pages/:id` → full `page` incl. `content` and `breadcrumbs: [{id,title,icon}]`
- `PATCH|DELETE /api/pages/:id` (delete cascades to child pages)

`pageSummary` = `{ id, title, icon, parentId, period, periodStart, visibility, owner, position, hasChildren, createdAt, updatedAt }`
`page` = pageSummary + `{ content, breadcrumbs }`

A "plan" is a page with `period` + `periodStart` set. The Plans screen lists them.

### Aggregated calendar
- `GET /api/calendar?from=DATE&to=DATE&scope=` →
  `{ events: [event], tasks: [task with dueDate in range], goals: [goal overlapping range], plans: [pageSummary overlapping range] }`

### Dashboard
- `GET /api/dashboard?date=DATE&scope=` → items relevant to "today / this week / this month":
  `{ date, today: { events, tasks, goals, plans }, week: { events, goals, plans, tasks }, month: { goals, plans }, taskCounts: { todo, doing, done } }`

### Health
- `GET /api/health` → `{ ok: true }`

## Frontend screens (all Turkish)

- `/login`, `/register` (register supports invite code)
- Layout: Notion-style left sidebar (user switcher-free; shows logged-in user, page tree,
  nav links), scope toggle **Benim / Eşim / Ortak** persisted in localStorage and
  applied to every view.
- `/` **Bugün** dashboard: today's events, tasks, daily/weekly/monthly goals & plans.
- `/calendar` **Takvim**: month grid (default), plus week and day views; click a day to
  add an event; each item shows a small owner-initial badge in the owner's colour;
  tasks with due dates and goals also appear (visually distinct).
- `/board` **Pano**: kanban Yapılacak / Yapılıyor / Yapıldı with drag & drop.
- `/goals` **Hedefler**: tabs Günlük / Haftalık / Aylık with period navigation, progress bars.
- `/plans` **Planlar**: daily/weekly/monthly plan pages per period, open in the page editor.
- `/pages/:id` **Sayfa**: Notion-like block editor (slash `/` menu for block types,
  Enter → new block, Backspace on empty → delete, todo checkboxes, emoji icon, nested pages, autosave).
- `/settings` **Ayarlar**: profile (name, initial, colour), household name & invite code.

## Seed data

`npm run seed` creates household "Bizim Ev" with two users:
- `omer@example.com` / `123456`, name "Ömer", initial "Ö", colour `#2563eb`
- `es@example.com` / `123456`, name "Eşim", initial "E", colour `#db2777`
plus sample events (incl. both users on the coming weekend), tasks in all 3 columns,
goals for each period and a few pages/plans.
