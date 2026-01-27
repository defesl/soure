# Database Setup Guide

## Quick Fix for Connection String Errors

### Step 1: Get Your Supabase Connection String

1. Go to [supabase.com](https://supabase.com) → Your Project
2. **Settings** → **Database**
3. Scroll to **"Connection string"** section
4. Select **"URI"** tab (not Session mode)
5. Copy the connection string

It should look like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

### Step 2: Update `.env` File

Open `/Users/ivankozyriev/Documents/OnlineGame/.env` and replace the placeholder:

```env
DATABASE_URL="postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

**Important:**
- Replace `YOUR_ACTUAL_PASSWORD` with your real Supabase database password
- Replace `db.xxxxx.supabase.co` with your actual Supabase host
- **Keep the quotes** around the URL
- Port should be `5432` (default PostgreSQL port)

### Step 3: Handle Special Characters in Password

If your password contains special characters, you need to URL-encode them:

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

### Step 4: Alternative - Use Connection Pooler

If your password has many special characters, use Supabase's connection pooler:

1. In Supabase Dashboard → Settings → Database
2. Find **"Connection pooling"** section
3. Copy the **"Connection string"** (URI format)
4. It will look like:
   ```
   postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```
5. Use this in your `.env` file (port will be 6543, not 5432)

### Step 5: Verify Format

Your connection string must have this exact format:
```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
```

All parts required:
- ✅ Protocol: `postgresql://`
- ✅ Username: `postgres` (usually)
- ✅ Password: Your password (URL-encoded if needed)
- ✅ Host: `db.xxxxx.supabase.co` or pooler host
- ✅ Port: `5432` (direct) or `6543` (pooler) - **must be a number**
- ✅ Database: `postgres` (usually)

### Step 6: Test Connection

After updating `.env`, restart the server:

```bash
npm run dev
```

If you still get errors, check:
1. ✅ `.env` file exists in project root
2. ✅ Connection string is on one line (no line breaks)
3. ✅ Quotes are around the URL
4. ✅ Port number is present and valid (5432 or 6543)
5. ✅ No extra spaces or characters

### Common Errors & Fixes

**Error: "invalid port number"**
- ❌ Missing port: `postgresql://user:pass@host/db`
- ✅ Correct: `postgresql://user:pass@host:5432/db`

**Error: "invalid connection string"**
- ❌ Missing quotes: `DATABASE_URL=postgresql://...`
- ✅ Correct: `DATABASE_URL="postgresql://..."`

**Error: "authentication failed"**
- Check password is correct
- Check password special characters are URL-encoded
- Try using connection pooler instead

### Still Having Issues?

1. Check your `.env` file:
   ```bash
   cat .env | grep DATABASE_URL
   ```

2. Verify format manually:
   - Should start with `postgresql://`
   - Should have `:` after username
   - Should have `@` after password
   - Should have `:` before port
   - Should have `/` before database name

3. Test with a simple password first (change it in Supabase temporarily)

4. Use Supabase connection pooler (handles special chars better)
