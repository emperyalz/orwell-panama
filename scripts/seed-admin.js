/**
 * One-time script to create the king_admin account.
 * Usage: node scripts/seed-admin.js
 *
 * Edit NAME, EMAIL, PASSWORD below, then run once.
 */

const bcrypt = require("bcryptjs");

const NAME = "Eric Nunlee";
const EMAIL = "admin@orwell.com";   // ← change to your email
const PASSWORD = "changeme123";     // ← change to a strong password

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://careful-coyote-836.convex.cloud";

async function main() {
  console.log("🔐 Hashing password...");
  const hashed = await bcrypt.hash(PASSWORD, 12);

  console.log("📡 Calling Convex seedAdmin mutation...");
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "users:seedAdmin",
      args: { name: NAME, email: EMAIL, password: hashed },
      format: "json",
    }),
  });

  const data = await res.json();
  if (data.errorMessage) {
    console.error("❌ Error:", data.errorMessage);
    process.exit(1);
  }

  console.log("✅ Admin account created!");
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Role:     king_admin`);
}

main();
