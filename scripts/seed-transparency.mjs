#!/usr/bin/env node
/**
 * Seed Convex deputyTransparency table from scraped Espacio Cívico data.
 * Matches scraped deputies to ORWELL politicians by normalized name.
 *
 * Usage: CONVEX_URL=https://fleet-vole-527.convex.cloud node scripts/seed-transparency.mjs
 */

import { readFileSync } from "fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL =
  process.env.CONVEX_URL ||
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  "https://fleet-vole-527.convex.cloud";

const client = new ConvexHttpClient(CONVEX_URL);

/** Normalize name for matching: lowercase, remove accents */
function normalize(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Name mapping: Espacio Cívico name → ORWELL name
// For cases where names differ between sources
const NAME_OVERRIDES = {
  "graciela hernandez": "grace hernandez",
  "joan guevara": "jony guevara",
  "omar ortega": "luis omar ortega",
  "medin jimenez pitti": "medin jimenez",
  "jorge bloise iglesias": "jorge bloise",
  "luis camacho castro": "luis eduardo camacho",
  "jhonatan vega": "jhonathan vega",
  "ronald de gracia": "ronald de gracia",
  "ricardo vigil lopez": "ricardo vigil",
};

async function main() {
  console.log("🏛️ Seeding deputy transparency data into Convex\n");
  console.log(`📡 Convex URL: ${CONVEX_URL}\n`);

  // Read scraped data
  const scraped = JSON.parse(
    readFileSync("data/espacio-civico-deputies.json", "utf8")
  );
  console.log(`📋 ${scraped.length} scraped profiles to process\n`);

  // Get all politicians from Convex (with no filter args)
  const politicians = await client.query(api.politicians.list, {});
  console.log(`👥 ${politicians.length} politicians in ORWELL\n`);

  // Build normalized name → politician map
  const nameMap = new Map();
  for (const p of politicians) {
    nameMap.set(normalize(p.name), p);
  }

  let matched = 0;
  let unmatched = 0;
  const unmatchedNames = [];

  for (const dep of scraped) {
    const ecNorm = normalize(dep.name);

    // Try direct match first
    let politician = nameMap.get(ecNorm);

    // Try override mapping
    if (!politician && NAME_OVERRIDES[ecNorm]) {
      politician = nameMap.get(normalize(NAME_OVERRIDES[ecNorm]));
    }

    // Try partial matching (first + last name)
    if (!politician) {
      const parts = ecNorm.split(" ");
      for (const [name, p] of nameMap) {
        const nameParts = name.split(" ");
        // Match if first name and last name both appear
        if (
          parts.length >= 2 &&
          nameParts.includes(parts[0]) &&
          nameParts.includes(parts[parts.length - 1])
        ) {
          politician = p;
          break;
        }
      }
    }

    if (!politician) {
      unmatched++;
      unmatchedNames.push(`${dep.name} (${dep.slug})`);
      continue;
    }

    // Filter out fake document URLs (e.g. "https://espaciocivico.org1")
    const docs = dep.documents ? { ...dep.documents } : undefined;
    if (docs) {
      for (const [key, url] of Object.entries(docs)) {
        if (url && (url.endsWith("1") || url.endsWith("/1") || !url.includes("/"))) {
          delete docs[key];
        }
      }
      // Remove if empty after filtering
      if (Object.keys(docs).length === 0) {
        // keep docs undefined
      }
    }

    try {
      const result = await client.mutation(api.transparency.upsertTransparency, {
        politicianId: politician._id,
        espacioCivicoSlug: dep.slug,
        espacioCivicoUrl: dep.url,
        suplente: dep.suplente || undefined,
        planillaTotal: dep.planillaTotal || undefined,
        biography: dep.biography || undefined,
        commissions: dep.commissions?.length > 0 ? dep.commissions : undefined,
        performanceScores: dep.performanceScores || undefined,
        documents: Object.keys(docs || {}).length > 0 ? docs : undefined,
        voluntaryDeclarations: dep.voluntaryDeclarations ?? undefined,
      });

      matched++;
      const score = dep.performanceScores?.calificacionPonderada ?? "?";
      console.log(
        `  ✓ ${dep.name} → ${politician.name} (${politician.externalId}) | Score: ${score} | ${result.action}`
      );
    } catch (err) {
      console.error(`  ✗ ${dep.name}: ${err.message}`);
    }
  }

  console.log(`\n✅ Matched and seeded: ${matched}`);
  console.log(`❌ Unmatched: ${unmatched}`);
  if (unmatchedNames.length > 0) {
    console.log(`   ${unmatchedNames.join("\n   ")}`);
  }
}

main().catch(console.error);
