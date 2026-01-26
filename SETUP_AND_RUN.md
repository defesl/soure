# Setup and Run Guide

Quick setup instructions to get the project running.

## Prerequisites

- Node.js 20+ (use `nvm use 20` if you have nvm)
- Supabase account and project

## Initial Setup (One-Time)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase connection string:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
SESSION_SECRET="your-random-secret-here"
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Run Database Migrations

```bash
npm run prisma:migrate:dev
```

This creates all necessary tables in your Supabase database.

## Running the Server

### Development Mode

```bash
npm run dev
```

Or:

```bash
npm start
```

The server will start at `http://localhost:3000`

## Available Commands

- `npm install` - Install all dependencies
- `npm start` or `npm run dev` - Start the development server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate:dev` - Create and apply database migrations (development)
- `npm run prisma:migrate:deploy` - Deploy migrations (production)
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Troubleshooting

### Server won't start

- Check `.env` file exists and has valid `DATABASE_URL`
- Verify `DATABASE_URL` is a valid Supabase PostgreSQL connection string
- Run `npm run prisma:generate` before starting server
- Ensure database migrations are applied: `npm run prisma:migrate:dev`

### Database connection errors

- Verify Supabase project is active
- Check connection string format in `.env`
- Ensure database password is correct
- If password has special characters, URL-encode them

## Project Structure

```
OnlineGame/
├── client/          # Frontend (HTML, CSS, JS)
├── server/          # Backend (Express, Socket.io)
│   ├── server.js    # Main server entry point
│   ├── auth.js       # Authentication logic
│   ├── gameEngine.js # Game logic
│   ├── gameStore.js  # Game state management
│   └── prismaClient.js # Prisma client setup
├── prisma/          # Database schema and migrations
├── .env             # Environment variables (not committed)
└── package.json     # Dependencies and scripts
```

## Production Deployment

For production (Render, Railway, Heroku):

1. Set `DATABASE_URL` environment variable
2. Set `SESSION_SECRET` environment variable
3. Run migrations:
   ```bash
   npm run prisma:migrate:deploy
   ```
4. Start server:
   ```bash
   npm start
   ```
