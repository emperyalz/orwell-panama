#!/usr/bin/env node

/**
 * Seed Extracted Documents into Convex
 *
 * Reads the output of extract-pdf-documents.mjs and patches
 * the extracted data onto existing deputyTransparency records.
 *
 * Usage:
 *   node scripts/seed-extracted-documents.mjs          # seed to dev
 *   node scripts/seed-extracted-documents.mjs --prod    # seed to production
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const INPUT_FILE = path.join(DATA_DIR, "extracted-documents.json");

const isProd = process.argv.includes("--prod");
const CONVEX_URL = isProd
  ? "https://fleet-vole-527.convex.cloud"
  : process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    "https://fleet-vole-527.convex.cloud";

const client = new ConvexHttpClient(CONVEX_URL);

function normalize(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  console.log(`🌱 Seeding extracted documents to ${isProd ? "PRODUCTION" : "dev"}`);
  console.log(`   Convex URL: ${CONVEX_URL}\n`);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.error("   Run extract-pdf-documents.mjs first.");
    process.exit(1);
  }

  const extractedData = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  const slugs = Object.keys(extractedData);
  console.log(`📦 Loaded ${slugs.length} extracted records\n`);

  // Fetch all politicians from Convex
  const politicians = await client.query(api.politicians.list, {});
  console.log(`👥 Found ${politicians.length} politicians in database\n`);

  // Fetch all existing transparency records
  const transparencyRecords = await client.query(api.transparency.getAll, {});
  console.log(`📋 Found ${transparencyRecords.length} transparency records\n`);

  // Build lookup: slug → politicianId (from transparency records)
  const slugToRecord = {};
  for (const tr of transparencyRecords) {
    slugToRecord[tr.espacioCivicoSlug] = tr;
  }

  // Also build name lookup as fallback
  const nameToRecord = {};
  for (const tr of transparencyRecords) {
    const politician = politicians.find((p) => p._id === tr.politicianId);
    if (politician) {
      nameToRecord[normalize(politician.name)] = tr;
    }
  }

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let noData = 0;

  for (const slug of slugs) {
    const entry = extractedData[slug];
    const name = entry.name || slug;

    // Find matching transparency record
    let record = slugToRecord[slug];
    if (!record) {
      // Try name-based lookup
      record = nameToRecord[normalize(name)];
    }

    if (!record) {
      console.log(`  ⚠️  ${name}: no transparency record found`);
      notFound++;
      continue;
    }

    // Build patch data
    const patch = {};
    const extractionStatus = {};
    let hasData = false;

    for (const docType of ["propuesta", "intereses", "patrimonio"]) {
      const docEntry = entry[docType];
      if (!docEntry) continue;

      const fieldName =
        docType === "propuesta"
          ? "extractedPropuesta"
          : docType === "intereses"
            ? "extractedIntereses"
            : "extractedPatrimonio";

      if (docEntry.status === "success" && docEntry.data) {
        patch[fieldName] = docEntry.data;
        extractionStatus[docType] = {
          status: "success",
          extractedAt: Date.now(),
        };
        hasData = true;
      } else if (docEntry.status === "error") {
        extractionStatus[docType] = {
          status: "error",
          extractedAt: Date.now(),
          error: docEntry.error,
        };
      } else if (docEntry.status === "no_document") {
        extractionStatus[docType] = {
          status: "no_document",
        };
      }
    }

    if (!hasData) {
      console.log(`  ○ ${name}: no successful extractions`);
      noData++;
      continue;
    }

    patch.extractionStatus = extractionStatus;

    try {
      const result = await client.mutation(
        api.transparency.upsertExtractedDocuments,
        {
          politicianId: record.politicianId,
          ...patch,
        }
      );
      console.log(`  ✅ ${name}: ${result.action} (${Object.keys(patch).filter((k) => k.startsWith("extracted")).join(", ")})`);
      updated++;
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`);
      skipped++;
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log("📊 Seed Summary");
  console.log("═══════════════════════════════════════");
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭  Skipped: ${skipped}`);
  console.log(`  ⚠️  Not found: ${notFound}`);
  console.log(`  ○ No data: ${noData}`);
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});
