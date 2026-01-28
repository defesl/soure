"use strict";

const express = require("express");
const prisma = require("../prismaClient");

const router = express.Router();

// ——— Helpers ———

/** @param {import("express").Request} req */
function getCurrentUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

/**
 * Normalize friendship pair so (a,b) and (b,a) map to same row.
 * @param {string} userId1
 * @param {string} userId2
 * @returns {{ userAId: string, userBId: string }}
 */
function normalizePair(userId1, userId2) {
  const a = userId1;
  const b = userId2;
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

/**
 * Check if two users are friends (Friendship exists for normalized pair).
 * @param {string} userId1
 * @param {string} userId2
 * @returns {Promise<boolean>}
 */
async function areFriends(userId1, userId2) {
  const { userAId, userBId } = normalizePair(userId1, userId2);
  const f = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });
  return !!f;
}

/** Require auth; 401 if not logged in */
function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ ok: false, error: "Please log in" });
  }
  req.currentUser = user;
  next();
}

// All routes require auth
router.use(requireAuth);

// ——— A) Send friend request ———
// POST /api/friends/request  Body: { username: string }
router.post("/request", async (req, res) => {
  const me = getCurrentUser(req);
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  if (!username) {
    return res.status(400).json({ ok: false, error: "Username is required" });
  }
  const targetUsername = username.toLowerCase();
  try {
    const target = await prisma.user.findUnique({
      where: { username: targetUsername },
      select: { id: true, username: true },
    });
    if (!target) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }
    if (target.id === me.id) {
      return res.status(400).json({ ok: false, error: "You cannot send a request to yourself" });
    }
    const alreadyFriends = await areFriends(me.id, target.id);
    if (alreadyFriends) {
      return res.status(400).json({ ok: false, error: "Already friends" });
    }
    // Check pending in either direction
    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: me.id, toUserId: target.id },
          { fromUserId: target.id, toUserId: me.id },
        ],
        status: "pending",
      },
    });
    if (existing) {
      const isOutgoing = existing.fromUserId === me.id;
      return res
        .status(400)
        .json({ ok: false, error: isOutgoing ? "Request already sent" : "You already have a pending request from this user" });
    }
    // If a previous rejected/canceled request exists, we allow creating a new one (upsert would require unique on from+to)
    const request = await prisma.friendRequest.create({
      data: { fromUserId: me.id, toUserId: target.id, status: "pending" },
      select: { id: true, fromUserId: true, toUserId: true, status: true, createdAt: true },
    });
    return res.status(201).json({
      ok: true,
      request: {
        id: request.id,
        from: me.id,
        to: target.id,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (e) {
    console.error("[friends] request error:", e);
    if (e.code === "P2002") {
      return res.status(400).json({ ok: false, error: "Request already exists" });
    }
    return res.status(500).json({ ok: false, error: "Failed to send request" });
  }
});

// ——— B) Incoming requests ———
// GET /api/friends/requests/incoming
router.get("/requests/incoming", async (req, res) => {
  const me = getCurrentUser(req);
  try {
    const list = await prisma.friendRequest.findMany({
      where: { toUserId: me.id, status: "pending" },
      include: { fromUser: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
    const requests = list.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      fromUsername: r.fromUser.username,
      createdAt: r.createdAt,
    }));
    return res.json({ ok: true, requests });
  } catch (e) {
    console.error("[friends] incoming error:", e);
    return res.status(500).json({ ok: false, error: "Failed to load requests" });
  }
});

// ——— C) Outgoing requests ———
// GET /api/friends/requests/outgoing
router.get("/requests/outgoing", async (req, res) => {
  const me = getCurrentUser(req);
  try {
    const list = await prisma.friendRequest.findMany({
      where: { fromUserId: me.id, status: "pending" },
      include: { toUser: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
    const requests = list.map((r) => ({
      id: r.id,
      toUserId: r.toUserId,
      toUsername: r.toUser.username,
      status: r.status,
      createdAt: r.createdAt,
    }));
    return res.json({ ok: true, requests });
  } catch (e) {
    console.error("[friends] outgoing error:", e);
    return res.status(500).json({ ok: false, error: "Failed to load requests" });
  }
});

// ——— D) Accept request ———
// POST /api/friends/accept  Body: { requestId: string }
router.post("/accept", async (req, res) => {
  const me = getCurrentUser(req);
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  if (!requestId) {
    return res.status(400).json({ ok: false, error: "requestId is required" });
  }
  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "pending") {
      return res.status(404).json({ ok: false, error: "Request not found or not pending" });
    }
    if (request.toUserId !== me.id) {
      return res.status(403).json({ ok: false, error: "Only the receiver can accept" });
    }
    const { userAId, userBId } = normalizePair(request.fromUserId, request.toUserId);
    await prisma.$transaction([
      prisma.friendRequest.update({ where: { id: requestId }, data: { status: "accepted" } }),
      prisma.friendship.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        create: { userAId, userBId },
        update: {},
      }),
    ]);
    // Optional: cancel any other pending request between same two users (e.g. if they had sent one back)
    await prisma.friendRequest.updateMany({
      where: {
        id: { not: requestId },
        OR: [
          { fromUserId: request.fromUserId, toUserId: request.toUserId },
          { fromUserId: request.toUserId, toUserId: request.fromUserId },
        ],
        status: "pending",
      },
      data: { status: "canceled" },
    });
    const friendship = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      include: {
        userA: { select: { id: true, username: true } },
        userB: { select: { id: true, username: true } },
      },
    });
    const other = friendship.userAId === me.id ? friendship.userB : friendship.userA;
    return res.json({
      ok: true,
      friendship: {
        id: friendship.id,
        userId: other.id,
        username: other.username,
        createdAt: friendship.createdAt,
      },
    });
  } catch (e) {
    console.error("[friends] accept error:", e);
    return res.status(500).json({ ok: false, error: "Failed to accept" });
  }
});

