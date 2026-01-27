"use strict";

const RESOURCE_TYPES = ["stone", "iron", "food", "water", "gold", "people"]; // MVP: includes people for testing
const BUILDING_TYPES = ["outpost", "citadel", "capital", "bastion"];

// Number tokens for tiles (excluding CentralMarket)
const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// Hex board layout (19 tiles in a hex pattern)
// Adjacency: each tile has neighbors (for 6/8 rule)
const HEX_ADJACENCY = [
  [1, 3, 4],           // 0
  [0, 2, 4, 5],        // 1
  [1, 5, 6],           // 2
  [0, 4, 7, 8],        // 3
  [0, 1, 3, 5, 8, 9],  // 4 (center)
  [1, 2, 4, 6, 9, 10], // 5
  [2, 5, 10, 11],      // 6
  [3, 8, 12, 13],      // 7
  [3, 4, 7, 9, 13, 14], // 8
  [4, 5, 8, 10, 14, 15], // 9
  [5, 6, 9, 11, 15, 16], // 10
  [6, 10, 16, 17],     // 11
  [7, 13, 18],         // 12
  [7, 8, 12, 14, 18],  // 13
  [8, 9, 13, 15, 18],  // 14
  [9, 10, 14, 16, 18], // 15
  [10, 11, 15, 17, 18], // 16
  [11, 16, 18],        // 17
  [12, 13, 14, 15, 16, 17] // 18 (CentralMarket)
];

function emptyResources() {
  return { stone: 0, iron: 0, food: 0, water: 0, gold: 0, people: 0 }; // MVP: includes people
}

function totalResources(res) {
  return RESOURCE_TYPES.reduce((s, t) => s + res[t], 0);
}

function randomDiscard(res, count) {
  const arr = [];
  RESOURCE_TYPES.forEach((t) => {
    for (let i = 0; i < res[t]; i++) arr.push(t);
  });
  let removed = 0;
  while (removed < count && arr.length > 0) {
    const idx = Math.floor(Math.random() * arr.length);
    const t = arr[idx];
    arr.splice(idx, 1);
    res[t] -= 1;
    removed += 1;
  }
}

function addToLog(log, msg) {
  log.push({ t: Date.now(), msg });
  if (log.length > 50) log.shift();
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateBoard() {
  // Tile distribution (MVP: includes People for testing)
  const tileTypes = [
    ...Array(5).fill("stone"),
    ...Array(4).fill("food"),
    ...Array(3).fill("water"),
    ...Array(3).fill("iron"),
    ...Array(3).fill("gold"),
    "people", // MVP test tile
    "market" // CentralMarket
  ];
  
  // Shuffle tile types
  const shuffledTypes = shuffleArray(tileTypes);
  
  // Create tiles
  const tiles = shuffledTypes.map((type, id) => ({
    id,
    type,
    number: null,
    buildings: [] // [{ playerId, type }]
  }));
  
  // Find market tile and set number to null
  const marketTile = tiles.find(t => t.type === "market");
  if (marketTile) {
    marketTile.number = null;
  }
  
  // Assign numbers to non-market tiles
  const numberTokens = shuffleArray(NUMBER_TOKENS);
  let tokenIndex = 0;
  
  // Assign numbers ensuring 6 and 8 are not adjacent
  const tilesToNumber = tiles.filter(t => t.type !== "market");
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const shuffledNumbers = shuffleArray(NUMBER_TOKENS);
    let valid = true;
    
    for (let i = 0; i < tilesToNumber.length; i++) {
      tilesToNumber[i].number = shuffledNumbers[i];
    }
    
    // Check 6/8 adjacency rule
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (tile.number === 6 || tile.number === 8) {
        const neighbors = HEX_ADJACENCY[i] || [];
        for (const neighborId of neighbors) {
          const neighbor = tiles[neighborId];
          if (neighbor && (neighbor.number === 6 || neighbor.number === 8)) {
            valid = false;
            break;
          }
        }
        if (!valid) break;
      }
    }
    
    if (valid) {
      break;
    }
    
    attempts++;
    // Reset numbers
    tilesToNumber.forEach(t => t.number = null);
  }
  
  // If still invalid after max attempts, assign anyway (fallback)
  if (attempts >= maxAttempts) {
    const shuffledNumbers = shuffleArray(NUMBER_TOKENS);
    for (let i = 0; i < tilesToNumber.length; i++) {
      tilesToNumber[i].number = shuffledNumbers[i];
    }
  }
  
  return {
    tiles,
    blockedTileId: null
  };
}

