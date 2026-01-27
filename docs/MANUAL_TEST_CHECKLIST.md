# Manual Test Checklist

Use this checklist to verify everything works after starting the server.

## ✅ Prerequisites Check

- [ ] Server starts without errors: `npm start`
- [ ] No DATABASE_URL errors in console
- [ ] Server shows: "Soure server running at http://localhost:3000"

---

## ✅ Authentication Tests

### Test 1: Registration
1. Go to `http://localhost:3000/register`
2. Enter username (3-20 chars) and password (6+ chars)
3. Click "Create account"
4. **Expected**: 
   - ✅ Success message appears: "Account created! Redirecting…"
   - ✅ Redirects to `/game` page
   - ✅ No errors in browser console
   - ✅ Server console shows: `[api] User registered: [username]`

### Test 2: Registration Error Handling
1. Try registering with same username again
2. **Expected**: 
   - ✅ Error message: "Error: Username already taken"
   - ✅ Stays on registration page
   - ✅ No redirect

### Test 3: Login
1. Go to `http://localhost:3000/login`
2. Enter registered credentials
3. Click "Login"
4. **Expected**:
   - ✅ Success message: "Logged in! Redirecting…"
   - ✅ Redirects to `/game` page
   - ✅ Server console shows: `[api] User logged in: [username]`

### Test 4: Login Error Handling
1. Try logging in with wrong password
2. **Expected**:
   - ✅ Error message: "Error: Invalid username or password"
   - ✅ Stays on login page
   - ✅ No redirect

### Test 5: Session Persistence
1. After logging in, refresh the page
2. **Expected**:
   - ✅ Still logged in
   - ✅ `/api/me` returns `{ ok: true, user: { id, username } }`

### Test 6: Logout
1. Click "Logout" button
2. **Expected**:
   - ✅ Redirects to `/login`
   - ✅ Session destroyed
   - ✅ `/api/me` returns `{ ok: true, user: null }`

---

## ✅ Game Lobby Tests

### Test 7: Create Game
1. Go to `/game` (must be logged in)
2. Click "Create Game"
3. **Expected**:
   - ✅ Lobby appears immediately
   - ✅ Game ID is displayed
   - ✅ Your player circle appears
   - ✅ "Start Game" button visible (you're creator)
   - ✅ Create/Join section hides

### Test 8: Lobby Player Circles
1. After creating game, verify:
   - ✅ Player circle shows your initials
   - ✅ Username displayed below circle
   - ✅ Creator circle has green border/glow
   - ✅ Game ID is clearly visible

---

## ✅ Solo Mode Tests

### Test 9: Start Solo Game
1. Create a game (you're the only player)
2. Click "Start Game"
3. **Expected**:
   - ✅ Redirects to `/play/[gameId]`
   - ✅ No errors about "need more players"
   - ✅ Game phase changes from "lobby" to "roll"

### Test 10: Solo Game UI
1. On `/play/[gameId]` page, verify:
   - ✅ Dice UI appears in center (two dice showing "?")
   - ✅ "Roll Dice" button visible
   - ✅ Bottom inventory bar shows all 6 resources (all 0)
   - ✅ Right sidebar shows player list with you
   - ✅ Game ID displayed in top header
   - ✅ "Copy" button works

### Test 11: Roll Dice (Solo)
1. Click "Roll Dice"
2. **Expected**:
   - ✅ Dice animate (shake/roll animation)
   - ✅ Two numbers appear (1-6 each)
   - ✅ Result shows: "Last roll: X + Y = Z"
   - ✅ Resources update (you get 1 random resource)
   - ✅ Inventory bar updates with new counts
   - ✅ Server console shows roll result

---

## ✅ Multiplayer Tests

### Test 12: Join Game
1. **Player 1**: Create game → Note Game ID
2. **Player 2**: 
   - Open incognito/private window
   - Login with different account
   - Go to `/game`
   - Enter Game ID → Click "Join Game"
3. **Expected** (both players):
   - ✅ Lobby shows 2 player circles
   - ✅ Both see same Game ID
   - ✅ Only creator sees "Start Game" button
   - ✅ Player 2 sees their circle added

### Test 13: Start Multiplayer Game
1. Creator clicks "Start Game"
2. **Expected** (both players):
   - ✅ Both redirect to `/play/[gameId]`
   - ✅ Both see dice UI
   - ✅ Both see player list with 2 players
   - ✅ Current player highlighted in list

### Test 14: Multiplayer Roll
1. Current player clicks "Roll Dice"
2. **Expected** (both players):
   - ✅ Both see dice animation
   - ✅ Both see same result
   - ✅ Both see resources update
   - ✅ Both inventory bars update
   - ✅ Current player changes after turn ends

---

## ✅ Privacy Tests

### Test 15: Game Privacy
1. **Player 3** (not in game):
   - Try to access `/play/[gameId]` with a game ID you're not in
2. **Expected**:
   - ✅ Error message: "Failed to join game" or "You are not a member"
   - ✅ Redirects to `/game` after 3 seconds
   - ✅ Cannot see game state

### Test 16: Socket Room Isolation
1. Create two separate games
2. **Expected**:
   - ✅ Players in Game A don't see Game B state
   - ✅ Only players in same room receive broadcasts

---

## ✅ UI/UX Tests

### Test 17: Error Messages
1. Try invalid actions (wrong password, invalid game ID, etc.)
2. **Expected**:
   - ✅ Clear error messages appear
   - ✅ Errors are styled (red alert)
   - ✅ Errors don't disappear immediately
   - ✅ No silent failures

### Test 18: Responsive Design
1. Resize browser window
2. **Expected**:
   - ✅ Layout adapts (sidebar stacks on mobile)
   - ✅ All buttons/inputs remain usable
   - ✅ Inventory bar stays visible

---

## ✅ Edge Cases

### Test 19: Network Errors
1. Stop server, try to register/login
2. **Expected**:
   - ✅ Clear error: "Network error: Could not connect to server"
   - ✅ No silent failures
   - ✅ Form remains usable

### Test 20: Invalid Input
1. Try registering with:
   - Username < 3 chars
   - Password < 6 chars
   - Empty fields
2. **Expected**:
   - ✅ Clear validation errors
   - ✅ No server requests sent for invalid input

---

## 🐛 If Tests Fail

### Registration/Login fails:
- Check server console for errors
- Verify database is created: `ls -la dev.db`
- Check `.env` has `DATABASE_URL="file:./dev.db"`
- Run `npm run prisma:migrate` again

### Game doesn't start:
- Check browser console for errors
- Verify socket connection (network tab)
- Check server console for socket errors

### Redirect doesn't work:
- Check browser console
- Verify `gameState` event is received
- Check `state.phase !== "lobby"` after start

---

## ✅ Success Criteria

After all tests pass:
- ✅ Registration works with clear success/error messages
- ✅ Login works with clear success/error messages
- ✅ Sessions persist across page refreshes
- ✅ Create Game shows lobby immediately
- ✅ Start Game redirects to play page
- ✅ Solo mode works (1 player can start)
- ✅ Multiplayer join works
- ✅ Dice roll works and updates resources
- ✅ Game state only visible to room members
- ✅ All errors are visible (no silent failures)