// ——— E) Reject request ———
// POST /api/friends/reject  Body: { requestId: string }
router.post("/reject", async (req, res) => {
  const me = getCurrentUser(req);
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  if (!requestId) {
    return res.status(400).json({ ok: false, error: "requestId is required" });
  }
  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "pending") {
      return res.status(404).json({ ok: false, error: "Request not found or not pending" });
    }
    if (request.toUserId !== me.id) {
      return res.status(403).json({ ok: false, error: "Only the receiver can reject" });
    }
    await prisma.friendRequest.update({ where: { id: requestId }, data: { status: "rejected" } });
    return res.json({ ok: true });
  } catch (e) {
    console.error("[friends] reject error:", e);
    return res.status(500).json({ ok: false, error: "Failed to reject" });
  }
});

// ——— F) Cancel outgoing request ———
// POST /api/friends/cancel  Body: { requestId: string }
router.post("/cancel", async (req, res) => {
  const me = getCurrentUser(req);
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  if (!requestId) {
    return res.status(400).json({ ok: false, error: "requestId is required" });
  }
  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "pending") {
      return res.status(404).json({ ok: false, error: "Request not found or not pending" });
    }
    if (request.fromUserId !== me.id) {
      return res.status(403).json({ ok: false, error: "Only the sender can cancel" });
    }
    await prisma.friendRequest.update({ where: { id: requestId }, data: { status: "canceled" } });
    return res.json({ ok: true });
  } catch (e) {
    console.error("[friends] cancel error:", e);
    return res.status(500).json({ ok: false, error: "Failed to cancel" });
  }
});

// ——— G) Friends list ———
// GET /api/friends/list
router.get("/list", async (req, res) => {
  const me = getCurrentUser(req);
  try {
    const asA = await prisma.friendship.findMany({
      where: { userAId: me.id },
      include: { userB: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
    const asB = await prisma.friendship.findMany({
      where: { userBId: me.id },
      include: { userA: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
    const friends = [
      ...asA.map((f) => ({ id: f.userB.id, username: f.userB.username, friendsSince: f.createdAt })),
      ...asB.map((f) => ({ id: f.userA.id, username: f.userA.username, friendsSince: f.createdAt })),
    ].sort((a, b) => new Date(b.friendsSince) - new Date(a.friendsSince));
    return res.json({ ok: true, friends });
  } catch (e) {
    console.error("[friends] list error:", e);
    return res.status(500).json({ ok: false, error: "Failed to load friends" });
  }
});

// ——— H) Remove friend ———
// POST /api/friends/remove  Body: { userId: string }
router.post("/remove", async (req, res) => {
  const me = getCurrentUser(req);
  const friendUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  if (!friendUserId) {
    return res.status(400).json({ ok: false, error: "userId is required" });
  }
  if (friendUserId === me.id) {
    return res.status(400).json({ ok: false, error: "Cannot remove yourself" });
  }
  try {
    const { userAId, userBId } = normalizePair(me.id, friendUserId);
    await prisma.friendship.deleteMany({
      where: { userAId, userBId },
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error("[friends] remove error:", e);
    return res.status(500).json({ ok: false, error: "Failed to remove friend" });
  }
});

module.exports = router;
