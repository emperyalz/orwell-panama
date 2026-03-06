#!/usr/bin/env node
/**
 * Seed deputy biographical data into Convex from the enriched JSON.
 *
 * Usage:
 *   node scripts/seed-deputy-bios.mjs
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

// ── Load env ─────────────────────────────────────────────
function loadEnv() {
  try {
    const envFile = readFileSync(resolve(PROJECT_ROOT, ".env.local"), "utf-8");
    for (const line of envFile.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
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

// ── Transform ────────────────────────────────────────────
function transformBio(d) {
  const bio = {
    diputadoId: d.diputado_id,
    deputyId: d.deputy_507_id,
    nombreCompleto: d.nombre_completo,
    nombres: d.nombres,
    apellidos: d.apellidos,
    slug: d.slug,
    partido: d.partido,
    partyCode: d.party_code_507 || "",
    provincia: d.provincia,
    circuito: d.circuito,
    suplentes: d.suplentes || undefined,
    correo: d.correo || undefined,
    profileUrl: d.profile_url || undefined,
    fotoUrl: d.foto_url || undefined,
    pdfUrl: d.pdf_url || undefined,
    hasPdf: d.has_pdf || false,
    resumeText: d.resume_text || undefined,
    resumePages: d.resume_pages || undefined,
    seatNumber: d.seat_number || undefined,
    gender: d.gender || undefined,
    bancada: d.bancada || undefined,
    bancadaFull: d.bancada_full || undefined,
    bancadaColor: d.bancada_color || undefined,
    cssReformVote: d.css_reform_vote || undefined,
    aiSummary: d.ai_summary || undefined,
    aiKeyQualifications: d.ai_key_qualifications || undefined,
    aiEducationLevel: d.ai_education_level || undefined,
    aiYearsExperience: d.ai_years_experience || undefined,
    aiProfessionalSector: d.ai_professional_sector || undefined,
  };

  // Transform structured_data if present
  if (d.structured_data) {
    const sd = d.structured_data;
    bio.structuredData = {
      fechaNacimiento: sd.fecha_nacimiento || undefined,
      cedula: sd.cedula || undefined,
      estadoCivil: sd.estado_civil || undefined,
      direccion: sd.direccion || undefined,
      educacion: (sd.educacion || []).map((e) => ({
        institucion: e.institucion || undefined,
        titulo: e.titulo || undefined,
        periodo: e.periodo || undefined,
        descripcion: e.descripcion || undefined,
      })),
      experienciaLaboral: (sd.experiencia_laboral || []).map((e) => ({
        empresa: e.empresa || undefined,
        cargo: e.cargo || undefined,
        periodo: e.periodo || undefined,
        descripcion: e.descripcion || undefined,
      })),
      cargosPoliticos: (sd.cargos_politicos || []).map((e) => ({
        cargo: e.cargo || undefined,
        periodo: e.periodo || undefined,
        partido: e.partido || undefined,
      })),
      habilidades: sd.habilidades || [],
      idiomas: sd.idiomas || [],
      seminariosCursos: sd.seminarios_cursos || [],
    };
  }

  return bio;
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  console.log("═".repeat(60));
  console.log("  DEPUTY BIOS → CONVEX LOADER");
  console.log("═".repeat(60));

  const dataPath = resolve(
    PROJECT_ROOT,
    "../../Downloads/diputados_enriched_database.json"
  );
  console.log(`  Source: ${dataPath}`);
  console.log(`  Convex: ${CONVEX_URL}`);
  console.log();

  const raw = JSON.parse(readFileSync(dataPath, "utf-8"));
  console.log(`  Loaded ${raw.length} deputy records`);

  const bios = raw.map(transformBio);
  console.log(`  Transformed ${bios.length} bios`);
  console.log();

  // Send all 71 in one batch (well within Convex limits)
  console.log("  Seeding deputy bios...");
  const result = await client.mutation(api.votingIngestion.seedDeputyBios, {
    bios,
  });
  console.log(`  ✓ ${result.inserted} inserted, ${result.updated} updated`);
  console.log();

  console.log("═".repeat(60));
  console.log("  COMPLETE");
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