class SoureGame {
  /**
   * @param {string} gameId
   * @param {{ minPlayers?: number, maxPlayers?: number }} opts
   */
  constructor(gameId, opts = {}) {
    this.gameId = gameId;
    this.minPlayers = opts.minPlayers ?? 1;
    this.maxPlayers = opts.maxPlayers ?? 4;
    this.players = [];
    this.currentTurnIndex = 0;
    this.resources = {}; // playerId -> { stone, iron, food, water, gold }
    this.population = {}; // playerId -> { max: 3, used: 0 }
    this.dominionPoints = {}; // playerId -> number
    this.defenseLevel = {}; // playerId -> number
    this.phase = "lobby";
    this.lastRoll = null;
    this.extraTurn = false;
    this.eventLog = [];
    this.creatorId = null;
    this.matchStartTime = null;
    this.board = null; // Will be generated on startMatch
  }

  /**
   * @param {string} id
   * @param {string} name
   */
  addPlayer(id, name) {
    if (this.players.some((p) => p.id === id)) return;
    this.players.push({ id, name });
    this.resources[id] = emptyResources();
    this.population[id] = { max: 3, used: 0 };
    this.dominionPoints[id] = 0;
    this.defenseLevel[id] = 0;
    addToLog(this.eventLog, `${name} joined the game.`);
  }

  /**
   * @param {string} userId
   * @returns {{ ok: boolean, error?: string }}
   */
  startMatch(userId) {
    if (this.phase !== "lobby") {
      return { ok: false, error: "Game already started" };
    }
    if (this.creatorId !== userId) {
      return { ok: false, error: "Only the creator can start the match" };
    }
    if (this.players.length < this.minPlayers) {
      return { ok: false, error: `Need at least ${this.minPlayers} players to start` };
    }
    
    // Generate board
    this.board = generateBoard();
    
    // Give starting resources to all players (MVP)
    this.players.forEach((player) => {
      this.resources[player.id].stone += 1;
      this.resources[player.id].water += 1;
      this.resources[player.id].food += 1;
      addToLog(this.eventLog, `${player.name} received starting resources: 1 stone, 1 water, 1 food.`);
      console.log(`[gameEngine] Gave starting resources to ${player.name}`);
    });
    
    this.phase = "roll";
    this.currentTurnIndex = 0;
    this.matchStartTime = Date.now();
    const current = this.players[this.currentTurnIndex];
    addToLog(this.eventLog, `Match started! Board generated. ${current.name} goes first.`);
    return { ok: true };
  }

  /**
   * @param {string} userId
   * @param {number} tileId
   * @param {string} buildingType
   * @returns {{ ok: boolean, error?: string }}
   */
  placeBuilding(userId, tileId, buildingType) {
    if (this.phase !== "main") {
      return { ok: false, error: "Can only build during main phase" };
    }
    const current = this.players[this.currentTurnIndex];
    if (current.id !== userId) {
      return { ok: false, error: "Only the current player can build" };
    }
    
    if (!BUILDING_TYPES.includes(buildingType)) {
      return { ok: false, error: "Invalid building type" };
    }
    
    const tile = this.board.tiles[tileId];
    if (!tile) {
      return { ok: false, error: "Invalid tile" };
    }
    
    // Check if player already has building on this tile
    const existingBuilding = tile.buildings.find(b => b.playerId === userId);
    
    const playerRes = this.resources[userId];
    const playerPop = this.population[userId];
    
    // Check costs and requirements
    let cost = {};
    let populationRequired = 0;
    let populationCapacity = 0;
    let dpGain = 0;
    let defenseGain = 0;
    let isUpgrade = false;
    
    if (buildingType === "outpost") {
      if (existingBuilding) {
        return { ok: false, error: "You already have a building on this tile" };
      }
      cost = { stone: 1, water: 1 };
      populationRequired = 1;
      dpGain = 1;
    } else if (buildingType === "citadel") {
      // Must upgrade existing outpost
      if (!existingBuilding || existingBuilding.type !== "outpost") {
        return { ok: false, error: "Citadel must upgrade an existing Outpost" };
      }
      isUpgrade = true;
      cost = { stone: 2, food: 2 };
      populationCapacity = 2;
      dpGain = 2;
      // Remove old outpost DP (was 1)
      this.dominionPoints[userId] -= 1;
    } else if (buildingType === "capital") {
      // Must upgrade existing citadel
      if (!existingBuilding || existingBuilding.type !== "citadel") {
        return { ok: false, error: "Capital must upgrade an existing Citadel" };
      }
      isUpgrade = true;
      cost = { stone: 3, iron: 3, gold: 2 };
      populationCapacity = 3;
      dpGain = 4;
      // Remove old citadel DP (was 2)
      this.dominionPoints[userId] -= 2;
    } else if (buildingType === "bastion") {
      if (existingBuilding) {
        return { ok: false, error: "You already have a building on this tile" };
      }
      cost = { iron: 1, food: 1 };
      populationRequired = 1;
      defenseGain = 1;
    }
    
    // Check resources
    for (const [resource, amount] of Object.entries(cost)) {
      if (playerRes[resource] < amount) {
        return { ok: false, error: `Not enough ${resource}. Need ${amount}, have ${playerRes[resource]}` };
      }
    }
    
    // Check population
    if (buildingType === "outpost" || buildingType === "bastion") {
      if (playerPop.used + populationRequired > playerPop.max) {
        return { ok: false, error: `Not enough population capacity. Need ${playerPop.used + populationRequired}, have ${playerPop.max}` };
      }
    }
    
    // Deduct costs
    for (const [resource, amount] of Object.entries(cost)) {
      playerRes[resource] -= amount;
    }
    
    // Update population
    if (buildingType === "outpost" || buildingType === "bastion") {
      playerPop.used += populationRequired;
    }
    if (buildingType === "citadel" || buildingType === "capital") {
      // Remove old building's population usage
      if (existingBuilding) {
        playerPop.used -= 1; // Outpost used 1
      }
      playerPop.used += 0; // Citadel/Capital don't use population
      playerPop.max += populationCapacity;
    }
    
    // Update building
    if (isUpgrade) {
      // Upgrade existing building
      existingBuilding.type = buildingType;
    } else {
      // New building
      tile.buildings.push({ playerId: userId, type: buildingType });
    }
    
    // Update stats
    this.dominionPoints[userId] += dpGain;
    this.defenseLevel[userId] += defenseGain;
    
    addToLog(this.eventLog, `${current.name} built ${buildingType} on tile ${tileId} (${tile.type}).`);
    
    return { ok: true };
  }

