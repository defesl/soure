# Soure v1 Core Rules Implementation

## ✅ Completed Features

### 1. Board Generation (19 Hex Tiles)
- ✅ Randomized board generation on game start
- ✅ Tile distribution: Stone×5, Food×4, Water×3, Iron×3, Gold×3, CentralMarket×1
- ✅ Number tokens randomized (2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12)
- ✅ 6 and 8 cannot be adjacent (validation implemented)
- ✅ Board state stored in `game.board`

### 2. Player Resources (Per Player)
- ✅ Each player has independent resources: `{ stone, iron, food, water, gold }`
- ✅ Resources tracked per `playerId` in `game.resources[playerId]`
- ✅ Resources distributed only to players with buildings on activated tiles

### 3. Population System
- ✅ Removed "people" as a resource
- ✅ Each player has: `population: { max: 3, used: 0 }`
- ✅ Population is a building capacity limit
- ✅ Buildings consume population (Outpost, Bastion = 1 each)
- ✅ Upgrades add capacity (Citadel +2, Capital +3)

### 4. Buildings
- ✅ **Outpost**: 1 stone, 1 water → 1 DP, uses 1 population
- ✅ **Citadel**: 2 stone, 2 food → upgrades Outpost, +2 DP, +2 population capacity
- ✅ **Capital**: 3 stone, 3 iron, 2 gold → upgrades Citadel, +4 DP, +3 population capacity, immune to Breach
- ✅ **Bastion**: 1 iron, 1 food → +1 defense, uses 1 population
- ✅ Buildings stored on tiles: `tile.buildings = [{ playerId, type }]`

### 5. Tile Placement + Ownership
- ✅ Players place buildings directly ON tiles (MVP simplification)
- ✅ Each tile can hold multiple buildings (one per player)
- ✅ Building ownership tracked per tile

### 6. Dice Roll → Resource Production
- ✅ When number is rolled, find all tiles with that number
- ✅ For each building on activated tile:
  - Outpost → +1 resource
  - Citadel → +2 resources
  - Capital → +3 resources
- ✅ Resources distributed based on tile type (stone tile → stone resource)
- ✅ Blocked tiles produce nothing

### 7. Breach Event (Roll = 7)
- ✅ Every player WITHOUT Bastion loses 2 random resources
- ✅ If player has 8+ DP and defense < 2 → lose 4 resources
- ✅ Capital owners are immune
- ✅ Roller chooses a tile to block
- ✅ Blocked tile produces nothing until next Breach

### 8. Market Trading
- ✅ CentralMarket tile exists (no number token)
- ✅ Trading logic prepared (backend ready, UI can be added later)

### 9. UI Requirements
- ✅ Board rendered on `/game` page (19 hex tiles)
- ✅ Each tile shows: resource type, number token, buildings
- ✅ Layout: Center board, Right dice+actions, Left player list, Bottom resources
- ✅ Player list shows: DP, Population, Defense, Resources
- ✅ Building placement UI with selection
- ✅ Breach panel for tile blocking

### 10. Game State Persistence
- ✅ All state stored server-side: board, buildings, resources, population, DP, defense
- ✅ Reconnecting players can resume

## Files Modified

**Backend:**
- `server/gameEngine.js` - Complete rewrite with board generation, buildings, population, breach
- `server/server.js` - Added `placeBuilding` and `blockTile` socket handlers

**Frontend:**
- `client/game.html` - Updated layout for board game UI
- `client/game.js` - Added board rendering, building placement, breach handling
- `client/play.js` - Updated resources array
- `client/styles.css` - Added board, hex tile, building styles

## Testing Checklist

1. ✅ Create game → Board generates with 19 tiles
2. ✅ Start game → Board visible, dice ready
3. ✅ Roll dice → Resources distributed to players with buildings
4. ✅ Place Outpost → Costs resources, uses population, gives DP
5. ✅ Roll 7 → Breach triggers, players lose resources, tile blocking works
6. ✅ Upgrade Outpost → Citadel → Capital works
7. ✅ Solo mode works (1 player can start)
8. ✅ Multiplayer works (multiple players can join)

## Known Limitations (MVP)

- Building placement is on tiles (not intersections) - simplified for MVP
- Market trading UI not yet implemented (backend ready)
- Hex board uses flex layout (not true hex grid) - works but not perfect hex pattern
- Building upgrades require clicking same tile (UI could be improved)

## Next Steps (Future)

- True hex intersection placement
- Market trading UI
- Better hex board visualization
- Building upgrade UI improvements
- Victory conditions (DP-based)
