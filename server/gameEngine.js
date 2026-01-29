"use strict";

const { TRACK_FIELDS, TRACK_LEN, TOKEN_PALETTE, CORNER_IDS, CORNER_INDEX_BY_ID } = require("./track");
const RESOURCE_TYPES = ["stone", "iron", "food", "water", "gold"];
const BUILDING_TYPES = ["outpost", "citadel", "capital", "bastion"];

const CORNER_PRIORITY_RESOURCES = ["gold", "iron", "stone", "food", "water"];

function pickPlayerColor(players) {
  const used = new Set(players.map((p) => p.color).filter(Boolean));
  const available = TOKEN_PALETTE.find((c) => !used.has(c));
  return available || TOKEN_PALETTE[players.length % TOKEN_PALETTE.length];
}

function pickCornerId(players) {
  const used = new Set(players.map((p) => p.cornerId).filter(Boolean));
  const available = CORNER_IDS.filter((c) => !used.has(c));
  if (available.length === 0) return CORNER_IDS[0];
  return available[Math.floor(Math.random() * available.length)];
}

// Number tokens for resource tiles (2–12, Catan-style; 18 tokens for 18 resource hexes)
const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// Hex board layout: 19 tiles in 3-4-5-4-3 (Catan-style). Adjacency for 6/8 rule.
const HEX_ADJACENCY = [
  [1, 3, 4],           // 0  row 0
  [0, 2, 4, 5],       // 1
  [1, 5, 6],          // 2
  [0, 4, 7, 8],       // 3  row 1
  [0, 1, 3, 5, 8, 9], // 4
  [1, 2, 4, 6, 9, 10],// 5
  [2, 5, 10, 11],     // 6
  [3, 8, 12, 13],     // 7  row 2
  [3, 4, 7, 9, 13, 14],// 8
  [4, 5, 8, 10, 14, 15],// 9
  [5, 6, 9, 11, 15, 16],// 10
  [6, 10, 16, 17],    // 11
  [7, 13, 18],        // 12 row 3
  [7, 8, 12, 14, 18], // 13
  [8, 9, 13, 15, 18], // 14
  [9, 10, 14, 16, 18],// 15
  [10, 11, 15, 17, 18],// 16 row 4
  [11, 16, 18],       // 17
  [12, 13, 14, 15, 16, 17] // 18 Grand Bazaar (no number)
];

