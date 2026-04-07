# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Express (3000) + Vite (5173) concurrently
npm run dev:server       # Express only with nodemon
npm run dev:client       # Vite only
npm run build            # Build React client to client/dist/
npm start                # Production server (serves client/dist/ + API)
npm test                 # Jest tests (server only)
npm run test:watch       # Jest watch mode
npx jest path/to/test.js # Single test file
```

## Architecture

Full-stack PWA for AI-powered iris photo merging. Express API + React 18 SPA (Vite). No TypeScript, no linter configured.

### Server (`server/`)

**Database layer** (`server/db/`): Pluggable adapter pattern. `DB_SOURCE=supabase|sqlite` in `.env` selects the backend. `server/db/index.js` is the factory; all route handlers import from `../db` — never directly from Supabase or SQLite.

**Storage layer** (`server/services/storageFactory.js`): Same pattern. Supabase Storage when `DB_SOURCE=supabase`, local filesystem (`./data/storage/`) when `sqlite`. Route handlers import from `storageFactory` — never from `storage.js` directly.

**Routes** (`server/routes/`): auth, couples, templates, merges, client, cleanup, storageServe. Each uses repository methods from `server/db/` and storage functions from `storageFactory`.

**Auth flow**: bcrypt password hashing → JWT signed with `JWT_SECRET` → stored in httpOnly cookie. Middleware: `requireAuth`, `requireAdmin`, `requireClient` in `server/middleware/auth.js`.

**AI integration** (`server/services/nanoBanana.js`): Gemini 2.5 Flash Image for iris merging (image+image→image), Imagen 4 for reference generation (text→image). Uses `GEMINI_API_KEY`.

**Schema** (5 tables): `users`, `couples`, `prompt_templates`, `merges`, `client_access`. FK joins are handled in the adapter — Supabase returns nested objects natively, SQLite adapter manually nests JOINed rows into the same shape.

### Client (`client/src/`)

**Routing** (React Router v6): `/admin/*` routes (dashboard, templates, merge, couples, history) and `/client/*` routes (dashboard, couples, results). `ProtectedRoute` enforces role-based access.

**State**: AuthContext (user/auth), ThemeContext (dark/light). No global store — local component state elsewhere.

**API layer** (`client/src/services/api.js`): Axios with `baseURL: /api`, `withCredentials: true`, 2-min timeout. Vite dev proxy forwards `/api` to `localhost:3000`. Global 401 interceptor redirects to `/login`.

**Styling**: Tailwind CSS with custom purple/cyan palette, dark mode via `class` strategy.

## Testing

Jest 30 with mocked dependencies. Tests live in `__tests__/` dirs adjacent to source. Pattern: mock the db adapter + auth middleware + validators, test route logic in isolation. No supertest — tests call route handlers directly with mock req/res. No client-side tests.

## Key Conventions

- DB repository methods are **async** and return **plain objects** (not `{ data, error }` envelopes). Write errors throw; read misses return `null`.
- Storage URLs differ by backend: Supabase returns absolute URLs (`https://...supabase.co/...`), SQLite returns relative URLs (`/api/storage/{bucket}/{filename}`). Client code works with both since it uses `<img src=...>` with same-origin relative paths.
- The SQL migration file (`supabase/migrations/001_initial_schema.sql`) has schema drift — the running code uses `result_image_url` and `prompt_used` columns that aren't in the migration. The SQLite schema matches the running code.
- Merge creation generates a UUID upfront (`uuidv4()`) and uses it in both the storage path and DB record. The merge `id` is caller-supplied, not DB-generated.
