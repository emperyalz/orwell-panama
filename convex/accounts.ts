import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ────────────────────────────────────────────────────────────────

/** List all accounts for a specific politician. */
export const listByPolitician = query({
  args: { politicianId: v.id("politicians") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_politician", (q) =>
        q.eq("politicianId", args.politicianId)
      )
      .collect();
  },
});

/** List all accounts (for dashboard expansion). */
export const listAll = query({
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    // Join politician name for display
    const results = await Promise.all(
      accounts.map(async (a) => {
        const politician = await ctx.db.get(a.politicianId);
        return { ...a, politicianName: politician?.name ?? "Unknown" };
      })
    );
    results.sort((a, b) => a.politicianName.localeCompare(b.politicianName));
    return results;
  },
});

/** List accounts for a specific platform (for dashboard expansion). */
export const listByPlatform = query({
  args: {
    platform: v.union(
      v.literal("instagram"),
      v.literal("x_twitter"),
      v.literal("tiktok"),
      v.literal("facebook"),
      v.literal("youtube"),
      v.literal("discord"),
      v.literal("twitch"),
      v.literal("linkedin")
    ),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_platform", (q) => q.eq("platform", args.platform))
      .collect();
    const results = await Promise.all(
      accounts.map(async (a) => {
        const politician = await ctx.db.get(a.politicianId);
        return { ...a, politicianName: politician?.name ?? "Unknown" };
      })
    );
    results.sort((a, b) => a.politicianName.localeCompare(b.politicianName));
    return results;
  },
});

/** Get a single account by Convex _id. */
export const getById = query({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Check if a platform+handle combo already exists (for duplicate detection). */
export const getByPlatformHandle = query({
  args: {
    platform: v.union(
      v.literal("instagram"),
      v.literal("x_twitter"),
      v.literal("tiktok"),
      v.literal("facebook"),
      v.literal("youtube"),
      v.literal("discord"),
      v.literal("twitch"),
      v.literal("linkedin")
    ),
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_platform_handle", (q) =>
        q.eq("platform", args.platform).eq("handle", args.handle)
      )
      .first();
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Create a new social account linked to a politician. */
export const create = mutation({
  args: {
    politicianId: v.id("politicians"),
    platform: v.union(
      v.literal("instagram"),
      v.literal("x_twitter"),
      v.literal("tiktok"),
      v.literal("facebook"),
      v.literal("youtube"),
      v.literal("discord"),
      v.literal("twitch"),
      v.literal("linkedin")
    ),
    handle: v.string(),
    profileUrl: v.string(),
    avatar: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    verdict: v.union(v.literal("CONFIRMED"), v.literal("PROBABLE")),
    score: v.number(),
    pollingTier: v.union(
      v.literal("hot"),
      v.literal("warm"),
      v.literal("cool"),
      v.literal("dormant")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("accounts", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an existing account. */
export const update = mutation({
  args: {
    id: v.id("accounts"),
    platform: v.optional(
      v.union(
        v.literal("instagram"),
        v.literal("x_twitter"),
        v.literal("tiktok"),
        v.literal("facebook"),
        v.literal("youtube"),
        v.literal("discord"),
        v.literal("twitch"),
        v.literal("linkedin")
      )
    ),
    handle: v.optional(v.string()),
    profileUrl: v.optional(v.string()),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    verdict: v.optional(
      v.union(v.literal("CONFIRMED"), v.literal("PROBABLE"))
    ),
    score: v.optional(v.number()),
    pollingTier: v.optional(
      v.union(
        v.literal("hot"),
        v.literal("warm"),
        v.literal("cool"),
        v.literal("dormant")
      )
    ),
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

/** Delete a single account. */
export const remove = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});
