#!/usr/bin/env node

/**
 * Seed the King Admin user into Convex.
 *
 * Usage:
 *   node scripts/seed-admin.mjs
 *
 * Environment:
 *   ADMIN_EMAIL — admin email (default: admin@orwell.com)
 *   ADMIN_PASSWORD — admin password (default: orwell2025!)
 *   ADMIN_NAME — admin display name (default: King Admin)
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Read NEXT_PUBLIC_CONVEX_URL from .env.local
const envPath = join(projectRoot, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const convexUrlMatch = envContent.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
const convexUrl = convexUrlMatch?.[1]?.trim();

if (!convexUrl) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const email = process.env.ADMIN_EMAIL || "admin@orwell.com";
const password = process.env.ADMIN_PASSWORD || "orwell2025!";
const name = process.env.ADMIN_NAME || "King Admin";

console.log(`Seeding King Admin user...`);
console.log(`  Email: ${email}`);
console.log(`  Name: ${name}`);

// Hash password
const hashedPassword = await bcrypt.hash(password, 12);

// Call Convex mutation via HTTP
const response = await fetch(`${convexUrl}/api/mutation`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    path: "users:seedAdmin",
    args: { name, email, password: hashedPassword },
    format: "json",
  }),
});

const data = await response.json();

if (data.status === "success") {
  console.log(`\nKing Admin created/updated successfully!`);
  console.log(`  Login at: http://localhost:3000/login`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
} else {
  console.error(`Error:`, data);
  process.exit(1);
}
