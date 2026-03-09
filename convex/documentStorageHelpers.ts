import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Document type mapping ──────────────────────────────────────────────────

const DOC_TYPE_FIELDS = {
  cv: { urlField: "cvUrl", storageIdField: "cvStorageId", localUrlField: "cvLocalUrl" },
  propuesta: { urlField: "propuestaPoliticaUrl", storageIdField: "propuestaPoliticaStorageId", localUrlField: "propuestaPoliticaLocalUrl" },
  intereses: { urlField: "declaracionInteresesUrl", storageIdField: "declaracionInteresesStorageId", localUrlField: "declaracionInteresesLocalUrl" },
  patrimonio: { urlField: "declaracionPatrimonioUrl", storageIdField: "declaracionPatrimonioStorageId", localUrlField: "declaracionPatrimonioLocalUrl" },
} as const;

type DocType = keyof typeof DOC_TYPE_FIELDS;

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Save a document's storage ID and local serving URL after migration. */
export const saveDocumentStorageId = internalMutation({
  args: {
    transparencyId: v.id("deputyTransparency"),
    docType: v.string(), // "cv" | "propuesta" | "intereses" | "patrimonio"
    storageId: v.id("_storage"),
    localUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.transparencyId);
    if (!record) throw new Error("Transparency record not found");

    const mapping = DOC_TYPE_FIELDS[args.docType as DocType];
    if (!mapping) throw new Error(`Unknown document type: ${args.docType}`);

    const updatedDocs = { ...(record.documents ?? {}) };
    (updatedDocs as any)[mapping.storageIdField] = args.storageId;
    (updatedDocs as any)[mapping.localUrlField] = args.localUrl;

    await ctx.db.patch(args.transparencyId, {
      documents: updatedDocs,
      updatedAt: Date.now(),
    });
  },
});

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get all transparency records that have external URLs but may need migration. */
export const getDocumentsToMigrate = internalQuery({
  handler: async (ctx) => {
    const records = await ctx.db.query("deputyTransparency").collect();
    const results: {
      transparencyId: string;
      politicianId: string;
      docType: string;
      sourceUrl: string;
    }[] = [];

    for (const record of records) {
      const docs = record.documents;
      if (!docs) continue;

      for (const [docType, mapping] of Object.entries(DOC_TYPE_FIELDS)) {
        const externalUrl = (docs as any)[mapping.urlField];
        const storageId = (docs as any)[mapping.storageIdField];

        // Has external URL, no local storage yet — skip placeholders and malformed URLs
        const isValidUrl =
          externalUrl &&
          externalUrl.includes("drive-image/") &&
          !externalUrl.endsWith("1") &&
          !externalUrl.endsWith("/1");

        if (isValidUrl && !storageId) {
          results.push({
            transparencyId: record._id,
            politicianId: record.politicianId,
            docType,
            sourceUrl: externalUrl,
          });
        }
      }
    }

    return results;
  },
});

/** Public query: Migration status overview for admin UI. */
export const getMigrationStatus = query({
  handler: async (ctx) => {
    const records = await ctx.db.query("deputyTransparency").collect();

    // Fetch politician names for display
    const politicianIds = [...new Set(records.map((r) => r.politicianId))];
    const politicians = await Promise.all(
      politicianIds.map((id) => ctx.db.get(id))
    );
    const nameMap = new Map(
      politicians
        .filter(Boolean)
        .map((p) => [p!._id, p!.name])
    );

    const deputies = records
      .map((record) => {
        const docs = record.documents;
        const status: Record<string, { hasExternal: boolean; hasMigrated: boolean; externalUrl?: string }> = {};

        for (const [docType, mapping] of Object.entries(DOC_TYPE_FIELDS)) {
          const externalUrl = (docs as any)?.[mapping.urlField];
          const storageId = (docs as any)?.[mapping.storageIdField];
          const isValid =
            !!externalUrl &&
            externalUrl.includes("drive-image/") &&
            !externalUrl.endsWith("1") &&
            !externalUrl.endsWith("/1");

          status[docType] = {
            hasExternal: isValid,
            hasMigrated: !!storageId,
            externalUrl: isValid ? externalUrl : undefined,
          };
        }

        return {
          transparencyId: record._id,
          politicianId: record.politicianId,
          name: nameMap.get(record.politicianId) ?? "Unknown",
          status,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Totals
    let totalDocs = 0;
    let migratedDocs = 0;
    for (const d of deputies) {
      for (const s of Object.values(d.status)) {
        if (s.hasExternal) totalDocs++;
        if (s.hasMigrated) migratedDocs++;
      }
    }

    return {
      totalDocs,
      migratedDocs,
      pendingDocs: totalDocs - migratedDocs,
      deputies,
    };
  },
});
