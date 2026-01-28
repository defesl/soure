"use strict";

const SoureGame = require("./gameEngine");

const GAME_RULES = { minPlayers: 1, maxPlayers: 4 };

const minPlayers = 1; // Solo mode enabled
const maxPlayers = GAME_RULES.maxPlayers;

/** @type {Map<string, { game: SoureGame, creatorId: string }>} */
const games = new Map();

/** @type {Map<string, string>} - userId -> activeGameId mapping */
const userActiveGames = new Map();

/** @type {Map<string, NodeJS.Timeout>} - gameId -> inactivity timeout handle (2 min after start if no roll) */
const inactivityTimeoutHandles = new Map();

const INACTIVITY_MS = 120000; // 2 minutes

function generateGameId() {
  let id;
  do {
    id = Math.random().toString(36).slice(2, 8);
  } while (games.has(id));
  return id;
}

/**
 * Create a new game. Creator is the first player.
 * @param {string} creatorId - User id (e.g. username or stable id)
 * @param {string} creatorUsername
 * @returns {{ gameId: string, error?: string }}
 */
function createGame(creatorId, creatorUsername) {
  const gameId = generateGameId();
  const game = new SoureGame(gameId, { minPlayers, maxPlayers });
  game.addPlayer(creatorId, creatorUsername);
  game.creatorId = creatorId; // Set creatorId on the game instance
  games.set(gameId, { game, creatorId });
  // Track active game for creator
  userActiveGames.set(creatorId, gameId);
  console.log("[gameStore] Created game:", gameId, "creator:", creatorUsername, "creatorId:", creatorId);
  return { gameId };
}

/**
 * @param {string} gameId
 * @returns {{ game: SoureGame, creatorId: string } | null}
 */
function getGame(gameId) {
  return games.get(gameId) || null;
}

/**
 * @param {string} gameId
 * @param {string} userId
 * @param {string} username
 * @returns {{ ok: boolean, error?: string }}
 */
function joinGame(gameId, userId, username) {
  const entry = games.get(gameId);
  if (!entry) {
    return { ok: false, error: "Game not found" };
  }
  const { game } = entry;
  const state = game.getState();
  
  // Check if player is already in the game - allow rejoin
  const isAlreadyMember = state.players.some((p) => p.id === userId);
  if (isAlreadyMember) {
    console.log("[gameStore] Player re-joined existing game:", gameId, username);
    return { ok: true };
  }
  
  // If game has started, don't allow new players
  if (state.phase !== "lobby") {
    return { ok: false, error: "Game already started. Only existing players can rejoin." };
  }
  
  // Add new player to lobby
  if (state.players.length >= maxPlayers) {
    return { ok: false, error: "Game is full" };
  }
  game.addPlayer(userId, username);
  // Track active game for player
  userActiveGames.set(userId, gameId);
  console.log("[gameStore] Player joined:", gameId, username);
  return { ok: true };
}

/**
 * Get active game ID for a user (only if game exists, user is member, and game not ended).
 * @param {string} userId
 * @returns {string | null}
 */
function getActiveGameId(userId) {
  const gameId = userActiveGames.get(userId);
  if (!gameId) return null;

  const entry = games.get(gameId);
  if (!entry) {
    userActiveGames.delete(userId);
    return null;
  }

  const state = entry.game.getState();
  if (state.phase === "ended") {
    userActiveGames.delete(userId);
    return null;
  }
  const isMember = state.players.some((p) => p.id === userId);
  if (!isMember) {
    userActiveGames.delete(userId);
    return null;
  }

  return gameId;
}

/**
 * Schedule inactivity auto-stop: if no dice roll within 2 min after game start, end game.
 * @param {string} gameId
 * @param {() => void} onEnd - called when game is ended (e.g. broadcast state).
 */
function scheduleInactivityTimeout(gameId, onEnd) {
  clearInactivityTimeout(gameId);
  const handle = setTimeout(() => {
    inactivityTimeoutHandles.delete(gameId);
    const entry = games.get(gameId);
    if (!entry) return;
    const state = entry.game.getState();
    if (state.phase === "ended") return;
    entry.game.endDueToInactivity();
    state.players.forEach((p) => userActiveGames.delete(p.id));
    if (typeof onEnd === "function") onEnd();
    console.log("[gameStore] Game ended due to inactivity:", gameId);
  }, INACTIVITY_MS);
  inactivityTimeoutHandles.set(gameId, handle);
}

/**
 * Clear inactivity timeout (e.g. when first dice roll happens).
 * @param {string} gameId
 */
function clearInactivityTimeout(gameId) {
  const handle = inactivityTimeoutHandles.get(gameId);
  if (handle) {
    clearTimeout(handle);
    inactivityTimeoutHandles.delete(gameId);
  }
}

module.exports = {
  GAME_RULES,
  minPlayers,
  maxPlayers,
  createGame,
  getGame,
  joinGame,
  getActiveGameId,
  scheduleInactivityTimeout,
  clearInactivityTimeout,
};
