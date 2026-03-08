import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Upsert a deputy transparency record from Espacio Cívico */
export const upsertTransparency = mutation({
  args: {
    politicianId: v.id("politicians"),
    espacioCivicoSlug: v.string(),
    espacioCivicoUrl: v.string(),
    suplente: v.optional(v.string()),
    planillaTotal: v.optional(v.string()),
    biography: v.optional(v.string()),
    commissions: v.optional(v.array(v.string())),
    performanceScores: v.optional(
      v.object({
        calificacionPonderada: v.optional(v.number()),
        asistenciaPleno: v.optional(v.number()),
        asistenciaComisiones: v.optional(v.number()),
        viajesViaticos: v.optional(v.number()),
        declaracionIntereses: v.optional(v.number()),
        declaracionPatrimonio: v.optional(v.number()),
      })
    ),
    documents: v.optional(
      v.object({
        cvUrl: v.optional(v.string()),
        propuestaPoliticaUrl: v.optional(v.string()),
        declaracionInteresesUrl: v.optional(v.string()),
        declaracionPatrimonioUrl: v.optional(v.string()),
      })
    ),
    voluntaryDeclarations: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("deputyTransparency")
      .withIndex("by_politicianId", (q) =>
        q.eq("politicianId", args.politicianId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return { action: "updated", id: existing._id };
    } else {
      const id = await ctx.db.insert("deputyTransparency", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
      return { action: "inserted", id };
    }
  },
});

/** Get transparency data for a specific politician */
export const getByPoliticianId = query({
  args: { politicianId: v.id("politicians") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deputyTransparency")
      .withIndex("by_politicianId", (q) =>
        q.eq("politicianId", args.politicianId)
      )
      .first();
  },
});

/** Get all transparency records (for admin/listing) */
export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("deputyTransparency").collect();
  },
});
