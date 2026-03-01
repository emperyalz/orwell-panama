import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const CATEGORY_VALIDATOR = v.union(
  v.literal("Digital News"),
  v.literal("Newspaper"),
  v.literal("TV Network"),
  v.literal("Political Blog"),
  v.literal("Reporter"),
  v.literal("Podcaster"),
  v.literal("Radio")
);

// ─── Queries ────────────────────────────────────────────────────────────────

/** List all media sources, optionally filtered by category or active status. */
export const list = query({
  args: {
    category: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let sources;
    if (args.category) {
      sources = await ctx.db
        .query("mediaSources")
        .withIndex("by_category", (q) => q.eq("category", args.category as any))
        .collect();
    } else if (args.activeOnly) {
      sources = await ctx.db
        .query("mediaSources")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    } else {
      sources = await ctx.db.query("mediaSources").collect();
    }
    sources.sort((a, b) => a.name.localeCompare(b.name));
    return sources;
  },
});

/** Get a single media source by slug. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mediaSources")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/** Get a single media source by _id. */
export const getById = query({
  args: { id: v.id("mediaSources") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Get stats for media dashboard. */
export const getStats = query({
  handler: async (ctx) => {
    const sources = await ctx.db.query("mediaSources").collect();
    const categoryCounts: Record<string, number> = {};
    let activeCount = 0;
    for (const s of sources) {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
      if (s.isActive) activeCount++;
    }
    return {
      total: sources.length,
      active: activeCount,
      categoryCounts,
    };
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Create a new media source. */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    category: CATEGORY_VALIDATOR,
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    socialAccounts: v.optional(
      v.array(
        v.object({
          platform: v.string(),
          handle: v.string(),
          url: v.string(),
        })
      )
    ),
    podcastUrls: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
        })
      )
    ),
    contactEmail: v.optional(v.string()),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("mediaSources", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an existing media source. */
export const update = mutation({
  args: {
    id: v.id("mediaSources"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    category: v.optional(CATEGORY_VALIDATOR),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    socialAccounts: v.optional(
      v.array(
        v.object({
          platform: v.string(),
          handle: v.string(),
          url: v.string(),
        })
      )
    ),
    podcastUrls: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
        })
      )
    ),
    contactEmail: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
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

/** Delete a media source. */
export const remove = mutation({
  args: { id: v.id("mediaSources") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});
