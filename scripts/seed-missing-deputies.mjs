#!/usr/bin/env node
/**
 * Seed the 11 missing current-term (2024-2029) deputies into production.
 * Creates politician records + social media accounts.
 *
 * Usage:
 *   NEXT_PUBLIC_CONVEX_URL="https://fleet-vole-527.convex.cloud" node scripts/seed-missing-deputies.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Set NEXT_PUBLIC_CONVEX_URL");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const deputies = [
  {
    externalId: "DEP-072",
    name: "Nixon Andrade",
    slug: "nixon-andrade",
    party: "PRD",
    partyFull: "Partido Revolucionario Democrático",
    role: "Diputado",
    roleCategory: "Deputy",
    province: "Comarca Ngäbe-Buglé",
    circuit: "12-2",
    officialGovUrl: "https://www.asamblea.gob.pa/Diputados/NIXON_ANDRADE",
    accounts: [
      {
        platform: "instagram",
        handle: "nixon_andradean",
        profileUrl: "https://www.instagram.com/nixon_andradean/",
        verdict: "CONFIRMED",
        score: 90,
      },
      {
        platform: "facebook",
        handle: "nixson.andrade.18",
        profileUrl: "https://www.facebook.com/nixson.andrade.18/",
        verdict: "PROBABLE",
        score: 80,
      },
    ],
  },
  {
    externalId: "DEP-073",
    name: "Jony Guevara",
    slug: "jony-guevara",
    party: "ALZ",
    partyFull: "Partido Alianza",
    role: "Diputado",
    roleCategory: "Deputy",
    province: "Panamá",
    circuit: "8-1",
    officialGovUrl: "https://www.asamblea.gob.pa/Diputados/JONY_GUEVARA",
    accounts: [
      {
        platform: "instagram",
        handle: "joanguevara8_1",
        profileUrl: "https://www.instagram.com/joanguevara8_1/",
        verdict: "CONFIRMED",
        score: 90,
      },
    ],
  },
  {
    externalId: "DEP-074",
    name: "Ronald De Gracia",
    slug: "ronald-de-gracia",
    party: "RM",
    partyFull: "Realizando Metas",
    role: "Diputado",
    roleCategory: "Deputy",
    province: "Los Santos",
    circuit: "7-2",
    officialGovUrl: "https://www.asamblea.gob.pa/Diputados/RONALD_DE_GRACIA",
    accounts: [
      {
        platform: "instagram",
        handle: "ronalddegracia22",
        profileUrl: "https://www.instagram.com/ronalddegracia22/",
        verdict: "CONFIRMED",
        score: 90,
      },
      {
        platform: "x_twitter",
        handle: "realizandometa7",
        profileUrl: "https://x.com/realizandometa7",
        verdict: "CONFIRMED",
        score: 85,
      },
    ],
  },
  {
    externalId: "DEP-075",
    name: "Shirley Castañeda",
    slug: "shirley-castaneda",
    party: "RM",
    partyFull: "Realizando Metas",
    role: "Diputada",
    roleCategory: "Deputy",
    province: "Panamá Oeste",
    circuit: "13-1",
    officialGovUrl:
      "https://www.asamblea.gob.pa/Diputados/SHIRLEY__CASTA%C3%91EDAS",
    accounts: [
      {
        platform: "instagram",
        handle: "shirleycastrm",
        profileUrl: "https://www.instagram.com/shirleycastrm/",
        verdict: "CONFIRMED",
        score: 95,
      },
      {
        platform: "x_twitter",
        handle: "ShirleyCastRM",
        profileUrl: "https://x.com/ShirleyCastRM",
        verdict: "CONFIRMED",
        score: 95,
      },
      {
        platform: "tiktok",
        handle: "shirleycastrm",
        profileUrl: "https://www.tiktok.com/@shirleycastrm",
        verdict: "PROBABLE",
        score: 75,
      },
    ],
  },
  {
    externalId: "DEP-076",
    name: "Jorge González López",
    slug: "jorge-gonzalez-lopez",
    party: "LP",
    partyFull: "Libre Postulación",
    role: "Diputado",
    roleCategory: "Deputy",
    province: "Panamá",
    circuit: "8-5",
    officialGovUrl: "https://www.asamblea.gob.pa/Diputados/JORGE_GONZALEZ",
    accounts: [
      {
        platform: "instagram",
        handle: "jorgealbertogonzalez01",
        profileUrl: "https://www.instagram.com/jorgealbertogonzalez01/",
        verdict: "CONFIRMED",
        score: 90,
      },
    ],
  },
  {
    externalId: "DEP-077",
    name: "Tomás Benavides",
    slug: "tomas-benavides",
    party: "RM",
    partyFull: "Realizando Metas",
    role: "Diputado",
    roleCategory: "Deputy",
    province: "Veraguas",
    circuit: "9-2",
    officialGovUrl: "https://www.asamblea.gob.pa/Diputados/TOMAS_BENAVIDES",
    accounts: [
      {
        platform: "instagram",
        handle: "drtomybenavides",
        profileUrl: "https://www.instagram.com/drtomybenavides/",
        verdict: "CONFIRMED",
        score: 90,
      },
    ],
  },
  {
    externalId: "DEP-078",
    name: "Victor Castillo",
    slug: "victor-castillo",
    party: "RM",
    partyFull: "Realizando Metas",
    role: "Diputado",
    roleCategory: "Deputy",
    province: "Colón",
    circuit: "3-1",
    officialGovUrl:
      "https://www.asamblea.gob.pa/Diputados/ViCTOR_DE_JESuS",
    accounts: [
      {
        platform: "instagram",
        handle: "victordejesuscastillocortez",
        profileUrl:
          "https://www.instagram.com/victordejesuscastillocortez/",
        verdict: "CONFIRMED",
        score: 85,
      },
    ],
  },
  {
    externalId: "DEP-079",
    name: "Nelson Jackson Palma",
    slug: "nelson-jackson-palma",
    party: "RM",
    partyFull: "Realizando Metas",
    role: "Diputado",
    roleCategory: "Deputy",
    province: "Colón",
    circuit: "3-2",
    officialGovUrl: "https://www.asamblea.gob.pa/Diputados/NELSON_JACKSON",
    // No confirmed social media accounts found
    accounts: [],
  },
  {
    externalId: "DEP-080",
    name: "Flor Brenes",
    slug: "flor-brenes",
    party: "PRD",
    partyFull: "Partido Revolucionario Democrático",
    role: "Diputada",
    roleCategory: "Deputy",
    province: "Comarca Ngäbe-Buglé",
    circuit: "10-1",
    officialGovUrl: "https://www.asamblea.gob.pa/Diputados/FLOR_BRENES",
    accounts: [
      {
        platform: "instagram",
        handle: "florbrenes2024",
        profileUrl: "https://www.instagram.com/florbrenes2024/",
        verdict: "CONFIRMED",
        score: 85,
      },
      {
        platform: "facebook",
        handle: "flor.brenes.613305",
        profileUrl: "https://www.facebook.com/flor.brenes.613305/",
        verdict: "CONFIRMED",
        score: 85,
      },
    ],
  },
  {
    externalId: "DEP-081",
    name: "Gertrudis Rodríguez",
    slug: "gertrudis-rodriguez",
    party: "CD",
    partyFull: "Cambio Democrático",
    role: "Diputada",
    roleCategory: "Deputy",
    province: "Comarca Ngäbe-Buglé",
    circuit: "12-3",
    officialGovUrl:
      "https://www.asamblea.gob.pa/Diputados/GERTRUDIS_TULE_RODRIGUEZ",
    // No confirmed social media accounts found
    accounts: [],
  },
  {
    externalId: "DEP-082",
    name: "Carlos Afú",
    slug: "carlos-afu",
    party: "CD",
    partyFull: "Cambio Democrático",
    role: "Diputado",
    roleCategory: "Deputy",
    province: "Los Santos",
    circuit: "7-1",
    officialGovUrl:
      "https://www.asamblea.gob.pa/Diputados/CARLOS_TITO_AFU",
    wikipediaUrl: "https://es.wikipedia.org/wiki/Carlos_Af%C3%BA",
    // No confirmed social media accounts found
    accounts: [],
  },
];

async function main() {
  console.log(`Seeding ${deputies.length} deputies to ${CONVEX_URL}`);

  for (const dep of deputies) {
    const { accounts, ...polFields } = dep;

    // Create politician record
    const polId = await client.mutation(api.politicians.create, {
      ...polFields,
      hasHeadshot: false,
      headshot: `/images/headshots/${dep.externalId}.jpg`,
    });

    console.log(`  ✓ Created ${dep.name} (${dep.externalId}) -> ${polId}`);

    // Create social media accounts
    for (const acct of accounts) {
      await client.mutation(api.accounts.create, {
        politicianId: polId,
        platform: acct.platform,
        handle: acct.handle,
        profileUrl: acct.profileUrl,
        avatar: `/images/avatars/${dep.externalId}-${acct.platform}.jpg`,
        verdict: acct.verdict,
        score: acct.score,
        pollingTier: "warm",
      });
      console.log(`    + ${acct.platform}: @${acct.handle}`);
    }
  }

  console.log(`\nDone! ${deputies.length} deputies created.`);
}

main().catch(console.error);
