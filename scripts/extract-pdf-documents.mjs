#!/usr/bin/env node

/**
 * PDF Document Extraction Script
 *
 * Downloads PDF documents from Espacio Cívico and extracts structured data
 * using Claude AI. Processes 3 document types:
 *   - Policy Proposals (Propuesta Política)
 *   - Declarations of Interest (Declaración de Intereses)
 *   - Asset Declarations (Declaración de Patrimonio)
 *
 * CVs are already extracted via the existing deputyBios pipeline.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/extract-pdf-documents.mjs
 *   ANTHROPIC_API_KEY=sk-... node scripts/extract-pdf-documents.mjs --test    # first 3 deputies only
 *   ANTHROPIC_API_KEY=sk-... node scripts/extract-pdf-documents.mjs --deputy "Alexandra Brenes"
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "extracted-documents.json");

// ─── Config ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const CONCURRENCY = 3; // max concurrent PDF downloads
const MODEL = "claude-sonnet-4-20250514";
const MAX_RETRIES = 2;

const isTestMode = process.argv.includes("--test");
const deputyFilter = (() => {
  const idx = process.argv.indexOf("--deputy");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── URL Validation ──────────────────────────────────────────────────────────

function isValidDocUrl(url) {
  return (
    url &&
    typeof url === "string" &&
    !url.endsWith("1") &&
    !url.endsWith("/1") &&
    url.includes("drive-image/")
  );
}

// ─── PDF Download & Text Extraction ──────────────────────────────────────────

async function downloadPdf(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ORWELL-Panama/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    throw new Error(`Unexpected content type: ${contentType}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

async function extractTextFromPdf(pdfBuffer) {
  try {
    const result = await pdfParse(pdfBuffer);
    return result.text?.trim() || "";
  } catch {
    return "";
  }
}

// ─── PDF Splitting (for oversized scanned PDFs) ─────────────────────────────

/**
 * Split a large PDF into smaller chunks that stay under the Claude base64 limit.
 * Each chunk targets ~18MB raw so base64 encoding stays under 25MB.
 */
async function splitPdfIntoChunks(pdfBuffer) {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = srcDoc.getPageCount();
  const avgPageSize = pdfBuffer.length / totalPages;

  // Target 18MB raw per chunk (~24MB base64, safely under 25MB)
  const maxRawPerChunk = 18 * 1024 * 1024;
  const pagesPerChunk = Math.max(1, Math.floor(maxRawPerChunk / avgPageSize));

  console.log(
    `\n    📄 Splitting ${totalPages} pages (avg ${(avgPageSize / 1024).toFixed(0)}KB/page) into chunks of ${pagesPerChunk} pages`
  );

  const chunks = [];
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    const chunkDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: end - start }, (_, i) => start + i);
    const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      chunkDoc.addPage(page);
    }
    const chunkBytes = await chunkDoc.save();
    chunks.push(Buffer.from(chunkBytes));
  }

  console.log(`    📄 Created ${chunks.length} chunks: ${chunks.map((c) => `${(c.length / 1024 / 1024).toFixed(1)}MB`).join(", ")}`);
  return chunks;
}

/**
 * Merge extraction results from multiple PDF chunks.
 * Each doc type has different array fields to concatenate.
 */
function mergeChunkResults(chunkResults, docType) {
  if (chunkResults.length === 0) throw new Error("No chunk results to merge");
  if (chunkResults.length === 1) return chunkResults[0];

  if (docType === "patrimonio") {
    const merged = {
      bienesInmuebles: chunkResults.flatMap((c) => c.bienesInmuebles || []),
      vehiculos: chunkResults.flatMap((c) => c.vehiculos || []),
      cuentasBancarias: chunkResults.flatMap((c) => c.cuentasBancarias || []),
      inversiones: chunkResults.flatMap((c) => c.inversiones || []),
      deudas: chunkResults.flatMap((c) => c.deudas || []),
      patrimonioNeto: chunkResults.reduce((acc, c) => c.patrimonioNeto || acc, null),
    };
    merged.totalInmuebles = merged.bienesInmuebles.length;
    merged.totalVehiculos = merged.vehiculos.length;
    merged.totalCuentas = merged.cuentasBancarias.length;
    merged.totalDeudas = merged.deudas.length;
    return merged;
  }

  if (docType === "intereses") {
    const merged = {
      actividadesComerciales: chunkResults.flatMap((c) => c.actividadesComerciales || []),
      membresias: chunkResults.flatMap((c) => c.membresias || []),
      fuentesIngreso: chunkResults.flatMap((c) => c.fuentesIngreso || []),
      conflictosDeclarados: chunkResults.flatMap((c) => c.conflictosDeclarados || []),
      parientesEnGobierno: chunkResults.flatMap((c) => c.parientesEnGobierno || []),
    };
    merged.totalEmpresas = merged.actividadesComerciales.length;
    merged.totalMembresias = merged.membresias.length;
    merged.totalFuentesIngreso = merged.fuentesIngreso.length;
    return merged;
  }

  if (docType === "propuesta") {
    return {
      resumenEjecutivo: chunkResults.find((c) => c.resumenEjecutivo)?.resumenEjecutivo || "",
      areasEstrategicas: chunkResults.flatMap((c) => c.areasEstrategicas || []),
      promesasClave: chunkResults.flatMap((c) => c.promesasClave || []),
      gruposBeneficiarios: [...new Set(chunkResults.flatMap((c) => c.gruposBeneficiarios || []))],
      temasPrioritarios: [...new Set(chunkResults.flatMap((c) => c.temasPrioritarios || []))],
      presupuestoMencionado: chunkResults.find((c) => c.presupuestoMencionado)?.presupuestoMencionado || null,
      tieneIndicadores: chunkResults.some((c) => c.tieneIndicadores),
      indicadores: chunkResults.flatMap((c) => c.indicadores || []),
    };
  }

  // Fallback: return first result
  return chunkResults[0];
}

