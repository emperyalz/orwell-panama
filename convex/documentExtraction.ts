"use node";

/**
 * PDF Document Extraction Pipeline (Convex Node.js Actions)
 * ──────────────────────────────────────────────────────────
 * Server-side extraction of structured data from deputy PDF documents.
 * Downloads PDFs, extracts text, sends to Claude AI for structured extraction.
 *
 * NOTE: This file uses "use node" — only actions can be exported.
 * Queries and mutations are in documentExtractionHelpers.ts.
 */

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-20250514";
const MAX_RETRIES = 2;
const MAX_TEXT_CHARS = 60000;

// ─── Extraction Prompts (production-proven) ─────────────────────────────────

const PROMPTS: Record<string, string> = {
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

// ─── PDF Helpers ────────────────────────────────────────────────────────────

async function parsePdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const result = await pdfParse(pdfBuffer);
    return result.text?.trim() || "";
  } catch {
    return "";
  }
}

async function splitPdfIntoChunks(pdfBuffer: Buffer): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = srcDoc.getPageCount();
  const avgPageSize = pdfBuffer.length / totalPages;
  const maxRawPerChunk = 18 * 1024 * 1024;
  const pagesPerChunk = Math.max(1, Math.floor(maxRawPerChunk / avgPageSize));

  const chunks: Buffer[] = [];
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    const chunkDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: end - start }, (_, i) => start + i);
    const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) chunkDoc.addPage(page);
    chunks.push(Buffer.from(await chunkDoc.save()));
  }
  return chunks;
}

function mergeChunkResults(chunkResults: any[], docType: string): any {
  if (chunkResults.length === 0) throw new Error("No chunk results to merge");
  if (chunkResults.length === 1) return chunkResults[0];

  if (docType === "patrimonio") {
    const m: any = {
      bienesInmuebles: chunkResults.flatMap((c) => c.bienesInmuebles || []),
      vehiculos: chunkResults.flatMap((c) => c.vehiculos || []),
      cuentasBancarias: chunkResults.flatMap((c) => c.cuentasBancarias || []),
      inversiones: chunkResults.flatMap((c) => c.inversiones || []),
      deudas: chunkResults.flatMap((c) => c.deudas || []),
      patrimonioNeto: chunkResults.reduce((a: any, c: any) => c.patrimonioNeto || a, null),
    };
    m.totalInmuebles = m.bienesInmuebles.length;
    m.totalVehiculos = m.vehiculos.length;
    m.totalCuentas = m.cuentasBancarias.length;
    m.totalDeudas = m.deudas.length;
    return m;
  }
  if (docType === "intereses") {
    const m: any = {
      actividadesComerciales: chunkResults.flatMap((c) => c.actividadesComerciales || []),
      membresias: chunkResults.flatMap((c) => c.membresias || []),
      fuentesIngreso: chunkResults.flatMap((c) => c.fuentesIngreso || []),
      conflictosDeclarados: chunkResults.flatMap((c) => c.conflictosDeclarados || []),
      parientesEnGobierno: chunkResults.flatMap((c) => c.parientesEnGobierno || []),
    };
    m.totalEmpresas = m.actividadesComerciales.length;
    m.totalMembresias = m.membresias.length;
    m.totalFuentesIngreso = m.fuentesIngreso.length;
    return m;
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
  return chunkResults[0];
}

function parseJsonResponse(text: string): any {
  return JSON.parse(text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim());
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Core Extraction Logic ──────────────────────────────────────────────────

async function extractWithClaude(
  anthropic: Anthropic, pdfText: string, pdfBuffer: Buffer, docType: string, deputyName: string
): Promise<any> {
  const prompt = PROMPTS[docType];
  if (!prompt) throw new Error(`Unknown document type: ${docType}`);
  const isScanned = !pdfText || pdfText.length < 50;
  const truncatedText = pdfText && pdfText.length > MAX_TEXT_CHARS
    ? pdfText.slice(0, MAX_TEXT_CHARS) + "\n...[truncated]"
    : pdfText;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let messages: any[];
      if (isScanned) {
        const base64Pdf = pdfBuffer.toString("base64");
        if (base64Pdf.length > 25 * 1024 * 1024) {
          const chunks = await splitPdfIntoChunks(pdfBuffer);
          const chunkResults: any[] = [];
          for (let ci = 0; ci < chunks.length; ci++) {
            const chunkBase64 = chunks[ci].toString("base64");
            if (chunkBase64.length > 25 * 1024 * 1024) continue;
            const resp = await anthropic.messages.create({
              model: MODEL, max_tokens: 4096,
              messages: [{ role: "user", content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: chunkBase64 } },
                { type: "text", text: `${prompt}\n\nPage chunk ${ci + 1}/${chunks.length} for deputy ${deputyName}.` },
              ]}],
            });
            const ct = resp.content[0];
            if (ct.type === "text") { try { chunkResults.push(parseJsonResponse(ct.text)); } catch {} }
            await sleep(1500);
          }
          if (chunkResults.length === 0) throw new Error("All chunks failed");
          return mergeChunkResults(chunkResults, docType);
        }
        messages = [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
          { type: "text", text: `${prompt}\n\nPDF document for deputy ${deputyName}. Extract the structured data.` },
        ]}];
      } else {
        messages = [{ role: "user", content: `${prompt}\n\n--- DOCUMENT TEXT (${deputyName}) ---\n${truncatedText}` }];
      }
      const response = await anthropic.messages.create({ model: MODEL, max_tokens: 4096, messages });
      const rt = response.content[0];
      if (rt.type === "text") return parseJsonResponse(rt.text);
      throw new Error("Unexpected response type");
    } catch (err: any) {
      if (attempt < MAX_RETRIES) { await sleep(2000 * (attempt + 1)); } else { throw err; }
    }
  }
}

