# EyeMix PWA

EyeMix is a full-stack Progressive Web App that merges two iris photos using AI to create beautiful artistic compositions displayed on product mockups.

## Features

- **AI Iris Merging**: Upload two iris photos and select a prompt template to generate a merged iris artwork
- **Product Mockups**: View results on photo frames, mugs, keychains, and more
- **Prompt Templates**: Admin-managed gallery of artistic styles with reference images
- **Role-based Access**: Admin full control, Client paywall-protected view
- **PWA**: Installable, offline-capable Progressive Web App
- **Supabase Backend**: PostgreSQL database and image storage

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend**: Express.js REST API
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: NanoBanana API (configurable)
- **Auth**: JWT with httpOnly cookies
- **Deploy**: Replit (single `npm start`)

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values
3. Run database migrations in Supabase (see `supabase/migrations/`)
4. Install dependencies: `npm install`
5. Build frontend: `npm run build`
6. Start server: `npm start`

## Development

```bash
npm run dev
```

This runs both the backend (nodemon) and frontend (Vite) concurrently.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (admin) |
| `NANOBANANA_API_KEY` | NanoBanana AI API key |
| `NANOBANANA_API_URL` | NanoBanana API endpoint |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) |
| `CLIENT_PAYWALL_PASSWORD` | Password clients enter to unlock results |
| `PORT` | Server port (default: 3000) |

## Database Setup

Run the SQL migration in `supabase/migrations/001_initial_schema.sql` in your Supabase project SQL editor.

## User Roles

- **Admin**: Full access to manage templates, couples, and generate merges
- **Client**: View-only access to their assigned couples (after entering paywall password)

## Deployment to Replit

1. Import this repo on Replit
2. Add all environment variables in Replit Secrets
3. Run `npm run build` to build the frontend
4. Click Run — the app starts with `npm start`

## Product Mockups

Generated iris art is displayed on:
- Photo frame (A4)
- Coffee mug
- Heat-reveal mug (animated CSS reveal)
- Charm/pendant
- Keychain
- Fridge magnet
- Cup coaster
