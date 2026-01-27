# Project Structure

Where everything lives after cleanup.

## Root

| Item | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts (`npm start`, `npm run dev`). Entry: `server/server.js` |
| `README.md` | Main project docs, setup, how to run |
| `.env.example` | Template for env vars (copy to `.env`) |
| `.gitignore` | Ignore rules |
| `.nvmrc` | Node version hint (e.g. 20) |
| `prisma/` | Schema + migrations |
| `start.sh` | Optional: `node server/server.js` |

## Server (`/server`)

| File | Purpose |
|------|---------|
| `server.js` | Express app, routes, Socket.io, static from `/client` |
| `auth.js` | Login/register, session, uses `prismaClient` |
| `gameEngine.js` | Game logic (board, dice, breach, etc.) |
| `gameStore.js` | In-memory games, uses `gameEngine` |
| `prismaClient.js` | Prisma client singleton |

## Client (`/client`)

| File | Purpose |
|------|---------|
| `index.html` | Landing / menu |
| `login.html` | Login form |
| `register.html` | Register form |
| `game.html` | Lobby + in-game UI (route `/game`) |
| `game.js` | Lobby + in-game logic |
| `play.html` | Per-game session UI (route `/play/:gameId`) |
| `play.js` | Per-game session logic |
| `styles.css` | Shared styles |
| `assets/` | For future images / static assets |

All HTML/CSS/JS are served from `/client`; routes use `/`, `/login`, `/register`, `/game`, `/play/:gameId`.

## Docs (`/docs`)

Guides and notes (moved from root):

- `SETUP_AND_RUN.md`, `QUICK_START.md`, `START_SERVER.md`
- `DATABASE_SETUP.md`, `SETUP_DATABASE.md`, `SUPABASE_SETUP.md`
- `MIGRATION.md`, `MIGRATION_TO_SUPABASE.md`
- `CHANGELOG.md`, `TESTING_CHECKLIST.md`, `MANUAL_TEST_CHECKLIST.md`
- `SOURE_V1_IMPLEMENTATION.md`, `PLAY_PAGE_FIXES.md`, etc.

## Quick checklist

- **Frontend** → `client/` only (no copies in root).
- **Backend** → `server/` only (no copies in root).
- **Static files** → Server uses `clientPath = path.join(__dirname, "..", "client")`.
- **Routes** → `/` → `index.html`, `/login` → `login.html`, `/register` → `register.html`, `/game` → `game.html`, `/play/:gameId` → `play.html`.
- **Run** → `npm install` then `npm run dev` or `npm start` (see README).
