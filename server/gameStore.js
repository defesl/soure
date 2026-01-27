"use strict";

const SoureGame = require("./gameEngine");

const GAME_RULES = { minPlayers: 1, maxPlayers: 4 };

const minPlayers = 1; // Solo mode enabled
const maxPlayers = GAME_RULES.maxPlayers;

/** @type {Map<string, { game: SoureGame, creatorId: string }>} */
const games = new Map();

/** @type {Map<string, string>} - userId -> activeGameId mapping */
const userActiveGames = new Map();

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
 * Get active game ID for a user
 * @param {string} userId
 * @returns {string | null}
 */
function getActiveGameId(userId) {
  const gameId = userActiveGames.get(userId);
  if (!gameId) return null;
  
  // Verify game still exists and user is still a member
  const entry = games.get(gameId);
  if (!entry) {
    userActiveGames.delete(userId);
    return null;
  }
  
  const state = entry.game.getState();
  const isMember = state.players.some((p) => p.id === userId);
  if (!isMember) {
    userActiveGames.delete(userId);
    return null;
  }
  
  return gameId;
}

module.exports = {
  GAME_RULES,
  minPlayers,
  maxPlayers,
  createGame,
  getGame,
  joinGame,
  getActiveGameId,
};