  /**
   * @param {string} userId
   * @returns {{ ok: boolean, error?: string, roll?: { d1: number, d2: number, total: number, isDouble: boolean } }}
   */
  rollDice(userId) {
    if (this.phase !== "roll") {
      return { ok: false, error: "Not the roll phase" };
    }
    const current = this.players[this.currentTurnIndex];
    if (current.id !== userId) {
      return { ok: false, error: "Only the current player can roll" };
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    const isDouble = d1 === d2;

    this.lastRoll = { d1, d2, total, isDouble };
    this.extraTurn = isDouble;

    // Breach event (roll 7)
    if (total === 7) {
      this.handleBreach(current);
      this.phase = "breach"; // Player must choose tile to block
      return { ok: true, roll: this.lastRoll, breach: true };
    }

    // Normal resource production
    this.distributeResources(total);
    
    this.phase = "main";
    addToLog(this.eventLog, `Rolled ${total}. Resources distributed.`);
    if (isDouble) {
      addToLog(this.eventLog, `Doubles! ${current.name} gets an extra turn.`);
    }

    return { ok: true, roll: this.lastRoll, breach: false };
  }

  /**
   * Distribute resources based on rolled number
   */
  distributeResources(rolledNumber) {
    console.log(`[gameEngine] distributeResources called for roll: ${rolledNumber}`);
    const activatedTiles = this.board.tiles.filter(t => 
      t.number === rolledNumber && t.id !== this.board.blockedTileId
    );
    
    console.log(`[gameEngine] Found ${activatedTiles.length} activated tiles for number ${rolledNumber}`);
    
    const current = this.players[this.currentTurnIndex];
    let resourcesGranted = false;
    
    // First, check for buildings on activated tiles
    for (const tile of activatedTiles) {
      if (tile.buildings && tile.buildings.length > 0) {
        for (const building of tile.buildings) {
          const playerId = building.playerId;
          let amount = 0;
          
          if (building.type === "outpost") {
            amount = 1;
          } else if (building.type === "citadel") {
            amount = 2;
          } else if (building.type === "capital") {
            amount = 3;
          }
          
          if (amount > 0 && tile.type !== "market") {
            const resourceType = tile.type;
            if (RESOURCE_TYPES.includes(resourceType)) {
              this.resources[playerId][resourceType] += amount;
              const player = this.players.find(p => p.id === playerId);
              addToLog(this.eventLog, `${player?.name} received ${amount} ${resourceType} from ${building.type} on tile ${tile.id}.`);
              console.log(`[gameEngine] ${player?.name} received ${amount} ${resourceType} from building`);
              resourcesGranted = true;
            }
          }
        }
      } else {
        // MVP: If no buildings, grant current player +1 resource from matching tile (temporary for testing)
        if (tile.type !== "market" && RESOURCE_TYPES.includes(tile.type)) {
          const resourceType = tile.type;
          this.resources[current.id][resourceType] += 1;
          addToLog(this.eventLog, `${current.name} received 1 ${resourceType} from tile ${tile.id} (no building yet).`);
          console.log(`[gameEngine] ${current.name} received 1 ${resourceType} from tile ${tile.id} (MVP: no building)`);
          resourcesGranted = true;
        }
      }
    }
    
    // MVP: Simple People tile resource drop (no building required for testing)
    const peopleTiles = this.board.tiles.filter(t => 
      t.type === "people" && t.number === rolledNumber && t.id !== this.board.blockedTileId
    );
    
    if (peopleTiles.length > 0) {
      this.resources[current.id].people += 1;
      addToLog(this.eventLog, `${current.name} received 1 people from People tile (rolled ${rolledNumber}).`);
      console.log(`[gameEngine] ${current.name} received 1 people from People tile`);
      resourcesGranted = true;
    }
    
    if (!resourcesGranted) {
      console.log(`[gameEngine] No resources granted for roll ${rolledNumber} (no matching tiles or all blocked)`);
    }
  }

  /**
   * Handle Breach event (roll 7)
   */
  handleBreach(currentPlayer) {
    addToLog(this.eventLog, `Breach! (rolled 7) ${currentPlayer.name} must choose a tile to block.`);
    
    // Every player without Bastion loses 2 random resources
    this.players.forEach((p) => {
      if (p.id === currentPlayer.id) return; // Roller doesn't lose
      
      const hasBastion = this.board.tiles.some(tile => 
        tile.buildings.some(b => b.playerId === p.id && b.type === "bastion")
      );
      
      const hasCapital = this.board.tiles.some(tile => 
        tile.buildings.some(b => b.playerId === p.id && b.type === "capital")
      );
      
      // Capital owners are immune
      if (hasCapital) {
        addToLog(this.eventLog, `${p.name} is immune (has Capital).`);
        return;
      }
      
      const playerRes = this.resources[p.id];
      const total = totalResources(playerRes);
      
      if (total === 0) return;
      
      let loseAmount = 2;
      
      // If player has 8+ DP and defense < 2, lose 4
      if (this.dominionPoints[p.id] >= 8 && this.defenseLevel[p.id] < 2) {
        loseAmount = 4;
      }
      
      // If has Bastion, lose nothing
      if (hasBastion) {
        addToLog(this.eventLog, `${p.name} is protected by Bastion.`);
        return;
      }
      
      const actualLoss = Math.min(loseAmount, total);
      randomDiscard(playerRes, actualLoss);
      addToLog(this.eventLog, `${p.name} lost ${actualLoss} resource(s) in the Breach.`);
    });
  }

  /**
   * Block a tile during Breach
   * @param {string} userId
   * @param {number} tileId
   * @returns {{ ok: boolean, error?: string }}
   */
  blockTile(userId, tileId) {
    if (this.phase !== "breach") {
      return { ok: false, error: "Can only block tile during Breach phase" };
    }
    const current = this.players[this.currentTurnIndex];
    if (current.id !== userId) {
      return { ok: false, error: "Only the current player can block a tile" };
    }
    
    const tile = this.board.tiles[tileId];
    if (!tile) {
      return { ok: false, error: "Invalid tile" };
    }
    
    if (tile.type === "market") {
      return { ok: false, error: "Cannot block Central Market" };
    }
    
    this.board.blockedTileId = tileId;
    this.phase = "main";
    addToLog(this.eventLog, `${current.name} blocked tile ${tileId} (${tile.type}).`);
    
    return { ok: true };
  }

  /**
   * @param {string} userId
   * @returns {{ ok: boolean, error?: string }}
   */
  endTurn(userId) {
    if (this.phase !== "main") {
      return { ok: false, error: "Can only end turn during main phase" };
    }
    const current = this.players[this.currentTurnIndex];
    if (current.id !== userId) {
      return { ok: false, error: "Only the current player can end turn" };
    }

    if (this.extraTurn) {
      this.extraTurn = false;
      this.phase = "roll";
      addToLog(this.eventLog, `${current.name} ends extra turn. Rolling again.`);
      return { ok: true, extraTurnUsed: true };
    }

    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    const next = this.players[this.currentTurnIndex];
    this.phase = "roll";
    addToLog(this.eventLog, `Turn passed to ${next.name}.`);
    return { ok: true, extraTurnUsed: false };
  }

  getState() {
    const current = this.players[this.currentTurnIndex];
    return {
      gameId: this.gameId,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        username: p.name,
        population: this.population[p.id],
        dominionPoints: this.dominionPoints[p.id] || 0,
        defenseLevel: this.defenseLevel[p.id] || 0
      })),
      currentTurnPlayerId: current?.id ?? null,
      phase: this.phase,
      resources: { ...this.resources },
      lastRoll: this.lastRoll,
      eventLog: [...this.eventLog],
      extraTurn: this.extraTurn,
      creatorId: this.creatorId,
      matchStartTime: this.matchStartTime,
      board: this.board ? {
        tiles: this.board.tiles.map(t => ({
          id: t.id,
          type: t.type,
          number: t.number,
          buildings: [...t.buildings]
        })),
        blockedTileId: this.board.blockedTileId
      } : null,
    };
  }
}

module.exports = SoureGame;