// ─── Claude AI Extraction ────────────────────────────────────────────────────

const PROMPTS = {
  propuesta: `You are analyzing a Panamanian deputy's political proposal document ("Propuesta Política").
Extract structured information from the PDF text below. The document is in Spanish.

Return a JSON object with EXACTLY this structure:
{
  "resumenEjecutivo": "string — Brief executive summary of the proposal (2-3 sentences max)",
  "areasEstrategicas": [
    {
      "area": "string — Name of strategic area",
      "propuestas": ["string — Specific proposals within this area"]
    }
  ],
  "promesasClave": ["string — Key promises or commitments"],
  "gruposBeneficiarios": ["string — Target beneficiary groups"],
  "temasPrioritarios": ["string — Priority themes/topics"],
  "presupuestoMencionado": "string | null — Budget mentioned, if any",
  "tieneIndicadores": false,
  "indicadores": ["string — Specific KPIs or measurable targets mentioned, if any"]
}

Rules:
- All text fields in Spanish
- If a field is not found in the document, use an empty array [] or null
- Keep resumenEjecutivo under 200 characters
- Extract actual content, don't invent or hallucinate data
- tieneIndicadores should be true only if the document contains specific measurable targets
- Return ONLY the JSON, no markdown fences or explanation`,

  intereses: `You are analyzing a Panamanian deputy's Declaration of Interests ("Declaración de Intereses").
Extract structured information from the PDF text below. The document is in Spanish.

Return a JSON object with EXACTLY this structure:
{
  "actividadesComerciales": [
    {
      "empresa": "string — Company/entity name",
      "cargo": "string — Position held",
      "tipo": "string — Type: 'Privada' | 'Pública' | 'Mixta' | 'ONG' | 'Otro'"
    }
  ],
  "membresias": [
    {
      "organizacion": "string — Organization name",
      "cargo": "string — Position/role"
    }
  ],
  "fuentesIngreso": [
    {
      "fuente": "string — Income source",
      "tipo": "string — Type: 'Salario' | 'Honorarios' | 'Inversiones' | 'Alquiler' | 'Otro'"
    }
  ],
  "conflictosDeclarados": ["string — Any declared conflicts of interest"],
  "parientesEnGobierno": [
    {
      "nombre": "string — Relative's name",
      "cargo": "string — Government position",
      "relacion": "string — Relationship"
    }
  ],
  "totalEmpresas": 0,
  "totalMembresias": 0,
  "totalFuentesIngreso": 0
}

Rules:
- All text fields in Spanish
- If a section is not found or is empty, use empty arrays []
- totalEmpresas/totalMembresias/totalFuentesIngreso should match array lengths
- Extract actual content, don't invent or hallucinate data
- Return ONLY the JSON, no markdown fences or explanation`,

  patrimonio: `You are analyzing a Panamanian deputy's Asset Declaration ("Declaración Patrimonial" / "Declaración de Patrimonio").
Extract structured information from the PDF text below. The document is in Spanish.

Return a JSON object with EXACTLY this structure:
{
  "bienesInmuebles": [
    {
      "descripcion": "string — Property description",
      "ubicacion": "string — Location",
      "valorEstimado": "string — Estimated value (e.g. 'B/. 150,000')"
    }
  ],
  "vehiculos": [
    {
      "descripcion": "string — Vehicle description (make, model, year)",
      "valorEstimado": "string — Estimated value"
    }
  ],
  "cuentasBancarias": [
    {
      "banco": "string — Bank name",
      "tipo": "string — Account type",
      "montoAproximado": "string — Approximate balance"
    }
  ],
  "inversiones": [
    {
      "tipo": "string — Investment type",
      "descripcion": "string — Description",
      "valorEstimado": "string — Estimated value"
    }
  ],
  "deudas": [
    {
      "acreedor": "string — Creditor",
      "tipo": "string — Debt type (hipoteca, préstamo personal, etc.)",
      "montoAproximado": "string — Approximate amount"
    }
  ],
  "patrimonioNeto": "string | null — Net worth if stated (e.g. 'B/. 500,000')",
  "totalInmuebles": 0,
  "totalVehiculos": 0,
  "totalCuentas": 0,
  "totalDeudas": 0
}

Rules:
- All monetary values keep the original format (e.g. "B/. 150,000" or "$150,000")
- All text fields in Spanish
- If a section is empty, use empty array []
- totals should match array lengths
- patrimonioNeto is null if not explicitly stated
- Extract actual content, don't invent or hallucinate data
- Return ONLY the JSON, no markdown fences or explanation`,
};

