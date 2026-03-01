/**
 * Seed Wikipedia URLs for politicians with verified Wikipedia pages.
 * Usage: node scripts/seed-wikipedia.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Read .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const CONVEX_URL = envVars.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

// Verified Wikipedia URLs — mapped by politician name (exact DB match or partial match)
const WIKIPEDIA_URLS = [
  { name: "Paulette Thomas", url: "https://es.wikipedia.org/wiki/Paulette_Thomas" },
  { name: "Crispiano Adames", url: "https://es.wikipedia.org/wiki/Crispiano_Adames" },
  { name: "José Raúl Mulino", url: "https://es.wikipedia.org/wiki/Jos%C3%A9_Ra%C3%BAl_Mulino" },
  { name: "Mayer Mizrachi", url: "https://es.wikipedia.org/wiki/Mayer_Mizrachi" },
  // Name in DB: "Omaira 'Mayín' Correa Delgado" — use partial match
  { name: "Mayín Correa", match: "Mayín", url: "https://es.wikipedia.org/wiki/May%C3%ADn_Correa" },
  // The following politicians have Wikipedia pages but are NOT in the current 74-person DB:
  // Carlos Afú, Zulay Rodríguez, Juan Diego Vásquez, Gabriel Silva, Edison Broce, Melitón Arrocha
];

async function convexQuery(functionName, args) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: functionName, args, format: "json" }),
  });
  if (!res.ok) throw new Error(`Query ${functionName} failed: ${res.status}`);
  const data = await res.json();
  return data.value;
}

async function convexMutation(functionName, args) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: functionName, args, format: "json" }),
  });
  if (!res.ok) throw new Error(`Mutation ${functionName} failed: ${res.status}`);
  const data = await res.json();
  return data.value;
}

async function main() {
  console.log("Fetching all politicians from Convex...");
  const politicians = await convexQuery("politicians:list", {});
  console.log(`Found ${politicians.length} politicians`);

  let updated = 0;
  let skipped = 0;

  for (const entry of WIKIPEDIA_URLS) {
    const politician = politicians.find((p) => {
      // Exact match first
      if (p.name === entry.name || p.name.normalize("NFC") === entry.name.normalize("NFC")) return true;
      // Partial/contains match for alternate names
      if (entry.match && p.name.includes(entry.match)) return true;
      return false;
    });

    if (!politician) {
      console.log(`  ⚠ Not found in DB: "${entry.name}"`);
      continue;
    }

    if (politician.wikipediaUrl) {
      console.log(`  ⏭ Already has Wikipedia: ${politician.name}`);
      skipped++;
      continue;
    }

    await convexMutation("politicians:update", {
      id: politician._id,
      wikipediaUrl: entry.url,
    });
    console.log(`  ✅ ${politician.name} → ${entry.url}`);
    updated++;
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error);
