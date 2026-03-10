/**
 * Update parties with researched official websites, Wikipedia pages, and social media accounts.
 * Usage: node scripts/update-party-data.mjs
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

// Prefer shell env var over .env.local (allows targeting production)
const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL || envVars.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local or environment");
  process.exit(1);
}
console.log(`🎯 Target: ${CONVEX_URL}\n`);

// ─── Party Data (from web research agents) ─────────────────────────────────

const PARTY_DATA = {
  CD: {
    officialWebsite: "https://cambiodemocraticopty.com/",
    wikidataUrl: "https://www.wikidata.org/wiki/Q5255581",
    wikipediaUrls: [
      { language: "es", url: "https://es.wikipedia.org/wiki/Cambio_Democr%C3%A1tico_(Panam%C3%A1)" },
      { language: "en", url: "https://en.wikipedia.org/wiki/Democratic_Change_(Panama)" },
    ],
    socialAccounts: [
      { platform: "instagram", url: "https://www.instagram.com/cambio.democratico/" },
      { platform: "x_twitter", url: "https://x.com/CaDemocratico" },
      { platform: "facebook", url: "https://www.facebook.com/cdemocratico/" },
      { platform: "tiktok", url: "https://www.tiktok.com/@cambiodemocratico" },
      { platform: "youtube", url: "https://www.youtube.com/c/CambioDemocr%C3%A1tico" },
    ],
  },
  PRD: {
    officialWebsite: "https://prdespanama.com/",
    wikidataUrl: "https://www.wikidata.org/wiki/Q1630365",
    wikipediaUrls: [
      { language: "es", url: "https://es.wikipedia.org/wiki/Partido_Revolucionario_Democr%C3%A1tico" },
      { language: "en", url: "https://en.wikipedia.org/wiki/Democratic_Revolutionary_Party" },
    ],
    socialAccounts: [
      { platform: "instagram", url: "https://www.instagram.com/prdespanama/" },
      { platform: "x_twitter", url: "https://x.com/PRDesPanama" },
      { platform: "facebook", url: "https://www.facebook.com/PRDesPanama/" },
      { platform: "tiktok", url: "https://www.tiktok.com/@prdpanama" },
      { platform: "youtube", url: "https://www.youtube.com/@PRDesPanama" },
    ],
  },
  PAN: {
    officialWebsite: "https://www.panamenistas.org/",
    wikidataUrl: "https://www.wikidata.org/wiki/Q628468",
    wikipediaUrls: [
      { language: "es", url: "https://es.wikipedia.org/wiki/Partido_Paname%C3%B1ista" },
      { language: "en", url: "https://en.wikipedia.org/wiki/Paname%C3%B1ista_Party" },
    ],
    socialAccounts: [
      { platform: "instagram", url: "https://www.instagram.com/panamenistas/" },
      { platform: "x_twitter", url: "https://x.com/panamenistas" },
      { platform: "facebook", url: "https://www.facebook.com/panamenistas/" },
      { platform: "tiktok", url: "https://www.tiktok.com/@panamenistas" },
      { platform: "youtube", url: "https://www.youtube.com/channel/UCdAKD1ejw9VIDFbs73v_r0Q" },
    ],
  },
  RM: {
    officialWebsite: "https://somosrmpa.com",
    wikidataUrl: "https://www.wikidata.org/wiki/Q106319619",
    wikipediaUrls: [
      { language: "es", url: "https://es.wikipedia.org/wiki/Realizando_Metas" },
      { language: "en", url: "https://en.wikipedia.org/wiki/Realizing_Goals" },
    ],
    socialAccounts: [
      { platform: "instagram", url: "https://www.instagram.com/somosrmpa/" },
      { platform: "x_twitter", url: "https://x.com/somosrmpa" },
      { platform: "facebook", url: "https://www.facebook.com/somosrmpa/" },
      { platform: "tiktok", url: "https://www.tiktok.com/@somosrmpa" },
      { platform: "youtube", url: "https://www.youtube.com/@Somosrmpa" },
    ],
  },
  MOCA: {
    officialWebsite: "https://otrocamino.org",
    wikidataUrl: "https://www.wikidata.org/wiki/Q112828175",
    wikipediaUrls: [
      { language: "es", url: "https://es.wikipedia.org/wiki/Movimiento_Otro_Camino" },
      { language: "en", url: "https://en.wikipedia.org/wiki/Another_Way_Movement" },
    ],
    socialAccounts: [
      { platform: "instagram", url: "https://www.instagram.com/otrocaminopma/" },
      { platform: "x_twitter", url: "https://x.com/OtrocaminoPma" },
      { platform: "facebook", url: "https://www.facebook.com/otrocaminopma/" },
      { platform: "tiktok", url: "https://www.tiktok.com/@otrocaminopma" },
      { platform: "youtube", url: "https://www.youtube.com/@OtroCaminoPma" },
    ],
  },
  PP: {
    officialWebsite: "http://partidopopular.com.pa/",
    wikidataUrl: "https://www.wikidata.org/wiki/Q2732443",
    wikipediaUrls: [
      { language: "es", url: "https://es.wikipedia.org/wiki/Partido_Popular_(Panam%C3%A1)" },
      { language: "en", url: "https://en.wikipedia.org/wiki/People%27s_Party_(Panama)" },
    ],
    socialAccounts: [
      { platform: "instagram", url: "https://www.instagram.com/pp_panama/" },
      { platform: "x_twitter", url: "https://x.com/PP_Panama" },
      { platform: "facebook", url: "https://www.facebook.com/pppanama" },
      { platform: "youtube", url: "https://www.youtube.com/@PartidoPopularPanama" },
    ],
  },
  MOLIRENA: {
    officialWebsite: "https://partidomolirena.com/",
    wikidataUrl: "https://www.wikidata.org/wiki/Q3326718",
    wikipediaUrls: [
      { language: "es", url: "https://es.wikipedia.org/wiki/Movimiento_Liberal_Republicano_Nacionalista" },
      { language: "en", url: "https://en.wikipedia.org/wiki/Nationalist_Republican_Liberal_Movement" },
    ],
    socialAccounts: [
      { platform: "instagram", url: "https://www.instagram.com/molirenaoficial/" },
      { platform: "x_twitter", url: "https://x.com/molirenaoficial" },
      { platform: "facebook", url: "https://www.facebook.com/molirenaoficial/" },
      { platform: "tiktok", url: "https://www.tiktok.com/@molirenaoficial" },
      { platform: "youtube", url: "https://www.youtube.com/@MolirenaOficial" },
    ],
  },
  ALZ: {
    officialWebsite: "https://partidoalianza.com/",
    wikidataUrl: "https://www.wikidata.org/wiki/Q50537343",
    wikipediaUrls: [
      { language: "es", url: "https://es.wikipedia.org/wiki/Partido_Alianza" },
      { language: "en", url: "https://en.wikipedia.org/wiki/Alliance_Party_(Panama)" },
    ],
    socialAccounts: [
      { platform: "instagram", url: "https://www.instagram.com/partidoalianza_/" },
      { platform: "x_twitter", url: "https://x.com/partidoalianza_" },
      { platform: "facebook", url: "https://www.facebook.com/partidoalianza" },
      { platform: "youtube", url: "https://www.youtube.com/@partidoalianza_" },
    ],
  },
  // LP (Libre Postulación) — electoral mechanism, not a party
  // No official website, Wikipedia, WikiData, or social media accounts
  // IND (Independiente) — placeholder for truly unaffiliated
  // No data to update
};

// ─── Convex API helpers ─────────────────────────────────────────────────────

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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mutation ${functionName} failed: ${res.status} — ${text}`);
  }
  const data = await res.json();
  return data.value;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("📋 Fetching existing parties...");
  const parties = await convexQuery("parties:list", {});
  console.log(`   Found ${parties.length} parties\n`);

  // Build code → _id map
  const idMap = new Map(parties.map((p) => [p.code, p._id]));

  let updated = 0;
  let skipped = 0;

  for (const [code, data] of Object.entries(PARTY_DATA)) {
    const partyId = idMap.get(code);
    if (!partyId) {
      console.log(`  ⚠️  Party ${code} not found in database — skipping`);
      skipped++;
      continue;
    }

    try {
      await convexMutation("parties:update", {
        id: partyId,
        officialWebsite: data.officialWebsite,
        wikidataUrl: data.wikidataUrl,
        wikipediaUrls: data.wikipediaUrls,
        socialAccounts: data.socialAccounts,
      });
      console.log(`  ✅ ${code}: ${data.officialWebsite}`);
      console.log(`      Wikipedia: ${data.wikipediaUrls.length} languages`);
      console.log(`      Social: ${data.socialAccounts.length} accounts`);
      updated++;
    } catch (err) {
      console.error(`  ❌ ${code}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Done! Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error);
