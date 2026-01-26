# Supabase Setup Guide

## Quick Setup (5 minutes)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create account
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: e.g., "soure-game"
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
5. Click **"Create new project"**
6. Wait ~2 minutes for project to be created

### 2. Get Connection String

1. In your project dashboard, click **Settings** (gear icon)
2. Click **Database** in left sidebar
3. Scroll to **"Connection string"** section
4. Select **"URI"** tab (not "Session mode" or "Transaction")
5. Copy the connection string

It will look like:
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

Or the direct connection:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Either format works** - use the one you prefer.

### 3. Configure .env File

1. In your project root, create or edit `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and paste your connection string:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
   ```

3. Replace `YOUR_PASSWORD` with your actual database password

4. (Optional) Set session secret:
   ```env
   SESSION_SECRET="your-random-secret-here-change-in-production"
   ```

### 4. Handle Special Characters in Password

If your password contains special characters, URL-encode them:

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `/` | `%2F` |
| `:` | `%3A` |
| `?` | `%3F` |
| `=` | `%3D` |
| ` ` (space) | `%20` |

**Example:**
- Password: `p@ssw0rd#123`
- Encoded: `p%40ssw0rd%23123`
- Connection string: `postgresql://postgres:p%40ssw0rd%23123@db.xxxxx.supabase.co:5432/postgres`

**Alternative**: Use Supabase connection pooler (handles special chars automatically)

### 5. Run Migrations

```bash
npm run prisma:migrate:dev
```

This will:
- Create all tables in your Supabase database
- Generate Prisma Client
- Show migration status

### 6. Verify Setup

1. Start server:
   ```bash
   npm start
   ```

2. Test registration:
   - Go to `http://localhost:3000/register`
   - Create an account
   - Check Supabase dashboard → Table Editor → `users` table
   - You should see your new user!

---

## Troubleshooting

### "DATABASE_URL must be a valid Supabase PostgreSQL connection string"

- Check `.env` file exists
- Verify `DATABASE_URL` starts with `postgresql://`
- Ensure it's not `file:./dev.db` (SQLite format)
- Check for placeholder values like `USER:PASSWORD@HOST`

### "Invalid DATABASE_URL format"

- Verify format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
- Check port number is present (5432 or 6543)
- Ensure password is URL-encoded if it has special characters
- Verify quotes around the URL in `.env`

### "Can't reach database server"

- Check Supabase project is active (not paused)
- Verify connection string is correct
- Check network connectivity
- Try using connection pooler instead of direct connection

### Migration fails

- Ensure database password is correct
- Check Supabase project is ready (not still provisioning)
- Verify connection string format
- Try running: `npm run prisma:generate` first

---

## Connection String Formats

### Direct Connection (Port 5432)
```
postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

### Connection Pooler (Port 6543) - Recommended
```
postgresql://postgres.xxxxx:PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Use pooler if:**
- Your password has many special characters
- You want better connection management
- You're deploying to production

---

## Production Deployment

When deploying to Render/Railway/Heroku:

1. Set `DATABASE_URL` environment variable (not in code!)
2. Set `SESSION_SECRET` environment variable
3. Run migrations:
   ```bash
   npm run prisma:migrate:deploy
   ```
4. Start server:
   ```bash
   npm start
   ```

**Never commit `.env` file to git!**

---

## Next Steps

After setup:
- ✅ Test registration
- ✅ Test login
- ✅ Create a game
- ✅ Verify data appears in Supabase dashboard

Your database is now ready for production use! 🚀
