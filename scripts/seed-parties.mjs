/**
 * Seed parties table with current party data.
 * Usage: node scripts/seed-parties.mjs
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

const PARTIES = [
  {
    code: "CD",
    name: "Cambio Democrático",
    fullName: "Cambio Democrático",
    logo: "/icons/parties/cd.png",
    color: "#0066cc",
  },
  {
    code: "PRD",
    name: "PRD",
    fullName: "Partido Revolucionario Democrático",
    logo: "/icons/parties/prd.png",
    color: "#00994c",
  },
  {
    code: "PAN",
    name: "Panameñista",
    fullName: "Partido Panameñista",
    logo: "/icons/parties/pan.png",
    color: "#d4a017",
  },
  {
    code: "LP",
    name: "Libre Postulación",
    fullName: "Libre Postulación",
    logo: "/icons/parties/lp.svg",
    color: "#7c3aed",
  },
  {
    code: "RM",
    name: "Realizando Metas",
    fullName: "Realizando Metas",
    logo: "/icons/parties/rm.png",
    color: "#ea580c",
  },
  {
    code: "MOCA",
    name: "MOCA",
    fullName: "Movimiento Otro Camino",
    logo: "/icons/parties/moca.svg",
    color: "#0d9488",
  },
  {
    code: "PP",
    name: "Partido Popular",
    fullName: "Partido Popular",
    logo: "/icons/parties/pp.png",
    color: "#2563eb",
  },
  {
    code: "MOLIRENA",
    name: "MOLIRENA",
    fullName: "MOLIRENA",
    logo: "/icons/parties/molirena.png",
    color: "#dc2626",
  },
  {
    code: "ALZ",
    name: "Alianza",
    fullName: "Partido Alianza",
    logo: "/icons/parties/alz.jpg",
    color: "#16a34a",
  },
  {
    code: "IND",
    name: "Independiente",
    fullName: "Independiente",
    logo: "/icons/parties/ind.svg",
    color: "#6b7280",
  },
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
  console.log("Checking existing parties...");
  const existing = await convexQuery("parties:list", {});
  const existingCodes = new Set(existing.map((p) => p.code));
  console.log(`Found ${existing.length} existing parties`);

  let created = 0;
  let skipped = 0;

  for (const party of PARTIES) {
    if (existingCodes.has(party.code)) {
      console.log(`  ⏭ Already exists: ${party.code}`);
      skipped++;
      continue;
    }

    await convexMutation("parties:create", party);
    console.log(`  ✅ Created: ${party.code} — ${party.fullName}`);
    created++;
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
}

main().catch(console.error);
