# Soure — Online Strategy Game

An online strategy game with resources, diplomacy, and barbarians.

## Prerequisites

- **Node.js 20** (required - use Node Version Manager if needed)
- **Supabase account** (for PostgreSQL database)
- **npm** (comes with Node.js)

## Quick Setup

### 1. Install Node 20

Using nvm (recommended):
```bash
nvm install 20
nvm use 20
```

Or download from [nodejs.org](https://nodejs.org/)

### 2. Clone and Install Dependencies

```bash
npm run setup
```

This installs dependencies and generates the Prisma client.

### 3. Connect to Supabase Database

**REQUIRED**: The project uses **Supabase PostgreSQL** - you must set up a database connection.

#### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in project details (name, database password, region)
4. Wait for project to be created (~2 minutes)

#### Step 2: Get Connection String

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll to **"Connection string"** section
3. Select the **"URI"** tab (not "Session mode")
4. Copy the connection string (looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```

#### Step 3: Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and paste your Supabase connection string:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
   ```
   
   **Important**: 
   - Replace `YOUR_ACTUAL_PASSWORD` with your Supabase database password
   - Replace `db.xxxxx.supabase.co` with your actual Supabase host
   - If password has special characters, URL-encode them:
     - `@` → `%40`
     - `#` → `%23`
     - `$` → `%24`
     - etc.

3. (Optional) Set a session secret:
   ```env
   SESSION_SECRET="your-random-secret-here"
   ```

#### Step 4: Run Database Migrations

```bash
npm run prisma:migrate:dev
```

This creates all necessary tables in your Supabase database:
- `users` - User accounts
- `matches` - Game matches
- `match_players` - Player participation
- `friends` - Friend relationships

### 4. Start the Server

```bash
npm start
```

The server will start at `http://localhost:3000`

**Note**: The server will exit with a clear error if `DATABASE_URL` is missing or invalid.

## Development Workflow

```bash
# One-time setup
npm run setup
npm run prisma:migrate:dev

# Start development server
npm start
# or
npm run dev
```

## Production Deployment

For production (e.g., Render, Railway, Heroku):

1. Set `DATABASE_URL` environment variable on your hosting platform
2. Set `SESSION_SECRET` environment variable
3. Run migrations:
   ```bash
   npm run prisma:migrate:deploy
   ```
4. Start server:
   ```bash
   npm start
   ```

## Available Scripts

- `npm start` or `npm run dev` - Start the development server
- `npm run setup` - Install dependencies and generate Prisma client
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate:dev` - Create and apply database migrations (development)
- `npm run prisma:migrate` - Alias for `prisma:migrate:dev`
- `npm run prisma:migrate:deploy` - Deploy migrations (production)
- `npm run prisma:deploy` - Alias for `prisma:migrate:deploy`
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Project Structure

```
OnlineGame/
├── client/          # Frontend (HTML, CSS, JS)
├── server/          # Backend (Express, Socket.io)
├── prisma/          # Database schema
├── .env             # Environment variables (not committed)
└── package.json     # Dependencies and scripts
```

## Features

- User authentication with PostgreSQL
- Real-time multiplayer gameplay via Socket.io
- Solo mode support (1 player minimum)
- Resource management (Clay, Flint, Sand, Water, Cattle, People)
- Trade offers and diplomacy
- Barbarian events on dice roll of 8

## Troubleshooting

### Server won't start

- Ensure Node.js version is 20: `node --version`
- Check `.env` file exists and has valid `DATABASE_URL` (Supabase PostgreSQL)
- Verify `DATABASE_URL` is not a placeholder or SQLite format
- Run `npm run prisma:generate` before starting server
- Ensure database migrations are applied: `npm run prisma:migrate:dev`
- Check server console for specific error messages

### Prisma errors

- Make sure you're using Prisma 6 (not 7)
- Delete `node_modules` and `package-lock.json`, then run `npm install`
- Check that `DATABASE_URL` in `.env` is correct

### Database connection errors

- Verify Supabase project is active and database is ready
- Check connection string format in `.env` (must be PostgreSQL URI)
- Ensure database password is correct
- If password has special characters, URL-encode them
- Verify connection string uses port `5432` (direct connection) or `6543` (pooler)
- Test connection in Supabase dashboard → Settings → Database

## License

ISC
