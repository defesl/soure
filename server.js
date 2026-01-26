"use strict";

// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const auth = require("./auth");
const gameStore = require("./gameStore");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const SESSION_SECRET = "soure-dev-secret-change-later";
const clientPath = path.join(__dirname, "..", "client");
const sessionsPath = path.join(__dirname, "..", ".sessions");

if (!fs.existsSync(sessionsPath)) {
  fs.mkdirSync(sessionsPath, { recursive: true });
}

const sessionStore = new FileStore({
  path: sessionsPath,
  ttl: 30 * 24 * 60 * 60,
});

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  },
});

app.use(express.json());
app.use(express.static(clientPath));
app.use(sessionMiddleware);

app.get("/", (_req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});
app.get("/register", (_req, res) => {
  res.sendFile(path.join(clientPath, "register.html"));
});
app.get("/login", (_req, res) => {
  res.sendFile(path.join(clientPath, "login.html"));
});
app.get("/game", (_req, res) => {
  res.sendFile(path.join(clientPath, "game.html"));
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.json({ ok: true, user: null });
  res.json({ ok: true, user: req.session.user });
});

app.post("/api/register", async (req, res) => {
  const result = await auth.register(req.body);
  if (!result.ok) {
    const status = result.error === "Username already taken" ? 409 : 400;
    return res.status(status).json({ ok: false, error: result.error });
  }
  req.session.user = result.user;
  res.json({ ok: true, user: result.user });
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

app.post("/api/login", async (req, res) => {
  const result = await auth.login(req.body);
  if (!result.ok) {
    return res.status(401).json({ ok: false, error: result.error });
  }
  req.session.user = result.user;
  const rememberMe = !!(req.body && req.body.rememberMe);
  req.session.cookie.maxAge = rememberMe ? THIRTY_DAYS_MS : null;
  res.json({ ok: true, user: result.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

io.engine.use(sessionMiddleware);

function broadcastGameState(gameId) {
  const entry = gameStore.getGame(gameId);
  if (!entry) return;
  const state = entry.game.getState();
  io.to(`game:${gameId}`).emit("gameState", state);
}

io.on("connection", (socket) => {
  const req = socket.request;
  const user = req.session?.user;

  if (!user) {
    console.log("[socket] Rejected unauthenticated connection:", socket.id);
    socket.disconnect(true);
    return;
  }

  const userId = user.id;
  const username = user.username;
  console.log("[socket] Authenticated connection:", socket.id, username);

  socket.on("createGame", () => {
    const { gameId } = gameStore.createGame(userId, username);
    socket.join(`game:${gameId}`);
    broadcastGameState(gameId);
    socket.emit("createGameResult", { ok: true, gameId });
    console.log("[socket] Game created:", gameId, "by", username);
  });

  socket.on("joinGame", (gameId) => {
    if (!gameId || typeof gameId !== "string") {
      socket.emit("joinGameResult", { ok: false, error: "Invalid game ID" });
      return;
    }
    const result = gameStore.joinGame(gameId, userId, username);
    if (!result.ok) {
      socket.emit("joinGameResult", { ok: false, error: result.error });
      return;
    }
    socket.join(`game:${gameId}`);
    broadcastGameState(gameId);
    socket.emit("joinGameResult", { ok: true, gameId });
    console.log("[socket] Player joined:", gameId, username);
  });

  socket.on("startMatch", () => {
    const gameId = [...socket.rooms].find((r) => r.startsWith("game:"));
    if (!gameId) {
      socket.emit("error", { message: "You are not in a game" });
      return;
    }
    const g = gameId.replace("game:", "");
    const entry = gameStore.getGame(g);
    if (!entry) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    const result = entry.game.startMatch(userId);
    if (!result.ok) {
      socket.emit("error", { message: result.error });
      return;
    }
    broadcastGameState(g);
    console.log("[socket] Match started:", g);
  });

  socket.on("rollDice", () => {
    const gameId = [...socket.rooms].find((r) => r.startsWith("game:"));
    if (!gameId) {
      socket.emit("error", { message: "You are not in a game" });
      return;
    }
    const g = gameId.replace("game:", "");
    const entry = gameStore.getGame(g);
    if (!entry) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    const result = entry.game.rollDice(userId);
    if (!result.ok) {
      socket.emit("error", { message: result.error });
      return;
    }
    broadcastGameState(g);
    socket.emit("rollResult", result);
  });

  socket.on("createOffer", (payload) => {
    const gameId = [...socket.rooms].find((r) => r.startsWith("game:"));
    if (!gameId) {
      socket.emit("error", { message: "You are not in a game" });
      return;
    }
    const g = gameId.replace("game:", "");
    const entry = gameStore.getGame(g);
    if (!entry) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    const request = (typeof payload === "object" && payload && payload.request != null)
      ? payload.request
      : (payload || "any");
    const result = entry.game.createOffer(userId, request, () => {
      broadcastGameState(g);
    });
    if (!result.ok) {
      socket.emit("error", { message: result.error });
      return;
    }
    broadcastGameState(g);
  });

  socket.on("acceptOffer", (resourceType) => {
    const gameId = [...socket.rooms].find((r) => r.startsWith("game:"));
    if (!gameId) {
      socket.emit("error", { message: "You are not in a game" });
      return;
    }
    const g = gameId.replace("game:", "");
    const entry = gameStore.getGame(g);
    if (!entry) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    const result = entry.game.acceptOffer(userId, resourceType);
    if (!result.ok) {
      socket.emit("error", { message: result.error });
      return;
    }
    broadcastGameState(g);
  });

  socket.on("placeInCamp", () => {
    const gameId = [...socket.rooms].find((r) => r.startsWith("game:"));
    if (!gameId) {
      socket.emit("error", { message: "You are not in a game" });
      return;
    }
    const g = gameId.replace("game:", "");
    const entry = gameStore.getGame(g);
    if (!entry) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    const result = entry.game.placeInCamp(userId);
    if (!result.ok) {
      socket.emit("error", { message: result.error });
      return;
    }
    broadcastGameState(g);
  });

  socket.on("endTurn", () => {
    const gameId = [...socket.rooms].find((r) => r.startsWith("game:"));
    if (!gameId) {
      socket.emit("error", { message: "You are not in a game" });
      return;
    }
    const g = gameId.replace("game:", "");
    const entry = gameStore.getGame(g);
    if (!entry) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    const result = entry.game.endTurn(userId);
    if (!result.ok) {
      socket.emit("error", { message: result.error });
      return;
    }
    broadcastGameState(g);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Soure server running at http://localhost:" + PORT);
});