function isValidDocUrl(url?: string): boolean {
  if (!url) return false;
  if (url.endsWith("/1") || url.endsWith("1")) return false;
  if (!url.includes("drive-image/")) return false;
  return true;
}

const DOC_URL_MAP: Record<string, string> = {
  propuesta: "propuestaPoliticaUrl",
  intereses: "declaracionInteresesUrl",
  patrimonio: "declaracionPatrimonioUrl",
};

// ─── Actions ────────────────────────────────────────────────────────────────

export const extractOneDocument = internalAction({
  args: {
    politicianId: v.id("politicians"),
    deputyName: v.string(),
    docType: v.union(v.literal("propuesta"), v.literal("intereses"), v.literal("patrimonio")),
    pdfUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.documentExtractionHelpers.saveExtractionResult, {
        politicianId: args.politicianId, docType: args.docType, status: "error", error: "ANTHROPIC_API_KEY not configured",
      });
      return { success: false, error: "ANTHROPIC_API_KEY not configured" };
    }
    const anthropic = new Anthropic({ apiKey });
    try {
      const response = await fetch(args.pdfUrl, {
        headers: { "User-Agent": "ORWELL-Panama/1.0" }, redirect: "follow", signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} downloading PDF`);
      const pdfBuffer = Buffer.from(await response.arrayBuffer());
      const pdfText = await parsePdfText(pdfBuffer);
      const extracted = await extractWithClaude(anthropic, pdfText, pdfBuffer, args.docType, args.deputyName);
      await ctx.runMutation(internal.documentExtractionHelpers.saveExtractionResult, {
        politicianId: args.politicianId, docType: args.docType, status: "success", data: extracted,
      });
      return { success: true, docType: args.docType };
    } catch (err: any) {
      await ctx.runMutation(internal.documentExtractionHelpers.saveExtractionResult, {
        politicianId: args.politicianId, docType: args.docType, status: "error", error: String(err?.message || err),
      });
      return { success: false, error: String(err?.message || err) };
    }
  },
});

export const triggerExtractDeputy = action({
  args: {
    politicianId: v.id("politicians"),
    docTypes: v.optional(v.array(v.union(v.literal("propuesta"), v.literal("intereses"), v.literal("patrimonio")))),
  },
  handler: async (ctx, args) => {
    const record = await ctx.runQuery(internal.documentExtractionHelpers.getTransparencyForExtraction, {
      politicianId: args.politicianId,
    });
    if (!record) return { error: "No transparency record found", scheduled: 0 };
    const docs = record.documents as Record<string, string> | undefined;
    if (!docs) return { error: "No documents on record", scheduled: 0 };

    const docTypes = args.docTypes || ["propuesta", "intereses", "patrimonio"];
    let scheduled = 0;
    for (const docType of docTypes) {
      const url = docs[DOC_URL_MAP[docType]];
      if (!isValidDocUrl(url)) continue;
      await ctx.runMutation(internal.documentExtractionHelpers.saveExtractionResult, {
        politicianId: args.politicianId, docType: docType as "propuesta" | "intereses" | "patrimonio", status: "processing",
      });
      await ctx.scheduler.runAfter(scheduled * 3000, internal.documentExtraction.extractOneDocument, {
        politicianId: args.politicianId, deputyName: record.politicianName,
        docType: docType as "propuesta" | "intereses" | "patrimonio", pdfUrl: url!,
      });
      scheduled++;
    }
    return { scheduled };
  },
});

export const triggerExtractAll = action({
  args: {
    docTypes: v.optional(v.array(v.union(v.literal("propuesta"), v.literal("intereses"), v.literal("patrimonio")))),
    skipExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allRecords = await ctx.runQuery(internal.documentExtractionHelpers.getAllTransparencyRecords, {});
    const docTypes = args.docTypes || ["propuesta", "intereses", "patrimonio"];
    let scheduledDeputies = 0;

    for (const record of allRecords) {
      const typesToExtract: ("propuesta" | "intereses" | "patrimonio")[] = [];
      const docs = record.documents as Record<string, string> | undefined;
      if (!docs) continue;
      for (const docType of docTypes) {
        if (!isValidDocUrl(docs[DOC_URL_MAP[docType]])) continue;
        if (args.skipExisting) {
          const hasKey = docType === "propuesta" ? "hasExtractedPropuesta"
            : docType === "intereses" ? "hasExtractedIntereses" : "hasExtractedPatrimonio";
          if ((record as any)[hasKey]) continue;
        }
        typesToExtract.push(docType as "propuesta" | "intereses" | "patrimonio");
      }
      if (typesToExtract.length === 0) continue;
      await ctx.scheduler.runAfter(scheduledDeputies * 30000, internal.documentExtraction.triggerExtractDeputyInternal, {
        politicianId: record.politicianId, docTypes: typesToExtract,
      });
      scheduledDeputies++;
    }
    return { scheduledDeputies };
  },
});

export const triggerExtractDeputyInternal = internalAction({
  args: {
    politicianId: v.id("politicians"),
    docTypes: v.array(v.union(v.literal("propuesta"), v.literal("intereses"), v.literal("patrimonio"))),
  },
  handler: async (ctx, args) => {
    const record = await ctx.runQuery(internal.documentExtractionHelpers.getTransparencyForExtraction, {
      politicianId: args.politicianId,
    });
    if (!record) return;
    const docs = record.documents as Record<string, string> | undefined;
    if (!docs) return;
    let scheduled = 0;
    for (const docType of args.docTypes) {
      const url = docs[DOC_URL_MAP[docType]];
      if (!isValidDocUrl(url)) continue;
      await ctx.runMutation(internal.documentExtractionHelpers.saveExtractionResult, {
        politicianId: args.politicianId, docType, status: "processing",
      });
      await ctx.scheduler.runAfter(scheduled * 3000, internal.documentExtraction.extractOneDocument, {
        politicianId: args.politicianId, deputyName: record.politicianName, docType, pdfUrl: url!,
      });
      scheduled++;
    }
  },
});
