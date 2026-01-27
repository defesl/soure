# How to Start the Server

## Option 1: Use npm start (Recommended)
```bash
npm start
```

## Option 2: Use npm run dev
```bash
npm run dev
```

## Option 3: Use the shell script
```bash
./start.sh
```

## Option 4: Run directly with Node
```bash
node server/server.js
```

All methods do the same thing - they start the server.

---

## If you get "Missing script: dev" error:

1. **Make sure you're in the project directory:**
   ```bash
   cd /Users/ivankozyriev/Documents/OnlineGame
   ```

2. **Try using `npm start` instead:**
   ```bash
   npm start
   ```

3. **If that doesn't work, reinstall dependencies:**
   ```bash
   npm install
   npm start
   ```

4. **Or run directly:**
   ```bash
   node server/server.js
   ```

---

## Before Starting - Make Sure:

✅ `.env` file exists with your `DATABASE_URL`
✅ Run `npm run prisma:migrate` (first time only)
✅ Run `npm run prisma:generate` (if Prisma client is missing)
