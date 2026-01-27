# Database Migration Guide: JSON to Supabase Postgres

This guide will help you migrate from `users.json` to Supabase Postgres using Prisma.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project with a Postgres database
3. Node.js and npm installed

## Step 1: Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database**
3. Find your **Connection string** (URI format)
4. Copy the connection string (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`)

## Step 2: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase connection string:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
   ```

   **Important:** Replace `YOUR_PASSWORD` with your actual Supabase database password.

## Step 3: Generate Prisma Client

Generate the Prisma Client based on your schema:

```bash
npm run prisma:generate
```

Or directly:
```bash
npx prisma generate
```

## Step 4: Run Database Migrations

Create and apply the initial migration to set up your database tables:

```bash
npm run prisma:migrate
```

Or directly:
```bash
npx prisma migrate dev --name init
```

This will:
- Create the `users`, `matches`, `match_players`, and `friends` tables
- Apply the schema to your database
- Generate the Prisma Client

**Note:** For production deployments, use:
```bash
npm run prisma:deploy
```

## Step 5: (Optional) Migrate Existing Users

If you have existing users in `users.json` that you want to migrate:

1. The old `users.json` file is still present but no longer used
2. You can manually migrate users by:
   - Registering them again through the app, OR
   - Using Prisma Studio to import data:
     ```bash
     npm run prisma:studio
     ```
   - Or write a one-time migration script

## Step 6: Verify Installation

1. Start the server:
   ```bash
   npm start
   ```

2. Test registration:
   - Go to `http://localhost:3000/register`
   - Create a new account
   - Check Supabase dashboard → Table Editor → `users` table to see the new user

3. Test login:
   - Log in with the account you just created
   - Verify session works correctly

## Testing Checklist

### ✅ Authentication Tests

- [ ] **Register new user**
  - Go to `/register`
  - Create account with username and password
  - Verify user appears in Supabase `users` table
  - Verify session is created

- [ ] **Login existing user**
  - Go to `/login`
  - Log in with registered credentials
  - Verify session persists
  - Verify user object contains `{ id, username }`

- [ ] **Username uniqueness**
  - Try registering the same username twice
  - Verify error: "Username already taken"

- [ ] **Invalid credentials**
  - Try logging in with wrong password
  - Verify error: "Invalid username or password"

### ✅ Gameplay Tests

- [ ] **Solo mode (minPlayers = 1)**
  - Create a game
  - Start match with only 1 player
  - Verify match starts successfully

- [ ] **Multiplayer join by Game ID**
  - Create a game (note the Game ID)
  - Have second player join using Game ID
  - Verify both players can play

- [ ] **UI improvements**
  - Verify bottom inventory bar is visible
  - Verify dice visualization is centered
  - Verify left sidebar tabs: Game / Friends / Resources

### ✅ Database Tests

- [ ] **User creation in database**
  - Register a user
  - Check Supabase dashboard → `users` table
  - Verify: `id`, `username`, `passwordHash`, `createdAt` are present
  - Verify username is stored lowercase

- [ ] **Session persistence**
  - Log in and refresh page
  - Verify you remain logged in
  - Verify `/api/me` returns user object

## Troubleshooting

### Error: "Can't reach database server"

- Check your `DATABASE_URL` in `.env`
- Verify Supabase project is active
- Check network connectivity

### Error: "P2002: Unique constraint failed"

- Username already exists in database
- This is expected behavior for duplicate registrations

### Error: "PrismaClient is not configured"

- Run `npm run prisma:generate`
- Restart the server

### Sessions not persisting

- Sessions are still file-based (stored in `.sessions/`)
- This is intentional and separate from user storage
- Check `.sessions/` directory exists and is writable

## Production Deployment

For production:

1. Set `DATABASE_URL` environment variable on your hosting platform
2. Run migrations:
   ```bash
   npm run prisma:deploy
   ```
3. Ensure Prisma Client is generated:
   ```bash
   npm run prisma:generate
   ```

## Next Steps

- The `users.json` file is no longer needed and can be deleted
- Future features can use:
  - `Match` table for game history
  - `MatchPlayer` table for player participation
  - `Friend` table for social features

## Useful Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and apply migration
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Deploy migrations (production)
npm run prisma:deploy
```
