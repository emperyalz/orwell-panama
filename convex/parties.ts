import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ────────────────────────────────────────────────────────────────

/** List all parties, sorted by code. */
export const list = query({
  handler: async (ctx) => {
    const parties = await ctx.db.query("parties").collect();
    parties.sort((a, b) => a.code.localeCompare(b.code));
    return parties;
  },
});

/** Get a single party by code. */
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("parties")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

/** Get a single party by Convex _id. */
export const getById = query({
  args: { id: v.id("parties") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Create a new party. */
export const create = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    fullName: v.string(),
    logo: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    officialWebsite: v.optional(v.string()),
    socialAccounts: v.optional(
      v.array(
        v.object({
          platform: v.string(),
          url: v.string(),
        })
      )
    ),
    wikipediaUrls: v.optional(
      v.array(
        v.object({
          language: v.string(),
          url: v.string(),
        })
      )
    ),
    wikidataUrl: v.optional(v.string()),
    color: v.string(),
    secondaryColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("parties", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an existing party. */
export const update = mutation({
  args: {
    id: v.id("parties"),
    name: v.optional(v.string()),
    fullName: v.optional(v.string()),
    logo: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    officialWebsite: v.optional(v.string()),
    socialAccounts: v.optional(
      v.array(
        v.object({
          platform: v.string(),
          url: v.string(),
        })
      )
    ),
    wikipediaUrls: v.optional(
      v.array(
        v.object({
          language: v.string(),
          url: v.string(),
        })
      )
    ),
    wikidataUrl: v.optional(v.string()),
    color: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
    return id;
  },
});

/** Delete a party — guard: check no politicians reference it. */
export const remove = mutation({
  args: { id: v.id("parties") },
  handler: async (ctx, args) => {
    const party = await ctx.db.get(args.id);
    if (!party) throw new Error("Party not found");

    // Check if any politicians reference this party
    const politicians = await ctx.db
      .query("politicians")
      .withIndex("by_party", (q) => q.eq("party", party.code))
      .collect();

    if (politicians.length > 0) {
      throw new Error(
        `Cannot delete party "${party.code}" — ${politicians.length} politician(s) still reference it.`
      );
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