function emptyResources() {
  return { stone: 0, iron: 0, food: 0, water: 0, gold: 0 };
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

/**
 * Award resource ONLY when a player's token lands on a resource field.
 * Called once per movement resolution (inside rollDice, right after position is updated).
 * Reconnect does not re-call rollDice, so no double-award.
 * @param {SoureGame} game
 * @param {string} playerId
 */
function awardLandingResource(game, playerId, field) {
  if (!field || field.kind !== "resource") return;
  const resourceType = field.resourceType;
  if (!RESOURCE_TYPES.includes(resourceType)) return;
  const playerRes = game.resources[playerId];
  if (!playerRes) return;
  const amount = 1;
  playerRes[resourceType] += amount;
  const player = game.players.find((p) => p.id === playerId);
  const name = player ? player.name : "Player";
  addToLog(game.eventLog, `${name} landed on ${resourceType} and received +${amount} ${resourceType}.`);
}

function resolveCornerLanding(game, playerId, field) {
  if (!field || field.kind !== "corner") return;
  const ownerId = game.cornerOwners[field.cornerId];
  if (!ownerId || ownerId === playerId) return;
  const playerRes = game.resources[playerId];
  const ownerRes = game.resources[ownerId];
  if (!playerRes || !ownerRes) return;

  const resourceToPay = CORNER_PRIORITY_RESOURCES.find((type) => playerRes[type] > 0);
  const landingPlayer = game.players.find((p) => p.id === playerId);
  const ownerPlayer = game.players.find((p) => p.id === ownerId);
  const landingName = landingPlayer ? landingPlayer.name : "Player";
  const ownerName = ownerPlayer ? ownerPlayer.name : "Player";

  if (!resourceToPay) {
    addToLog(game.eventLog, `${landingName} landed on ${ownerName}'s corner but had no resources to pay.`);
    return;
  }

  playerRes[resourceToPay] -= 1;
  ownerRes[resourceToPay] += 1;
  addToLog(game.eventLog, `${landingName} landed on ${ownerName}'s corner and paid 1 ${resourceToPay}.`);
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
  // 18 resource tiles: 1 Grand Bazaar. Total 19 (Catan-style layout).
  const RESOURCE_COUNTS = { stone: 4, iron: 4, food: 4, water: 3, gold: 3 };
  const tileTypes = [];
  for (const [type, count] of Object.entries(RESOURCE_COUNTS)) {
    for (let i = 0; i < count; i++) tileTypes.push(type);
  }
  tileTypes.push("grandBazaar");

  const shuffledTypes = shuffleArray(tileTypes);

  const tiles = shuffledTypes.map((type, id) => ({
    id,
    type,
    number: null,
    buildings: []
  }));

  const bazaarTile = tiles.find(t => t.type === "grandBazaar");
  if (bazaarTile) bazaarTile.number = null;

  const tilesToNumber = tiles.filter(t => t.type !== "grandBazaar");
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const shuffledNumbers = shuffleArray(NUMBER_TOKENS);
    for (let i = 0; i < tilesToNumber.length; i++) {
      tilesToNumber[i].number = shuffledNumbers[i];
    }
    let valid = true;
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (tile.number === 6 || tile.number === 8) {
        const neighbors = HEX_ADJACENCY[i] || [];
        for (const nid of neighbors) {
          const n = tiles[nid];
          if (n && (n.number === 6 || n.number === 8)) {
            valid = false;
            break;
          }
        }
        if (!valid) break;
      }
    }
    if (valid) break;
    attempts++;
    tilesToNumber.forEach(t => { t.number = null; });
  }

  if (attempts >= maxAttempts) {
    const shuffledNumbers = shuffleArray(NUMBER_TOKENS);
    for (let i = 0; i < tilesToNumber.length; i++) tilesToNumber[i].number = shuffledNumbers[i];
  }

  return { tiles, blockedTileId: null };
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
    this.turnSeq = 0;
    this.lastProcessedRollSeq = null;
    this.board = null; // Will be generated on startMatch
    /** @type {Record<string, number>} token position index into TRACK (server-authoritative). */
    this.positionIndexByPlayerId = {};
    /** @type {Record<string, { shape: "circle"|"square", color: string }>} stable per player. */
    this.tokenStyleByPlayerId = {};
    /** @type {Record<string, string>} cornerId -> playerId */
    this.cornerOwners = {};
  }

  /**
   * @param {string} id
   * @param {string} name
   */
  addPlayer(id, name) {
    if (this.players.some((p) => p.id === id)) return;
    const color = pickPlayerColor(this.players);
    const cornerId = pickCornerId(this.players);
    const startTrackIndex = CORNER_INDEX_BY_ID[cornerId] ?? 0;
    this.players.push({ id, name, color, cornerId, positionIndex: startTrackIndex });
    this.resources[id] = emptyResources();
    this.population[id] = { max: 3, used: 0 };
    this.dominionPoints[id] = 0;
    this.defenseLevel[id] = 0;
    this.positionIndexByPlayerId[id] = startTrackIndex;
    this.tokenStyleByPlayerId[id] = { shape: "circle", color };
    this.cornerOwners[cornerId] = id;
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
    this.turnSeq = 1;
    this.lastProcessedRollSeq = null;
    this.players.forEach((p) => {
      const existing = this.positionIndexByPlayerId[p.id];
      this.positionIndexByPlayerId[p.id] = existing ?? p.positionIndex ?? 0;
    });
    const current = this.players[this.currentTurnIndex];
    addToLog(this.eventLog, `Match started! Board generated. ${current.name} goes first.`);
    return { ok: true };
  }

  /**
   * End game due to inactivity (no dice roll within 2 min after start).
   * Called by gameStore when inactivity timeout fires.
   */
  endDueToInactivity() {
    if (this.phase === "ended") return;
    this.phase = "ended";
    addToLog(this.eventLog, "Game ended (inactive — no dice roll within 2 minutes).");
    console.log("[gameEngine] Game ended due to inactivity:", this.gameId);
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
    if (this.lastProcessedRollSeq === this.turnSeq) {
      return { ok: false, error: "Already rolled this turn" };
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    const isDouble = d1 === d2;
    console.log("[DICE]", Date.now(), "d1", d1, "d2", d2, "total", total);

    this.lastRoll = { d1, d2, total, isDouble };
    this.extraTurn = isDouble;

    // Advance current player's token by (d1 + d2) steps; wrap around track.
    const steps = d1 + d2;
    const currentPlayer = this.players.find((p) => p.id === current.id);
    const storedPos = currentPlayer?.positionIndex;
    const fallbackPos = this.positionIndexByPlayerId[current.id];
    const currentPos =
      Number.isInteger(storedPos)
        ? storedPos
        : (Number.isInteger(fallbackPos) ? fallbackPos : 0);
    console.log(
      "[POS_CHECK_BEFORE]",
      "player",
      current.id,
      "storedPositionIndex=",
      storedPos,
      "turnSeq=",
      this.turnSeq
    );
    const nextPos = (currentPos + steps) % TRACK_LEN;
    this.positionIndexByPlayerId[current.id] = nextPos;
    if (currentPlayer) currentPlayer.positionIndex = nextPos;
    console.log(
      "[POS_CHECK_AFTER]",
      "player",
      current.id,
      "old=",
      currentPos,
      "steps=",
      steps,
      "new=",
      nextPos
    );
    this.lastProcessedRollSeq = this.turnSeq;
    const delta = (nextPos - currentPos + TRACK_LEN) % TRACK_LEN;

    // Award resource ONLY when token lands on a resource field (once per movement resolution).
    const landedField = TRACK_FIELDS[this.positionIndexByPlayerId[current.id]];
    awardLandingResource(this, current.id, landedField);
    resolveCornerLanding(this, current.id, landedField);
    console.log(
      `[ROLL_CHECK] old=${currentPos} d1=${d1} d2=${d2} steps=${steps} new=${nextPos} N=${TRACK_LEN} delta=${delta} landedKind=${landedField?.kind || "none"} landed=${landedField?.resourceType || landedField?.cornerId || "none"}`
    );
    console.log(
      `[ROLL_OUT] ts=${Date.now()} game=${this.gameId} player=${current.id} turn=${this.turnSeq} new=${nextPos} landedKind=${landedField?.kind || "none"} landedResourceType=${landedField?.resourceType || "none"} landedCornerId=${landedField?.cornerId || "none"}`
    );

    // Breach event (roll 7)
    if (total === 7) {
      this.handleBreach(current);
      // Auto-block a random resource tile (MVP: prevent game freeze)
      const resourceTiles = this.board.tiles.filter(t =>
        t.type !== "grandBazaar" && t.id !== this.board.blockedTileId
      );
      if (resourceTiles.length > 0) {
        const randomTile = resourceTiles[Math.floor(Math.random() * resourceTiles.length)];
        this.board.blockedTileId = randomTile.id;
        addToLog(this.eventLog, `${current.name} blocked tile ${randomTile.id} (${randomTile.type}).`);
      }
      this.phase = "main"; // Continue turn normally
      return { ok: true, roll: this.lastRoll, breach: true };
    }

    this.phase = "main";
    addToLog(this.eventLog, `Rolled ${total}.`);
    if (isDouble) {
      addToLog(this.eventLog, `Doubles! ${current.name} gets an extra turn.`);
    }

    return { ok: true, roll: this.lastRoll, breach: false };
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
    
    if (tile.type === "grandBazaar") {
      return { ok: false, error: "Cannot block Grand Bazaar" };
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
      this.turnSeq += 1;
      addToLog(this.eventLog, `${current.name} ends extra turn. Rolling again.`);
      return { ok: true, extraTurnUsed: true };
    }

    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    const next = this.players[this.currentTurnIndex];
    this.phase = "roll";
    this.turnSeq += 1;
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
        color: p.color,
        cornerId: p.cornerId,
        positionIndex: p.positionIndex,
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
      positionIndexByPlayerId: { ...this.positionIndexByPlayerId },
      tokenStyleByPlayerId: { ...this.tokenStyleByPlayerId },
      cornerOwners: { ...this.cornerOwners },
      track: TRACK_FIELDS.map((field) => ({
        index: field.index,
        kind: field.kind,
        id: field.id,
        domId: field.domId,
        resourceType: field.resourceType,
        cornerId: field.cornerId
      }))
    };
  }
}

module.exports = SoureGame;
