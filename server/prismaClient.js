"use strict";

// Check DATABASE_URL before creating Prisma client
if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL environment variable is not set!");
  console.error("Please create a .env file in the project root with:");
  console.error('  DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/db"');
  console.error("See .env.example for the format.");
  process.exit(1);
}

// Validate DATABASE_URL format (PostgreSQL only)
const dbUrl = process.env.DATABASE_URL.trim();

// Check if it's still the placeholder
if (dbUrl.includes("USER:PASSWORD@HOST:PORT") || 
    dbUrl.includes("USER:PASSWORD@HOST") ||
    dbUrl === 'postgresql://USER:PASSWORD@HOST:PORT/database' ||
    dbUrl.startsWith("file:")) {
  console.error("❌ ERROR: DATABASE_URL must be a valid Supabase PostgreSQL connection string!");
  console.error("");
  console.error("You need to set your actual Supabase connection string.");
  console.error("");
  console.error("📋 STEP-BY-STEP INSTRUCTIONS:");
  console.error("");
  console.error("1. Go to: https://supabase.com → Your Project → Settings → Database");
  console.error("2. Find 'Connection string' section");
  console.error("3. Select 'URI' tab (not Session mode)");
  console.error("4. Copy the connection string");
  console.error("5. Open: .env file in project root");
  console.error("6. Set DATABASE_URL to your copied string");
  console.error("");
  console.error("Example format:");
  console.error('  DATABASE_URL="postgresql://postgres:yourpassword@db.xxxxx.supabase.co:5432/postgres"');
  console.error("");
  console.error("⚠️  Important:");
  console.error("  - Replace 'yourpassword' with your actual Supabase database password");
  console.error("  - Replace 'db.xxxxx.supabase.co' with your actual Supabase host");
  console.error("  - If password has special characters, URL-encode them (@ → %40, # → %23, etc.)");
  console.error("  - SQLite (file:./dev.db) is no longer supported - use Supabase Postgres only");
  console.error("");
  process.exit(1);
}

// Validate PostgreSQL connection string format
const postgresPattern = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;

if (!postgresPattern.test(dbUrl)) {
  console.error("❌ ERROR: Invalid DATABASE_URL format!");
  console.error("Expected format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE");
  console.error("");
  console.error("Your DATABASE_URL (password hidden):", dbUrl.replace(/:[^:@]+@/, ":****@"));
  console.error("");
  console.error("Common issues:");
  console.error("  - Missing port number (should be :5432)");
  console.error("  - Special characters in password need URL encoding");
  console.error("  - Missing quotes around the URL in .env file");
  console.error("  - SQLite format (file:./dev.db) is not supported");
  console.error("");
  console.error("Example:");
  console.error('  DATABASE_URL="postgresql://postgres:mypassword@db.xxxxx.supabase.co:5432/postgres"');
  process.exit(1);
}

// Extract and validate port
const urlMatch = dbUrl.match(postgresPattern);
if (urlMatch) {
  const port = parseInt(urlMatch[4], 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error("❌ ERROR: Invalid port number in DATABASE_URL!");
    console.error("Port must be a number between 1 and 65535");
    console.error("Your port:", urlMatch[4]);
    process.exit(1);
  }
}

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
