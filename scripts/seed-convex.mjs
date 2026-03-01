#!/usr/bin/env node

/**
 * Seed Convex database from politicians.json
 *
 * Usage:
 *   node scripts/seed-convex.mjs
 *
 * Prerequisites:
 *   - Convex project configured (npx convex dev --once)
 *   - .env.local file with NEXT_PUBLIC_CONVEX_URL
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

// Dynamic imports
const { ConvexHttpClient } = await import("convex/browser");
const { api } = await import(
  join(projectRoot, "convex/_generated/api.js")
);

// Load politicians data
const dataPath = join(projectRoot, "src/data/politicians.json");
const politicians = JSON.parse(readFileSync(dataPath, "utf-8"));

const totalAccounts = politicians.reduce(
  (sum, p) => sum + p.accounts.length,
  0
);

console.log(`Convex URL: ${convexUrl}`);
console.log(
  `Found ${politicians.length} politicians, ${totalAccounts} accounts`
);
console.log();

const client = new ConvexHttpClient(convexUrl);

// Batch in chunks of 10 (conservative for mutation arg size limits)
const BATCH_SIZE = 10;
const totalBatches = Math.ceil(politicians.length / BATCH_SIZE);
let totalSeeded = 0;
let totalAccountsSeeded = 0;

for (let i = 0; i < politicians.length; i += BATCH_SIZE) {
  const batch = politicians.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const batchAccounts = batch.reduce((s, p) => s + p.accounts.length, 0);

  process.stdout.write(
    `[${batchNum}/${totalBatches}] Seeding ${batch.length} politicians (${batchAccounts} accounts)... `
  );

  try {
    const result = await client.mutation(api.seed.seedPoliticians, {
      politicians: batch,
    });
    console.log(
      `Done (${result.politicianCount} new, ${result.accountCount} accounts)`
    );
    totalSeeded += result.politicianCount;
    totalAccountsSeeded += result.accountCount;
  } catch (error) {
    console.error(`\nError in batch ${batchNum}:`, error.message);
    process.exit(1);
  }
}

console.log();
console.log(`Seeding complete!`);
console.log(`  Politicians: ${totalSeeded}`);
console.log(`  Accounts: ${totalAccountsSeeded}`);
console.log();
console.log(`Verify at: https://dashboard.convex.dev`);
