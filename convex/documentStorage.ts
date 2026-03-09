"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ─── Internal Action: Download one PDF and store in Convex ──────────────────

export const downloadAndStoreDocument = internalAction({
  args: {
    transparencyId: v.id("deputyTransparency"),
    docType: v.string(), // "cv" | "propuesta" | "intereses" | "patrimonio"
    sourceUrl: v.string(),
  },
  handler: async (ctx, { transparencyId, docType, sourceUrl }) => {
    try {
      console.log(`[DocStore] Downloading ${docType} from ${sourceUrl}`);

      const res = await fetch(sourceUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "application/pdf,*/*",
        },
        signal: AbortSignal.timeout(120_000), // 2 minute timeout
        redirect: "follow",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const blob = await res.blob();
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      console.log(`[DocStore] Downloaded ${sizeMB}MB, storing in Convex...`);

      // Store in Convex file storage
      const storageId = await ctx.storage.store(blob);

      // Get serving URL
      const localUrl = await ctx.storage.getUrl(storageId);
      if (!localUrl) {
        throw new Error("Failed to get serving URL for stored document");
      }

      console.log(`[DocStore] Stored ${docType} → ${localUrl}`);

      // Save to database
      await ctx.runMutation(internal.documentStorageHelpers.saveDocumentStorageId, {
        transparencyId,
        docType,
        storageId,
        localUrl,
      });

      return { success: true, localUrl, sizeMB };
    } catch (err: any) {
      console.error(`[DocStore] Failed ${docType}: ${err.message}`);
      return { success: false, error: err.message };
    }
  },
});

// ─── Public Action: Migrate all documents for one deputy ────────────────────

export const migrateDeputyDocuments = action({
  args: {
    transparencyId: v.id("deputyTransparency"),
  },
  handler: async (
    ctx,
    { transparencyId }
  ): Promise<{ scheduled: number; message?: string }> => {
    // Get all pending documents for this deputy
    const allPending: {
      transparencyId: string;
      politicianId: string;
      docType: string;
      sourceUrl: string;
    }[] = await ctx.runQuery(
      internal.documentStorageHelpers.getDocumentsToMigrate
    );

    const deputyDocs = allPending.filter(
      (d) => d.transparencyId === transparencyId
    );

    if (deputyDocs.length === 0) {
      return { scheduled: 0, message: "No documents to migrate" };
    }

    // Schedule each document download staggered 2s apart
    for (let i = 0; i < deputyDocs.length; i++) {
      const doc = deputyDocs[i];
      await ctx.scheduler.runAfter(
        i * 2000,
        internal.documentStorage.downloadAndStoreDocument,
        {
          transparencyId: doc.transparencyId as Id<"deputyTransparency">,
          docType: doc.docType,
          sourceUrl: doc.sourceUrl,
        }
      );
    }

    return { scheduled: deputyDocs.length };
  },
});

// ─── Public Action: Migrate ALL deputies' documents ─────────────────────────

export const migrateAllDocuments = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    scheduled: number;
    deputies?: number;
    message?: string;
  }> => {
    const allPending: {
      transparencyId: string;
      politicianId: string;
      docType: string;
      sourceUrl: string;
    }[] = await ctx.runQuery(
      internal.documentStorageHelpers.getDocumentsToMigrate
    );

    if (allPending.length === 0) {
      return { scheduled: 0, message: "All documents already migrated" };
    }

    // Group by transparency record to stagger per-deputy
    const byDeputy = new Map<
      string,
      { transparencyId: string; docType: string; sourceUrl: string }[]
    >();
    for (const doc of allPending) {
      const existing = byDeputy.get(doc.transparencyId) ?? [];
      existing.push(doc);
      byDeputy.set(doc.transparencyId, existing);
    }

    let totalScheduled = 0;
    let deputyIndex = 0;

    for (const [, docs] of byDeputy) {
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        // Stagger: 5s between deputies, 2s between docs within a deputy
        const delay = deputyIndex * 5000 + i * 2000;

        await ctx.scheduler.runAfter(
          delay,
          internal.documentStorage.downloadAndStoreDocument,
          {
            transparencyId: doc.transparencyId as Id<"deputyTransparency">,
            docType: doc.docType,
            sourceUrl: doc.sourceUrl,
          }
        );
        totalScheduled++;
      }
      deputyIndex++;
    }

    return {
      scheduled: totalScheduled,
      deputies: byDeputy.size,
    };
  },
});
