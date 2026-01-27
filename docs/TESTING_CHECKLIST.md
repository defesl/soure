# Testing Checklist - Soure OnlineGame

## ✅ Registration & Authentication

### Test Registration
1. Go to `/register`
2. Enter username (3-20 chars) and password (6+ chars)
3. Click "Create account"
4. **Expected**: Success message, redirects to home page
5. **If error**: Check server terminal for Prisma/database errors

### Test Login
1. Go to `/login`
2. Enter registered credentials
3. Click "Login"
4. **Expected**: Redirects to home, shows "Logged in as [username]"

### Common Registration Issues
- **"Database connection failed"**: Check `.env` has valid `DATABASE_URL`
- **"Registration failed"**: Check Prisma client is generated (`npm run prisma:generate`)
- **"Username already taken"**: Try different username

---

## ✅ Solo Mode (1 Player)

### Test Solo Game Flow
1. Login
2. Go to `/game`
3. Click **"Create Game"**
4. **Expected**: 
   - Lobby appears immediately
   - Game ID is displayed
   - Your player circle appears
   - "Start Game" button is visible (you're the creator)
5. Click **"Start Game"**
6. **Expected**:
   - Game phase changes to "roll"
   - Dice UI appears in center (two dice showing "?")
   - "Roll Dice" button appears
   - Bottom inventory bar shows your resources (all 0 initially)
7. Click **"Roll Dice"**
8. **Expected**:
   - Dice animate (shake/roll)
   - Dice show two numbers (1-6 each)
   - Result shows: "Last roll: X + Y = Z"
   - Resources update (everyone gets 1 random resource)
   - Inventory bar updates

---

## ✅ Multiplayer Mode

### Test Multiplayer Join
1. **Player 1**: Login → Create Game → Note the Game ID
2. **Player 2**: 
   - Open incognito/private window
   - Login with different account
   - Go to `/game`
   - Enter Game ID in input field
   - Click **"Join Game"**
3. **Expected** (both players):
   - Lobby shows 2 player circles
   - Each circle shows initials and username
   - Creator circle has green border
   - Game ID visible
   - Only creator sees "Start Game" button

### Test Multiplayer Game Start
1. Creator clicks **"Start Game"**
2. **Expected** (both players):
   - Game phase changes
   - Dice UI appears
   - Current player sees "Roll Dice" button
   - Other players see game state but no action buttons

---

## ✅ UI Components

### Lobby Player Circles
- [ ] Circles are circular (not square)
- [ ] Show username initials (first 2 letters)
- [ ] Username displayed below circle
- [ ] Creator circle has green border/glow
- [ ] Circles update when players join/leave
- [ ] Hover effect works

### Dice UI
- [ ] Two dice centered on screen
- [ ] Dice have rounded corners
- [ ] Dice have purple border/glow
- [ ] Roll animation works (shake effect)
- [ ] Shows numbers after roll
- [ ] Result text shows: "Last roll: X + Y = Z"
- [ ] Doubles message appears if applicable

### Bottom Inventory Bar
- [ ] Fixed at bottom of screen
- [ ] Shows "My Resources:" label
- [ ] Shows all 6 resources: Clay, Flint, Sand, Water, Cattle, People
- [ ] Resources with count > 0 have green highlight
- [ ] Resources with count = 0 are muted
- [ ] Updates when resources change
- [ ] Doesn't overlap game content

### Start Game Button
- [ ] Only visible to creator in lobby
- [ ] Purple primary button style
- [ ] Starts game when clicked
- [ ] Disappears after game starts

---

## ✅ Game Flow

### Complete Solo Game Test
1. Login
2. Create Game → See lobby
3. Start Game → See dice UI
4. Roll Dice → See result + resources update
5. End Turn (if applicable)
6. Roll again → See new result

### Complete Multiplayer Test
1. Player 1: Create Game
2. Player 2: Join Game (by ID)
3. Both see 2 circles in lobby
4. Creator starts game
5. Both see dice UI
6. Current player rolls
7. Both see result
8. Resources update for all players

---

## 🐛 Common Issues & Fixes

### Registration doesn't work
- Check `.env` file exists with `DATABASE_URL`
- Run `npm run prisma:generate`
- Run `npm run prisma:migrate`
- Check server terminal for errors

### Create Game doesn't show lobby
- Check browser console for errors
- Verify socket connection (check network tab)
- Ensure `gameState` event is received

### Player circles don't appear
- Check `state.players` array in browser console
- Verify `user.id` matches `state.players[].id`
- Check CSS classes are applied

### Dice don't animate
- Check `rollResult` event is received
- Verify dice elements exist in DOM
- Check CSS animation is defined

### Inventory bar doesn't show
- Check `state.resources[user.id]` exists
- Verify `user.id` is correct
- Check inventory bar element exists

### Solo mode doesn't work
- Verify `minPlayers = 1` in `gameStore.js`
- Check `startMatch` allows 1 player
- Check server terminal for errors

---

## 📝 Quick Test Commands

```bash
# Start server
npm run dev

# Check Prisma client
npm run prisma:generate

# Check database migrations
npm run prisma:migrate

# View database (optional)
npm run prisma:studio
```

---

## ✅ Success Criteria

After all tests pass:
- ✅ Registration works reliably
- ✅ Login works
- ✅ Create Game instantly shows lobby
- ✅ Lobby shows players as circles
- ✅ Start Game works with 1 player (solo)
- ✅ Start Game works with 2+ players (multiplayer)
- ✅ Dice appear in center and roll generates numbers with animation
- ✅ Inventory bar shows resources
- ✅ All UI elements are responsive and styled correctly
