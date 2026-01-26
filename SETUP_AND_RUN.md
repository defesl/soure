# Setup and Run - Quick Guide

## ✅ One-Time Setup (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npm run prisma:generate

# 3. Create database tables
npm run prisma:migrate
```

**That's it!** The `.env` file is already configured with SQLite (no Supabase needed).

---

## ✅ Start the Server

```bash
npm start
```

Server runs at: `http://localhost:3000`

---

## ✅ Test the Application

### Quick Test Flow:

1. **Register**: Go to `http://localhost:3000/register`
   - Create an account
   - Should redirect to `/game`

2. **Create Game**: Click "Create Game"
   - Lobby appears with Game ID
   - Your player circle shows

3. **Start Game**: Click "Start Game"
   - Redirects to `/play/[gameId]`
   - Dice UI appears

4. **Roll Dice**: Click "Roll Dice"
   - See animation and result
   - Resources update

### Multiplayer Test:

1. **Player 1**: Create game → Note Game ID
2. **Player 2**: 
   - Open incognito window
   - Login with different account
   - Join by Game ID
3. **Both**: See 2 player circles → Creator starts → Both go to play page

---

## 🐛 Troubleshooting

### Server won't start:
- Check `.env` exists: `cat .env | grep DATABASE_URL`
- Should show: `DATABASE_URL="file:./dev.db"`
- Run: `npm run prisma:generate` then `npm run prisma:migrate`

### Registration/Login fails:
- Check server console for errors
- Verify database exists: `ls -la dev.db`
- Check browser console for network errors

### Game doesn't work:
- Check browser console
- Verify socket connection (network tab)
- Check you're logged in: `/api/me` should return user

---

## 📝 Files Created

- `dev.db` - SQLite database (local, no setup needed)
- `.sessions/` - Session storage (auto-created)

---

## 🚀 Ready to Test!

Run `npm start` and follow the test checklist in `MANUAL_TEST_CHECKLIST.md`
