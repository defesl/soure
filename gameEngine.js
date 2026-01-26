"use strict";

const RESOURCE_TYPES = ["clay", "flint", "sand", "water", "cattle", "people"];
const OFFER_TIMEOUT_MS = 30 * 1000;

function emptyResources() {
  return { clay: 0, flint: 0, sand: 0, water: 0, cattle: 0, people: 0 };
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
    this.resources = {};
    this.phase = "lobby";
    this.lastRoll = null;
    this.extraTurn = false;
    this.eventLog = [];
    this.activeOffer = null;
    this.creatorId = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._offerTimer = null;
  }

  /**
   * @param {string} id
   * @param {string} name
   */
  addPlayer(id, name) {
    if (this.players.some((p) => p.id === id)) return;
    this.players.push({ id, name });
    this.resources[id] = emptyResources();
    if (!this.creatorId) this.creatorId = id;
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
    this.phase = "roll";
    this.currentTurnIndex = 0;
    const current = this.players[this.currentTurnIndex];
    addToLog(this.eventLog, `Match started! ${current.name} goes first.`);
    return { ok: true };
  }

  /**
   * @param {string} userId
   * @returns {{ ok: boolean, error?: string, roll?: { d1: number, d2: number, total: number, isDouble: boolean }, barbarians?: boolean }}
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

    if (total === 8) {
      this.phase = "barbarians";
      addToLog(this.eventLog, `Barbarians activated! (rolled 8) ${current.name} must choose placement.`);

      this.players.forEach((p) => {
        const res = this.resources[p.id];
        const tot = totalResources(res);
        if (tot > 8) {
          const discard = Math.floor(tot / 2);
          randomDiscard(res, discard);
          addToLog(this.eventLog, `${p.name} had ${tot} resources (>8). Discarded ${discard} (half).`);
        }
      });

      return { ok: true, roll: this.lastRoll, barbarians: true };
    }

    this.phase = "main";
    this.players.forEach((p) => {
      const r = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)];
      this.resources[p.id][r] += 1;
    });
    addToLog(this.eventLog, `Rolled ${total}. Everyone received 1 random resource.`);
    if (isDouble) addToLog(this.eventLog, `Doubles! ${current.name} gets an extra turn.`);

    return { ok: true, roll: this.lastRoll, barbarians: false };
  }

  _clearOfferTimer() {
    if (this._offerTimer) {
      clearTimeout(this._offerTimer);
      this._offerTimer = null;
    }
    this.activeOffer = null;
  }

  /**
   * @param {string} userId
   * @param {string} request - Resource type or "any"
   * @param {() => void} onTimeout - Called when offer expires without accept
   * @returns {{ ok: boolean, error?: string }}
   */
  createOffer(userId, request, onTimeout) {
    if (this.phase !== "barbarians") {
      return { ok: false, error: "Barbarians phase only" };
    }
    const current = this.players[this.currentTurnIndex];
    if (current.id !== userId) {
      return { ok: false, error: "Only the current player can create an offer" };
    }

    this._clearOfferTimer();
    const valid = request === "any" || RESOURCE_TYPES.includes(request);
    if (!valid) {
      return { ok: false, error: "Invalid resource type" };
    }

    const expiresAt = Date.now() + OFFER_TIMEOUT_MS;
    this.activeOffer = {
      fromPlayerId: userId,
      request,
      promise: "barbarianCamp",
      expiresAt,
    };
    addToLog(this.eventLog, `${current.name} offers: place barbarians in camp in exchange for 1 ${request === "any" ? "resource" : request}.`);

    this._offerTimer = setTimeout(() => {
      this._offerTimer = null;
      if (this.activeOffer && this.phase === "barbarians") {
        addToLog(this.eventLog, "Offer expired. Barbarians placed in camp.");
        this.activeOffer = null;
        this.phase = "main";
        onTimeout();
      }
    }, OFFER_TIMEOUT_MS);

    return { ok: true };
  }

  /**
   * @param {string} userId - Acceptor
   * @param {string} resourceType
   * @returns {{ ok: boolean, error?: string }}
   */
  acceptOffer(userId, resourceType) {
    if (this.phase !== "barbarians" || !this.activeOffer) {
      return { ok: false, error: "No active offer" };
    }
    if (this.activeOffer.fromPlayerId === userId) {
      return { ok: false, error: "Cannot accept your own offer" };
    }

    const res = this.resources[userId];
    const req = this.activeOffer.request;
    const validType = req === "any" ? RESOURCE_TYPES.includes(resourceType) : resourceType === req;
    if (!validType) {
      return { ok: false, error: `Invalid or wrong resource type` };
    }
    if (!res || res[resourceType] < 1) {
      return { ok: false, error: "You do not have that resource" };
    }

    this._clearOfferTimer();
    res[resourceType] -= 1;
    const current = this.players[this.currentTurnIndex];
    this.resources[current.id][resourceType] += 1;

    const acceptor = this.players.find((p) => p.id === userId);
    addToLog(this.eventLog, `${acceptor?.name ?? userId} accepted. Gave 1 ${resourceType} to ${current.name}. Barbarians placed in camp.`);

    this.phase = "main";
    return { ok: true };
  }

  /**
   * Place barbarians in camp (no offer or player chooses to skip offer).
   * @param {string} userId
   * @returns {{ ok: boolean, error?: string }}
   */
  placeInCamp(userId) {
    if (this.phase !== "barbarians") {
      return { ok: false, error: "Barbarians phase only" };
    }
    const current = this.players[this.currentTurnIndex];
    if (current.id !== userId) {
      return { ok: false, error: "Only the current player can place barbarians" };
    }

    this._clearOfferTimer();
    addToLog(this.eventLog, `${current.name} placed barbarians in camp.`);
    this.phase = "main";
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
      players: this.players.map((p) => ({ id: p.id, name: p.name, username: p.name })),
      currentTurnPlayerId: current?.id ?? null,
      phase: this.phase,
      resources: { ...this.resources },
      lastRoll: this.lastRoll,
      eventLog: [...this.eventLog],
      activeOffer: this.activeOffer ? { ...this.activeOffer } : null,
      extraTurn: this.extraTurn,
      creatorId: this.creatorId,
    };
  }
}

module.exports = SoureGame;
