/**
 * Document Extraction Helpers (Queries & Mutations)
 * ──────────────────────────────────────────────────
 * Non-Node.js functions for the extraction pipeline.
 * These run in the Convex runtime (not Node.js).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// ─── URL Validation ─────────────────────────────────────────────────────────

function isValidDocUrl(url?: string): boolean {
  if (!url) return false;
  if (url.endsWith("/1") || url.endsWith("1")) return false;
  if (!url.includes("drive-image/")) return false;
  return true;
}

// ─── Internal Queries ───────────────────────────────────────────────────────

export const getTransparencyForExtraction = internalQuery({
  args: { politicianId: v.id("politicians") },
  handler: async (ctx, args) => {
    const transparency = await ctx.db
      .query("deputyTransparency")
      .withIndex("by_politicianId", (q) =>
        q.eq("politicianId", args.politicianId)
      )
      .first();
    if (!transparency) return null;
    const politician = await ctx.db.get(args.politicianId);
    return {
      transparencyId: transparency._id,
      documents: transparency.documents,
      extractionStatus: transparency.extractionStatus,
      extractedPropuesta: transparency.extractedPropuesta,
      extractedIntereses: transparency.extractedIntereses,
      extractedPatrimonio: transparency.extractedPatrimonio,
      politicianName: politician?.name || "Unknown",
    };
  },
});

export const getAllTransparencyRecords = internalQuery({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("deputyTransparency").collect();
    const results = [];
    for (const r of records) {
      const politician = await ctx.db.get(r.politicianId);
      results.push({
        politicianId: r.politicianId,
        politicianName: politician?.name || "Unknown",
        documents: r.documents,
        extractionStatus: r.extractionStatus,
        hasExtractedPropuesta: !!r.extractedPropuesta,
        hasExtractedIntereses: !!r.extractedIntereses,
        hasExtractedPatrimonio: !!r.extractedPatrimonio,
      });
    }
    return results;
  },
});

// ─── Internal Mutation: Save Extraction Result ──────────────────────────────

export const saveExtractionResult = internalMutation({
  args: {
    politicianId: v.id("politicians"),
    docType: v.union(
      v.literal("propuesta"),
      v.literal("intereses"),
      v.literal("patrimonio")
    ),
    status: v.string(),
    data: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("deputyTransparency")
      .withIndex("by_politicianId", (q) =>
        q.eq("politicianId", args.politicianId)
      )
      .first();
    if (!record) return;

    const fieldName =
      args.docType === "propuesta"
        ? "extractedPropuesta"
        : args.docType === "intereses"
          ? "extractedIntereses"
          : "extractedPatrimonio";

    const patch: Record<string, any> = { updatedAt: Date.now() };

    if (args.status === "success" && args.data) {
      patch[fieldName] = args.data;
    }

    // Merge with existing extractionStatus
    const existingStatus = (record.extractionStatus as any) || {};
    patch.extractionStatus = {
      ...existingStatus,
      [args.docType]: {
        status: args.status,
        extractedAt: Date.now(),
        ...(args.error ? { error: args.error } : {}),
      },
    };

    await ctx.db.patch(record._id, patch);
  },
});

// ─── Public Query: Extraction Status for Admin UI ───────────────────────────

export const getExtractionStatus = query({
  handler: async (ctx) => {
    const records = await ctx.db.query("deputyTransparency").collect();
    const results = [];

    for (const r of records) {
      const politician = await ctx.db.get(r.politicianId);
      if (!politician) continue;

      results.push({
        _id: r._id,
        politicianId: r.politicianId,
        politicianName: politician.name,
        partyCode: politician.party || "",
        documents: r.documents,
        extractionStatus: r.extractionStatus,
        hasExtractedPropuesta: !!r.extractedPropuesta,
        hasExtractedIntereses: !!r.extractedIntereses,
        hasExtractedPatrimonio: !!r.extractedPatrimonio,
      });
    }

    // Sort by name
    return results.sort((a, b) =>
      a.politicianName.localeCompare(b.politicianName)
    );
  },
});
