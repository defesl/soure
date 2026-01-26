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

### 3. Configure Database

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your database connection string from **Settings → Database**
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` and add your Supabase connection string:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
   ```

### 4. Run Database Migrations

```bash
npm run prisma:migrate
```

This creates all necessary tables in your database.

### 5. Start the Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

## Development Workflow

```bash
# One-time setup
npm run setup
npm run prisma:migrate

# Start development server
npm run dev
```

## Available Scripts

- `npm run dev` - Start the development server
- `npm run setup` - Install dependencies and generate Prisma client
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Create and apply database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:deploy` - Deploy migrations (production)

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
- Check `.env` file exists and has valid `DATABASE_URL`
- Run `npm run prisma:generate` before starting server
- Ensure database migrations are applied: `npm run prisma:migrate`

### Prisma errors

- Make sure you're using Prisma 6 (not 7)
- Delete `node_modules` and `package-lock.json`, then run `npm install`
- Check that `DATABASE_URL` in `.env` is correct

### Database connection errors

- Verify Supabase project is active
- Check connection string format in `.env`
- Ensure database password is correct

## License

ISC