/**
 * Extract structured data using Claude.
 * If pdfText has enough content, use text mode.
 * Otherwise, send the raw PDF as base64 for Claude's vision/PDF support.
 */
async function extractWithClaude(pdfText, pdfBuffer, docType, deputyName) {
  const prompt = PROMPTS[docType];
  if (!prompt) throw new Error(`Unknown document type: ${docType}`);

  const useVision = !pdfText || pdfText.length < 50;

  // Truncate very long texts to stay within token limits
  const maxChars = 60000;
  const truncatedText =
    pdfText && pdfText.length > maxChars
      ? pdfText.slice(0, maxChars) + "\n...[truncated]"
      : pdfText;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let messages;

      if (useVision) {
        // Send PDF as base64 document for Claude to read (scanned/image PDF)
        const base64Pdf = pdfBuffer.toString("base64");

        // If base64 exceeds 25MB, split into chunks and process separately
        if (base64Pdf.length > 25 * 1024 * 1024) {
          process.stdout.write(` → splitting oversized PDF (${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB)...`);
          const chunks = await splitPdfIntoChunks(pdfBuffer);
          const chunkResults = [];

          for (let ci = 0; ci < chunks.length; ci++) {
            const chunkBase64 = chunks[ci].toString("base64");
            if (chunkBase64.length > 25 * 1024 * 1024) {
              console.warn(`\n    ⚠️  Chunk ${ci + 1}/${chunks.length} still too large (${(chunkBase64.length / 1024 / 1024).toFixed(1)}MB base64), skipping`);
              continue;
            }
            process.stdout.write(`\n    📄 Chunk ${ci + 1}/${chunks.length}...`);
            const chunkResponse = await anthropic.messages.create({
              model: MODEL,
              max_tokens: 4096,
              messages: [{
                role: "user",
                content: [
                  {
                    type: "document",
                    source: { type: "base64", media_type: "application/pdf", data: chunkBase64 },
                  },
                  {
                    type: "text",
                    text: `${prompt}\n\nThe above is page chunk ${ci + 1} of ${chunks.length} of the PDF document for deputy ${deputyName}. Extract the structured data from this chunk.`,
                  },
                ],
              }],
            });
            const chunkText = chunkResponse.content[0]?.text || "";
            const chunkJson = chunkText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
            try {
              chunkResults.push(JSON.parse(chunkJson));
              process.stdout.write(" ✅");
            } catch {
              process.stdout.write(" ⚠️ (parse error, skipping chunk)");
            }
            // Rate limit between chunks
            await sleep(1500);
          }

          if (chunkResults.length === 0) {
            throw new Error("All chunks failed to extract");
          }
          return mergeChunkResults(chunkResults, docType);
        }

        messages = [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Pdf,
                },
              },
              {
                type: "text",
                text: `${prompt}\n\nThe above is the PDF document for deputy ${deputyName}. Extract the structured data.`,
              },
            ],
          },
        ];
      } else {
        messages = [
          {
            role: "user",
            content: `${prompt}\n\n--- DOCUMENT TEXT (${deputyName}) ---\n${truncatedText}`,
          },
        ];
      }

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages,
      });

      const text = response.content[0]?.text || "";
      // Try to parse JSON — handle cases where model wraps in markdown
      const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(jsonStr);
      return parsed;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(
          `\n    ⚠️  Retry ${attempt + 1}/${MAX_RETRIES} for ${deputyName} (${docType}): ${err.message}`
        );
        await sleep(2000 * (attempt + 1));
      } else {
        throw err;
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 PDF Document Extraction Pipeline");
  console.log("════════════════════════════════════\n");

  // Load deputy data
  const rawData = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "espacio-civico-deputies.json"), "utf-8")
  );

  // Filter deputies
  let deputies = rawData;
  if (deputyFilter) {
    deputies = deputies.filter((d) =>
      d.name.toLowerCase().includes(deputyFilter.toLowerCase())
    );
    console.log(`🎯 Filtering to: "${deputyFilter}" (${deputies.length} matches)\n`);
  } else if (isTestMode) {
    // Pick deputies that have all document types for testing
    const withAll = deputies.filter(
      (d) =>
        isValidDocUrl(d.documents?.propuestaPoliticaUrl) &&
        isValidDocUrl(d.documents?.declaracionInteresesUrl) &&
        isValidDocUrl(d.documents?.declaracionPatrimonioUrl)
    );
    deputies = withAll.slice(0, 3);
    console.log(
      `🧪 TEST MODE: Processing first 3 deputies with full documents: ${deputies.map((d) => d.name).join(", ")}\n`
    );
  }

  // Load existing results to enable resumption
  let existingResults = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingResults = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
      console.log(`📦 Loaded ${Object.keys(existingResults).length} existing results\n`);
    } catch {
      console.log("📦 Starting fresh (could not parse existing output)\n");
    }
  }

  const results = { ...existingResults };
  const stats = {
    propuesta: { success: 0, error: 0, skipped: 0 },
    intereses: { success: 0, error: 0, skipped: 0 },
    patrimonio: { success: 0, error: 0, skipped: 0 },
  };

  const docTypes = [
    { key: "propuesta", urlKey: "propuestaPoliticaUrl" },
    { key: "intereses", urlKey: "declaracionInteresesUrl" },
    { key: "patrimonio", urlKey: "declaracionPatrimonioUrl" },
  ];

  for (let i = 0; i < deputies.length; i++) {
    const dep = deputies[i];
    const slug = dep.slug || dep.name.toLowerCase().replace(/\s+/g, "-");
    console.log(
      `\n[${i + 1}/${deputies.length}] ${dep.name} (${slug})`
    );

    if (!results[slug]) {
      results[slug] = {
        name: dep.name,
        slug,
        extractedAt: new Date().toISOString(),
      };
    }

    for (const { key, urlKey } of docTypes) {
      const url = dep.documents?.[urlKey];

      // Skip if already extracted successfully
      if (results[slug][key]?.status === "success") {
        console.log(`  ✓ ${key}: already extracted (skipping)`);
        stats[key].skipped++;
        continue;
      }

      if (!isValidDocUrl(url)) {
        console.log(`  ○ ${key}: no valid document URL`);
        results[slug][key] = { status: "no_document" };
        stats[key].skipped++;
        continue;
      }

      try {
        // Download PDF
        process.stdout.write(`  ◉ ${key}: downloading...`);
        const pdfBuffer = await downloadPdf(url);
        process.stdout.write(` (${(pdfBuffer.length / 1024).toFixed(0)}KB)`);

        // Extract text (may be empty for scanned PDFs)
        process.stdout.write(" → extracting text...");
        const pdfText = await extractTextFromPdf(pdfBuffer);

        const isScanned = !pdfText || pdfText.length < 50;
        if (isScanned) {
          process.stdout.write(` (scanned — using PDF vision)`);
        } else {
          process.stdout.write(` (${pdfText.length} chars)`);
        }

        // AI extraction — uses text or vision depending on PDF type
        // (large scanned PDFs are automatically split into chunks)
        process.stdout.write(" → Claude extraction...");
        const extracted = await extractWithClaude(pdfText, pdfBuffer, key, dep.name);
        console.log(" ✅");

        results[slug][key] = {
          status: "success",
          data: extracted,
          extractedAt: new Date().toISOString(),
          pdfUrl: url,
          textLength: pdfText.length,
          mode: isScanned ? "vision" : "text",
        };
        stats[key].success++;

        // Rate limit: delay between Claude calls (longer for vision)
        await sleep(isScanned ? 1500 : 500);
      } catch (err) {
        console.log(` ❌ ${err.message}`);
        results[slug][key] = {
          status: "error",
          error: err.message,
          pdfUrl: url,
        };
        stats[key].error++;
      }
    }

    // Save intermediate results after each deputy
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  console.log("\n\n═══════════════════════════════════════");
  console.log("📊 Extraction Summary");
  console.log("═══════════════════════════════════════");
  for (const [type, s] of Object.entries(stats)) {
    console.log(
      `  ${type}: ✅ ${s.success} success | ❌ ${s.error} errors | ⏭ ${s.skipped} skipped`
    );
  }
  console.log(`\n💾 Results saved to: ${OUTPUT_FILE}`);
  console.log(`   Total deputies: ${Object.keys(results).length}`);
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});
