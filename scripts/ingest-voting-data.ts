/**
 * Ingest voting CSV data into Convex.
 *
 * Usage:
 *   npx tsx scripts/ingest-voting-data.ts
 *
 * Prerequisites:
 *   - Convex dev server running (`npx convex dev`)
 *   - CSV files in data/voting-records/asamblea_data/
 *
 * This script:
 *   1. Reads deputies.csv → upserts deputyVotingProfiles
 *   2. Reads votings.csv → upserts votingSessions
 *   3. Reads votes.csv → upserts votingRecords (in batches)
 *   4. Links deputyIds to politicianIds via name matching
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

const CONVEX_URL = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL env variable");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Simple CSV parser (no external dep)
function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

async function ingestDeputies() {
  console.log("Loading deputies.csv...");
  const filePath = path.join(
    __dirname,
    "../data/voting-records/asamblea_data/deputies.csv"
  );
  const rows = parseCSV(filePath);
  console.log(`  Found ${rows.length} deputies`);

  // Fetch existing politicians for linking
  const politicians = await client.query(api.politicians.list, {});
  const politicianByName = new Map<string, string>();
  for (const p of politicians) {
    politicianByName.set(p.name.toLowerCase(), p._id);
  }

  const BATCH_SIZE = 25;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      const fullName = row.full_name ?? `${row.first_name} ${row.last_name}`;
      const politicianId = politicianByName.get(fullName.toLowerCase());

      await client.mutation(api.ingestVoting.upsertDeputyProfile, {
        deputyId: parseInt(row.deputy_id),
        fullName,
        partyCode: row.party_code ?? "",
        partyName: row.party_name ?? "",
        partyColor: row.party_color ?? "#888888",
        circuit: row.circuit ?? "",
        seat: parseInt(row.seat) || 0,
        isSuplente: row.is_suplente === "True",
        principalId: row.principal_id ? parseInt(row.principal_id) : undefined,
        principalName: row.principal_name || undefined,
        gender: row.gender || undefined,
        politicianId: (politicianId as any) ?? undefined,
      });
    }
    console.log(
      `  Deputies: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`
    );
  }
}

async function ingestVotingSessions() {
  console.log("Loading votings.csv...");
  const filePath = path.join(
    __dirname,
    "../data/voting-records/asamblea_data/votings.csv"
  );
  const rows = parseCSV(filePath);
  console.log(`  Found ${rows.length} voting sessions`);

  const BATCH_SIZE = 25;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      await client.mutation(api.ingestVoting.upsertVotingSession, {
        votingId: parseInt(row.voting_id),
        reportId: parseInt(row.report_id),
        sessionId: parseInt(row.session_id),
        sessionDate: row.session_date,
        sessionType: row.session_type ?? "",
        votingTitle: row.voting_title ?? "",
        votingDescription: row.voting_description || undefined,
      });
    }
    console.log(
      `  Sessions: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`
    );
  }
}

async function ingestVotes() {
  console.log("Loading votes.csv (this will take a while)...");
  const filePath = path.join(
    __dirname,
    "../data/voting-records/asamblea_data/votes.csv"
  );
  const rows = parseCSV(filePath);
  console.log(`  Found ${rows.length} vote records`);

  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const records = batch.map((row) => ({
      votingId: parseInt(row.voting_id),
      questionId: parseInt(row.question_id),
      questionText: row.question_text ?? "",
      questionPassed: row.question_passed === "True",
      votesNeeded: parseInt(row.votes_needed) || 36,
      totalAFavor: parseInt(row.total_a_favor) || 0,
      totalEnContra: parseInt(row.total_en_contra) || 0,
      totalAbstencion: parseInt(row.total_abstencion) || 0,
      deputyId: parseInt(row.deputy_id),
      deputyName: row.deputy_name ?? "",
      partyCode: row.party_code ?? "",
      circuit: row.circuit ?? "",
      vote: row.vote_type ?? row.vote?.toLowerCase().replace(/ /g, "_") ?? "",
      isSuplente: row.is_suplente === "True",
      suplenteOf: row.suplente_of || undefined,
      sessionDate: row.session_date ?? "",
      votingTitle: row.voting_title ?? "",
    }));

    await client.mutation(api.ingestVoting.insertVotesBatch, { records });

    if ((i / BATCH_SIZE) % 100 === 0) {
      console.log(
        `  Votes: ${Math.min(i + BATCH_SIZE, rows.length).toLocaleString()}/${rows.length.toLocaleString()}`
      );
    }
  }
  console.log(`  Votes ingestion complete: ${rows.length.toLocaleString()} records`);
}

async function computeProfileAggregates() {
  console.log("Computing profile aggregates...");
  await client.mutation(api.ingestVoting.computeProfileStats);
  console.log("  Profile aggregates computed.");
}

async function main() {
  console.log("=== Voting Data Ingestion ===\n");

  await ingestDeputies();
  await ingestVotingSessions();
  await ingestVotes();
  await computeProfileAggregates();

  console.log("\n=== Ingestion complete! ===");
  console.log("Next step: Run analytics computation:");
  console.log("  npx convex run computeAnalytics:compute");
}

main().catch(console.error);
