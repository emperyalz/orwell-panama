#!/usr/bin/env node
/**
 * Process FINAL-DATABASE.json into a clean, normalized politicians.json for the website.
 * Run: node scripts/process-database.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE = join(ROOT, "..", "orwell-discovery", "data", "verified", "FINAL-DATABASE.json");
const OUTPUT = join(ROOT, "src", "data", "politicians.json");

// ── Party normalization ──
const PARTY_NORMALIZE = {
  "PAN/CD": "PAN",
};

const PARTY_FULL_CANONICAL = {
  CD: "Cambio Democr\u00e1tico",
  PRD: "Partido Revolucionario Democr\u00e1tico",
  PAN: "Partido Paname\u00f1ista",
  LP: "Libre Postulaci\u00f3n",
  RM: "Realizando Metas",
  MOCA: "Movimiento Otro Camino",
  PP: "Partido Popular",
  MOLIRENA: "MOLIRENA",
  ALZ: "Partido Alianza",
  IND: "Independiente",
};

// ── Role category mapping ──
function getRoleCategory(role) {
  if (role.startsWith("Diputad")) return "Deputy";
  if (role.startsWith("Alcald")) return "Mayor";
  if (role.startsWith("Gobernador")) return "Governor";
  if (role.startsWith("Presidente")) return "President";
  return "Other";
}

// ── Slug generation ──
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Province normalization ──
function normalizeProvince(province) {
  if (!province) return { province: "Nacional", district: undefined };
  const match = province.match(/^(.+?)\s*\((.+)\)$/);
  if (match) {
    return { province: match[1].trim(), district: match[2].trim() };
  }
  return { province, district: undefined };
}

// ── Sort by last name ──
function getLastName(name) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// ── Main processing ──
console.log("Reading source database...");
const raw = JSON.parse(readFileSync(SOURCE, "utf-8"));
console.log(`  Found ${raw.politicians.length} politicians`);

const processed = raw.politicians.map((pol) => {
  // Party normalization
  let party = pol.party || "";
  party = PARTY_NORMALIZE[party] || party;
  if (!party) party = "IND";

  const partyFull = PARTY_FULL_CANONICAL[party] || pol.party_full || party;

  // Province normalization
  const { province, district } = normalizeProvince(pol.province);

  // Role category
  const roleCategory = getRoleCategory(pol.role);

  // Slug
  const slug = slugify(pol.name);

  // Process accounts — only CONFIRMED + PROBABLE
  const accounts = (pol.accounts || [])
    .filter((a) => a.verdict === "CONFIRMED" || a.verdict === "PROBABLE")
    .map((a) => ({
      platform: a.platform,
      handle: a.handle,
      profileUrl: a.profile_url,
      avatar: `/images/avatars/${pol.id}-${a.platform}.jpg`,
      verdict: a.verdict,
      score: a.score || 0,
      pollingTier: a.polling_tier || "warm",
    }));

  // Determine headshot availability
  const hasHeadshot = !!(pol.official_image_url && pol.official_image_url.length > 5);

  return {
    id: pol.id,
    name: pol.name,
    slug,
    party,
    partyFull,
    role: pol.role,
    roleCategory,
    province,
    ...(district && { district }),
    ...(pol.circuit && { circuit: pol.circuit }),
    hasHeadshot,
    headshot: `/images/headshots/${pol.id}.jpg`,
    accounts,
    ...(pol.official_gov_url && { officialGovUrl: pol.official_gov_url }),
  };
});

// Sort alphabetically by last name
processed.sort((a, b) => {
  const lastA = getLastName(a.name).toLowerCase();
  const lastB = getLastName(b.name).toLowerCase();
  return lastA.localeCompare(lastB, "es");
});

// Ensure output directory exists
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(processed, null, 2), "utf-8");

// Stats
const totalAccounts = processed.reduce((sum, p) => sum + p.accounts.length, 0);
const withHeadshots = processed.filter((p) => p.hasHeadshot).length;
const parties = [...new Set(processed.map((p) => p.party))].sort();
const provinces = [...new Set(processed.map((p) => p.province))].sort();
const roles = [...new Set(processed.map((p) => p.roleCategory))];

console.log(`\nProcessed ${processed.length} politicians:`);
console.log(`  Accounts: ${totalAccounts}`);
console.log(`  With headshots: ${withHeadshots}/${processed.length}`);
console.log(`  Parties: ${parties.join(", ")}`);
console.log(`  Provinces: ${provinces.join(", ")}`);
console.log(`  Role categories: ${roles.join(", ")}`);
console.log(`\nWritten to: ${OUTPUT}`);
