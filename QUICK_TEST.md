# Quick Test Steps - Soure OnlineGame

## ✅ SOLO MODE TEST

1. **Start Server**
   ```bash
   npm run dev
   ```

2. **Register/Login**
   - Go to `http://localhost:3000/register`
   - Create account (username + password)
   - Should redirect to home page

3. **Create Game**
   - Go to `/game`
   - Click **"Create Game"**
   - **Expected**: Lobby appears immediately with:
     - Your player circle
     - Game ID displayed
     - "Start Game" button visible

4. **Start Game**
   - Click **"Start Game"**
   - **Expected**: Redirects to `/play/<gameId>`
   - **Expected**: Dice UI appears in center
   - **Expected**: Bottom inventory bar shows resources (all 0)
   - **Expected**: Right sidebar shows player list with you

5. **Roll Dice**
   - Click **"Roll Dice"**
   - **Expected**: 
     - Dice animate (shake)
     - Two numbers appear (1-6 each)
     - Result shows: "Last roll: X + Y = Z"
     - Resources update (you get 1 random resource)
     - Inventory bar updates

---

## ✅ MULTIPLAYER TEST

1. **Player 1: Create Game**
   - Login → `/game` → Create Game
   - Note the Game ID

2. **Player 2: Join Game**
   - Open incognito/private window
   - Login with different account
   - Go to `/game`
   - Enter Game ID → Click "Join Game"
   - **Expected**: 
     - Lobby shows 2 player circles
     - Both see Game ID
     - Only creator sees "Start Game" button

3. **Start Game (Creator)**
   - Creator clicks "Start Game"
   - **Expected**: Both players redirect to `/play/<gameId>`
   - **Expected**: Both see dice UI
   - **Expected**: Both see player list with 2 players
   - **Expected**: Current player highlighted in player list

4. **Roll Dice (Current Player)**
   - Current player clicks "Roll Dice"
   - **Expected**: Both players see:
     - Dice animation
     - Result
     - Resources update for all players
     - Inventory bars update

5. **Privacy Test**
   - Try accessing `/play/<gameId>` with a third account (not in game)
   - **Expected**: Should fail to join or show error
   - Game state should NOT be visible to non-members

---

## 🐛 Common Issues

### Registration fails
- **Check**: `.env` file exists with `DATABASE_URL`
- **Check**: Run `npm run prisma:generate`
- **Check**: Run `npm run prisma:migrate`
- **Check**: Server terminal shows clear error if DATABASE_URL missing

### Can't join game
- **Check**: Game ID is correct (case-sensitive)
- **Check**: Game hasn't started yet (can only join in lobby)
- **Check**: Browser console for socket errors

### Game state not updating
- **Check**: Socket connection (network tab)
- **Check**: User is in correct socket room
- **Check**: Server terminal for errors

### Redirect doesn't work
- **Check**: Browser console for errors
- **Check**: `gameState` event is received
- **Check**: `state.phase !== "lobby"` after start

---

## ✅ Success Criteria

After all tests:
- ✅ Registration works (no DATABASE_URL errors)
- ✅ Lobby creates game instantly
- ✅ Start redirects to `/play/<gameId>`
- ✅ Dice center + roll button works
- ✅ Bottom resources bar shows correctly
- ✅ Right player list shows all players
- ✅ Another account can join by Game ID
- ✅ Game state only visible to players in room
- ✅ Solo mode works (1 player can start)
