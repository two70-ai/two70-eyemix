# EyeMix PWA

EyeMix is a full-stack Progressive Web App that merges two iris photos using AI to create beautiful artistic compositions displayed on product mockups.

## Features

- **AI Iris Merging**: Upload two iris photos and select a prompt template to generate a merged iris artwork
- **Product Mockups**: View results on photo frames, mugs, keychains, and more
- **Prompt Templates**: Admin-managed gallery of artistic styles with reference images
- **Role-based Access**: Admin full control, Client paywall-protected view
- **PWA**: Installable, offline-capable Progressive Web App
- **Dual Database Support**: Supabase (PostgreSQL) or SQLite for local development

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend**: Express.js REST API
- **Database**: Supabase (PostgreSQL) or SQLite — switchable via `DB_SOURCE` env var
- **Storage**: Supabase Storage or local filesystem (auto-selected with database)
- **AI**: Google Gemini 2.5 Flash Image (iris merging) + Imagen 4 (reference generation)
- **Auth**: JWT with httpOnly cookies
- **Deploy**: Replit, or any Node.js host

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values
3. Install dependencies: `npm install`
4. Build frontend: `npm run build`
5. Start server: `npm start`

### Quick Start with SQLite (no external services needed)

```bash
cp .env.example .env
# Edit .env: set DB_SOURCE=sqlite, add a JWT_SECRET, add GEMINI_API_KEY
npm install
npm run build
npm start
```

The SQLite database and local storage directories are created automatically on first startup under `./data/`.

### Setup with Supabase

1. Set `DB_SOURCE=supabase` in `.env` (or omit it — supabase is the default)
2. Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
3. Run the SQL migration in `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor

## Development

```bash
npm run dev
```

This runs both the backend (nodemon on port 3000) and frontend (Vite on port 5173) concurrently.

```bash
npm test            # Run server tests
npm run test:watch  # Watch mode
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_SOURCE` | `supabase` (default) or `sqlite` |
| `SUPABASE_URL` | Supabase project URL (when using supabase) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (when using supabase) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (when using supabase) |
| `SQLITE_DB_PATH` | Custom SQLite path (default: `./data/eyemix.sqlite`) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) |
| `CLIENT_PAYWALL_PASSWORD` | Password clients enter to unlock results |
| `PORT` | Server port (default: 3000) |

## User Roles

- **Admin**: Full access to manage templates, couples, and generate merges
- **Client**: View-only access to their assigned couples (after entering paywall password)

On first run, visit the app and create the initial admin account — this bootstraps the system.

## Product Mockups

Generated iris art is displayed on:
- Photo frame (A4)
- Coffee mug
- Heat-reveal mug (animated CSS reveal)
- Charm/pendant
- Keychain
- Fridge magnet
- Cup coaster
