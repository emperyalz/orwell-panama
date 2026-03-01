/**
 * Download hi-res headshots from asamblea.gob.pa to replace low-res thumbnails.
 *
 * Uses the /foto/ path (which provides full-resolution official portraits),
 * then optimizes via sharp to ~150-250KB web-ready JPEGs (800px wide).
 *
 * Matches our politicians.json entries to the asamblea photo mapping via
 * the officialGovUrl slug.
 *
 * Usage: node scripts/download-hires-headshots.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { createRequire } from "module";
import https from "https";
import http from "http";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const DRY_RUN = process.argv.includes("--dry-run");

const ROOT = resolve(process.cwd());
const POLITICIANS_JSON = join(ROOT, "src/data/politicians.json");
const MAPPING_JSON = join(
  ROOT,
  "../orwell-discovery/data/gov-official/asamblea-photo-mapping.json"
);
const HEADSHOTS_DIR = join(ROOT, "public/images/headshots");

/** Download a URL and return the buffer */
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    proto
      .get(url, { headers: { "User-Agent": "OrwellPanama/1.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return downloadBuffer(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/** Extract the asamblea slug from a profile_page_url */
function extractSlug(url) {
  if (!url) return null;
  const match = url.match(/\/Diputados\/(.+)$/);
  return match ? match[1].toUpperCase() : null;
}

async function main() {
  // Load our politician data
  const politicians = JSON.parse(readFileSync(POLITICIANS_JSON, "utf-8"));
  console.log(`Loaded ${politicians.length} politicians from JSON`);

  // Load asamblea photo mapping
  const mapping = JSON.parse(readFileSync(MAPPING_JSON, "utf-8"));
  console.log(
    `Loaded ${mapping.deputies.length} deputies from asamblea mapping`
  );

  // Build lookup: profile slug -> deputy entry
  const slugToDeputy = new Map();
  for (const dep of mapping.deputies) {
    const slug = extractSlug(dep.profile_page_url);
    if (slug) {
      slugToDeputy.set(slug, dep);
    }
  }

  let matched = 0;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let noMatch = 0;
  const failures = [];

  for (const pol of politicians) {
    // Only process deputies (they have asamblea URLs)
    if (!pol.officialGovUrl || !pol.officialGovUrl.includes("asamblea.gob.pa")) {
      skipped++;
      continue;
    }

    const slug = extractSlug(pol.officialGovUrl);
    if (!slug) {
      console.log(`  ⚠️  No slug extracted: ${pol.name} → ${pol.officialGovUrl}`);
      noMatch++;
      continue;
    }

    const deputy = slugToDeputy.get(slug);
    if (!deputy) {
      console.log(`  ❌ No mapping match: ${pol.name} (slug: ${slug})`);
      noMatch++;
      continue;
    }

    // Use thumbnail_url (/foto/ path) — these are the full-resolution portraits
    const photoUrl = deputy.thumbnail_url;
    if (!photoUrl) {
      console.log(`  ⏭  No photo available: ${pol.name}`);
      skipped++;
      continue;
    }

    matched++;
    const destPath = join(HEADSHOTS_DIR, `${pol.id}.jpg`);

    if (DRY_RUN) {
      console.log(
        `  [DRY] Would download: ${pol.name} (${pol.id})\n         from: ${photoUrl}\n         to:   ${destPath}`
      );
      continue;
    }

    try {
      // Download raw buffer
      const rawBuffer = await downloadBuffer(photoUrl);
      const rawKb = (rawBuffer.length / 1024).toFixed(0);

      // Optimize with sharp: resize to 800px wide, JPEG quality 85
      const optimized = await sharp(rawBuffer)
        .resize(800, null, { withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      writeFileSync(destPath, optimized);
      const optKb = (optimized.length / 1024).toFixed(0);
      console.log(
        `  ✅ ${pol.name} (${pol.id}) → ${rawKb}KB raw → ${optKb}KB optimized`
      );
      downloaded++;

      // Small delay to be polite
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.log(`  ❌ FAILED ${pol.name}: ${err.message}`);
      failures.push({ name: pol.name, id: pol.id, error: err.message });
      failed++;
    }
  }

  console.log("\n─── Summary ───");
  console.log(`Total politicians: ${politicians.length}`);
  console.log(`Matched to asamblea: ${matched}`);
  console.log(`Downloaded & optimized: ${downloaded}`);
  console.log(`Skipped (no URL or no photo): ${skipped}`);
  console.log(`No match found: ${noMatch}`);
  console.log(`Failed: ${failed}`);

  if (failures.length > 0) {
    console.log("\nFailed downloads:");
    for (const f of failures) {
      console.log(`  - ${f.name} (${f.id}): ${f.error}`);
    }
  }
}

main().catch(console.error);
