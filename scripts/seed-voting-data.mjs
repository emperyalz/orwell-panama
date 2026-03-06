#!/usr/bin/env node
/**
 * Seed voting records into Convex from CSV data.
 *
 * Usage:
 *   node scripts/seed-voting-data.mjs
 *
 * Requires NEXT_PUBLIC_CONVEX_URL in .env.local
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(PROJECT_ROOT, "data/voting-records/asamblea_data");

// ── Load env ─────────────────────────────────────────────
function loadEnv() {
  try {
    const envFile = readFileSync(resolve(PROJECT_ROOT, ".env.local"), "utf-8");
    for (const line of envFile.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch { /* ignore */ }
}
loadEnv();

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// ── CSV parser ───────────────────────────────────────────
function parseCSV(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Parse header - handle quoted fields
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── Name matching ────────────────────────────────────────
function normalize(name) {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildNameMap(deputies) {
  // Fetch all politicians from Convex
  const politicians = [];
  // Use a simple paginated approach — Convex query limit
  // We'll call the politicians list query
  // Actually we need to use the dashboard or a query. Let's just do it simply.
  console.log("  Building name → politician mapping...");

  // Read the source JSON to get politician names
  const dbPath = resolve(
    PROJECT_ROOT,
    "../orwell-discovery/data/verified/FINAL-DATABASE.json"
  );
  let politicianNames = [];
  try {
    const data = JSON.parse(readFileSync(dbPath, "utf-8"));
    politicianNames = (data.politicians || data).map((p) => ({
      externalId: p.id,
      name: p.name,
      normalized: normalize(p.name),
    }));
  } catch {
    console.log("  ⚠ Could not load FINAL-DATABASE.json, skipping name matching");
    return {};
  }

  const nameMap = {}; // deputyId -> politician externalId

  for (const dep of deputies) {
    const depNorm = normalize(dep.full_name);
    const depTokens = depNorm.split(" ");
    const depFirst = depTokens[0];
    const depLast = depTokens[depTokens.length - 1];

    for (const pol of politicianNames) {
      const polTokens = pol.normalized.split(" ");
      const polFirst = polTokens[0];
      const polLast = polTokens[polTokens.length - 1];

      if (depFirst === polFirst && depLast === polLast) {
        nameMap[dep.deputy_id] = pol.externalId;
        break;
      }
    }
  }

  console.log(
    `  Matched ${Object.keys(nameMap).length} of ${deputies.length} deputies to politicians`
  );
  return nameMap;
}

// ── Batch helper ─────────────────────────────────────────
async function batchMutate(mutationFn, items, batchSize, argName, label) {
  const total = items.length;
  const batches = Math.ceil(total / batchSize);
  let totalInserted = 0;

  for (let i = 0; i < batches; i++) {
    const batch = items.slice(i * batchSize, (i + 1) * batchSize);
    try {
      const result = await client.mutation(mutationFn, { [argName]: batch });
      totalInserted += result.inserted;
    } catch (err) {
      console.error(`  ✗ Batch ${i + 1}/${batches} failed:`, err.message);
      // Retry once after delay
      await sleep(2000);
      try {
        const result = await client.mutation(mutationFn, { [argName]: batch });
        totalInserted += result.inserted;
      } catch (err2) {
        console.error(`  ✗ Retry failed:`, err2.message);
      }
    }

    const done = Math.min((i + 1) * batchSize, total);
    const pct = ((done / total) * 100).toFixed(0);
    process.stdout.write(`\r  ${label}: ${done}/${total} (${pct}%) — ${totalInserted} inserted`);

    if (i < batches - 1) await sleep(50);
  }
  console.log();
  return totalInserted;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Parse timestamp to epoch ms ──────────────────────────
function toEpoch(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  console.log("═".repeat(60));
  console.log("  VOTING RECORDS → CONVEX LOADER");
  console.log("═".repeat(60));
  console.log(`  Convex: ${CONVEX_URL}`);
  console.log(`  Data:   ${DATA_DIR}`);
  console.log();

  // Phase 1: Parse CSVs
  console.log("Phase 1: Parsing CSVs...");
  const votingsRaw = parseCSV(resolve(DATA_DIR, "votings.csv"));
  const deputiesRaw = parseCSV(resolve(DATA_DIR, "deputies.csv"));
  const votesRaw = parseCSV(resolve(DATA_DIR, "votes.csv"));
  console.log(`  votings.csv:  ${votingsRaw.length} rows`);
  console.log(`  deputies.csv: ${deputiesRaw.length} rows`);
  console.log(`  votes.csv:    ${votesRaw.length} rows`);
  console.log();

  // Phase 2: Build name map
  console.log("Phase 2: Name matching...");
  const nameMap = await buildNameMap(deputiesRaw);
  console.log();

  // We need politicianId (Convex _id) not externalId. We'll skip the Convex lookup
  // for now and store null — the politicianId linking can be done as a post-step
  // via a Convex mutation that looks up by externalId.
  // For now, politicianId will be undefined (optional field).

  // Phase 3: Seed lawsVoted
  console.log("Phase 3: Seeding lawsVoted...");

  // Aggregate vote totals per voting from votes.csv
  const voteTotals = {};
  for (const v of votesRaw) {
    const vid = v.voting_id;
    if (!voteTotals[vid]) {
      voteTotals[vid] = {
        totalAFavor: parseInt(v.total_a_favor) || 0,
        totalEnContra: parseInt(v.total_en_contra) || 0,
        totalAbstencion: parseInt(v.total_abstencion) || 0,
      };
    }
  }

  const laws = votingsRaw.map((v) => ({
    votingId: parseInt(v.voting_id),
    reportId: parseInt(v.report_id),
    sessionId: parseInt(v.session_id),
    sessionDate: toEpoch(v.session_date),
    sessionType: v.session_type || "Unknown",
    votingTitle: v.voting_title || "",
    votingDescription: v.voting_description || undefined,
    isSecret: v.is_secret === "True",
    votingStart: v.voting_start ? toEpoch(v.voting_start) : undefined,
    votingEnd: v.voting_end ? toEpoch(v.voting_end) : undefined,
    totalAFavor: voteTotals[v.voting_id]?.totalAFavor ?? 0,
    totalEnContra: voteTotals[v.voting_id]?.totalEnContra ?? 0,
    totalAbstencion: voteTotals[v.voting_id]?.totalAbstencion ?? 0,
  }));

  const lawsInserted = await batchMutate(
    api.votingIngestion.seedLaws,
    laws,
    200,
    "laws",
    "lawsVoted"
  );
  console.log(`  ✓ ${lawsInserted} laws inserted`);
  console.log();

  // Phase 4: Seed votingRecords
  console.log("Phase 4: Seeding votingRecords (this takes a few minutes)...");

  // Map vote_type values
  const VOTE_MAP = {
    a_favor: "a_favor",
    en_contra: "en_contra",
    abstencion: "abstencion",
  };

  const records = votesRaw.map((v) => ({
    voteId: parseInt(v.vote_id),
    votingId: parseInt(v.voting_id),
    questionId: parseInt(v.question_id),
    deputyId: parseInt(v.deputy_id),
    deputyName: v.deputy_name || "",
    partyCode: v.party_code || "",
    circuit: v.circuit || "",
    vote: VOTE_MAP[v.vote_type] || "a_favor",
    isSuplente: v.is_suplente === "True",
    sessionDate: toEpoch(v.session_date),
    votingTitle: v.voting_title || "",
    questionText: v.question_text || "",
    questionPassed: v.question_passed === "True",
  }));

  const recordsInserted = await batchMutate(
    api.votingIngestion.seedVotingRecords,
    records,
    500,
    "records",
    "votingRecords"
  );
  console.log(`  ✓ ${recordsInserted} voting records inserted`);
  console.log();

  // Phase 5: Compute and seed deputyVotingProfiles
  console.log("Phase 5: Computing deputy profiles...");

  const profileMap = {};
  for (const v of votesRaw) {
    const did = parseInt(v.deputy_id);
    if (!profileMap[did]) {
      profileMap[did] = {
        deputyId: did,
        deputyName: v.deputy_name || "",
        partyCode: v.party_code || "",
        circuit: v.circuit || "",
        isSuplente: v.is_suplente === "True",
        totalVotes: 0,
        totalAFavor: 0,
        totalEnContra: 0,
        totalAbstencion: 0,
        sessionDates: new Set(),
        minDate: Infinity,
        maxDate: 0,
      };
    }
    const p = profileMap[did];
    p.totalVotes++;
    if (v.vote_type === "a_favor") p.totalAFavor++;
    else if (v.vote_type === "en_contra") p.totalEnContra++;
    else if (v.vote_type === "abstencion") p.totalAbstencion++;

    const sd = toEpoch(v.session_date);
    if (sd > 0) {
      p.sessionDates.add(v.session_date);
      if (sd < p.minDate) p.minDate = sd;
      if (sd > p.maxDate) p.maxDate = sd;
    }
  }

  // Total unique voting sessions for participation rate
  const totalSessions = new Set(votesRaw.map((v) => v.session_date)).size;

  const profiles = Object.values(profileMap).map((p) => ({
    deputyId: p.deputyId,
    deputyName: p.deputyName,
    partyCode: p.partyCode,
    circuit: p.circuit,
    isSuplente: p.isSuplente,
    totalVotes: p.totalVotes,
    totalAFavor: p.totalAFavor,
    totalEnContra: p.totalEnContra,
    totalAbstencion: p.totalAbstencion,
    participationRate: Math.round((p.sessionDates.size / totalSessions) * 1000) / 1000,
    firstVoteDate: p.minDate === Infinity ? 0 : p.minDate,
    lastVoteDate: p.maxDate,
    sessionsAttended: p.sessionDates.size,
  }));

  const profilesInserted = await batchMutate(
    api.votingIngestion.seedProfiles,
    profiles,
    100,
    "profiles",
    "profiles"
  );
  console.log(`  ✓ ${profilesInserted} deputy profiles inserted`);
  console.log();

  // Phase 6: Summary
  console.log("═".repeat(60));
  console.log("  COMPLETE");
  console.log("═".repeat(60));
  console.log(`  Laws:     ${lawsInserted}`);
  console.log(`  Votes:    ${recordsInserted}`);
  console.log(`  Profiles: ${profilesInserted}`);
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
