"use strict";

const bcrypt = require("bcryptjs");
const prisma = require("./prismaClient");

/**
 * Register a new user.
 * @param {{ username: string, password: string }} body
 * @returns {Promise<{ ok: boolean, error?: string, user?: { id: string, username: string } }>}
 */
async function register(body) {
  const { username, password } = body || {};

  if (!username || !password) {
    return { ok: false, error: "Missing username or password" };
  }

  const cleanUsername = String(username).trim().toLowerCase();
  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return { ok: false, error: "Username must be 3-20 characters" };
  }
  if (String(password).length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }

  try {
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (existingUser) {
      return { ok: false, error: "Username already taken" };
    }

    // Create new user
    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        passwordHash: hash,
      },
    });

    return { ok: true, user: { id: user.id, username: user.username } };
  } catch (error) {
    console.error("[auth] Registration error:", error);
    // Handle unique constraint violation
    if (error.code === "P2002") {
      return { ok: false, error: "Username already taken" };
    }
    // Handle database connection errors
    if (error.code === "P1001" || error.message?.includes("Can't reach database")) {
      return { ok: false, error: "Database connection failed. Please check your configuration." };
    }
    // More specific error messages
    if (error.message && error.message.includes("DATABASE_URL")) {
      return { ok: false, error: "Database configuration error. Please check server setup." };
    }
    return { ok: false, error: "Registration failed: " + (error.message || "Unknown error") };
  }
}

/**
 * Login existing user.
 * @param {{ username: string, password: string }} body
 * @returns {Promise<{ ok: boolean, error?: string, user?: { id: string, username: string } }>}
 */
async function login(body) {
  const { username, password } = body || {};

  if (!username || !password) {
    return { ok: false, error: "Missing username or password" };
  }

  const cleanUsername = String(username).trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (!user) {
      return { ok: false, error: "Invalid username or password" };
    }

    const match = await bcrypt.compare(String(password), user.passwordHash);
    if (!match) {
      return { ok: false, error: "Invalid username or password" };
    }

    return { ok: true, user: { id: user.id, username: user.username } };
  } catch (error) {
    console.error("[auth] Login error:", error);
    return { ok: false, error: "Login failed" };
  }
}

module.exports = {
  register,
  login,
};
