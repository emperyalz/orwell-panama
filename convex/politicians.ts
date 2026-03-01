import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ────────────────────────────────────────────────────────────────

/** List all politicians with their accounts joined. Supports optional filters. */
export const list = query({
  args: {
    roleCategory: v.optional(v.string()),
    province: v.optional(v.string()),
    party: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fetch politicians — use index filter when a single filter is provided
    let politicians;
    if (args.roleCategory) {
      politicians = await ctx.db
        .query("politicians")
        .withIndex("by_roleCategory", (q) =>
          q.eq(
            "roleCategory",
            args.roleCategory as
              | "Deputy"
              | "Mayor"
              | "Governor"
              | "President"
          )
        )
        .collect();
    } else if (args.province) {
      politicians = await ctx.db
        .query("politicians")
        .withIndex("by_province", (q) => q.eq("province", args.province!))
        .collect();
    } else if (args.party) {
      politicians = await ctx.db
        .query("politicians")
        .withIndex("by_party", (q) => q.eq("party", args.party!))
        .collect();
    } else {
      politicians = await ctx.db.query("politicians").collect();
    }

    // Client-side text search filter
    let filtered = politicians;
    if (args.search) {
      const term = args.search.toLowerCase();
      filtered = politicians.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.party.toLowerCase().includes(term) ||
          p.partyFull.toLowerCase().includes(term) ||
          p.province.toLowerCase().includes(term)
      );
    }

    // Join accounts for each politician
    const results = await Promise.all(
      filtered.map(async (p) => {
        const accounts = await ctx.db
          .query("accounts")
          .withIndex("by_politician", (q) => q.eq("politicianId", p._id))
          .collect();
        return { ...p, accounts };
      })
    );

    // Sort by name
    results.sort((a, b) => a.name.localeCompare(b.name));

    return results;
  },
});

/** Get a single politician by externalId (e.g. "DEP-015"). */
export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const politician = await ctx.db
      .query("politicians")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();

    if (!politician) return null;

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_politician", (q) => q.eq("politicianId", politician._id))
      .collect();

    return { ...politician, accounts };
  },
});

/** Get a single politician by slug. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const politician = await ctx.db
      .query("politicians")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!politician) return null;

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_politician", (q) => q.eq("politicianId", politician._id))
      .collect();

    return { ...politician, accounts };
  },
});

/** Get a single politician by Convex _id. */
export const getById = query({
  args: { id: v.id("politicians") },
  handler: async (ctx, args) => {
    const politician = await ctx.db.get(args.id);
    if (!politician) return null;

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_politician", (q) => q.eq("politicianId", politician._id))
      .collect();

    return { ...politician, accounts };
  },
});

/** Dashboard stats: totals, breakdowns, missing data counts. */
export const getStats = query({
  handler: async (ctx) => {
    const politicians = await ctx.db.query("politicians").collect();
    const accounts = await ctx.db.query("accounts").collect();

    const missingHeadshots = politicians.filter((p) => !p.hasHeadshot).length;
    const politiciansWithNoAccounts = new Set(politicians.map((p) => p._id));
    for (const a of accounts) {
      politiciansWithNoAccounts.delete(a.politicianId);
    }

    // Platform breakdown
    const platformCounts: Record<string, number> = {};
    for (const a of accounts) {
      platformCounts[a.platform] = (platformCounts[a.platform] || 0) + 1;
    }

    // Role breakdown
    const roleCounts: Record<string, number> = {};
    for (const p of politicians) {
      roleCounts[p.roleCategory] = (roleCounts[p.roleCategory] || 0) + 1;
    }

    // Party breakdown
    const partyCounts: Record<string, number> = {};
    for (const p of politicians) {
      partyCounts[p.party] = (partyCounts[p.party] || 0) + 1;
    }

    // Wikipedia / Personal Website counts
    const wikipediaCount = politicians.filter((p) => p.wikipediaUrl).length;
    const personalWebsiteCount = politicians.filter((p) => p.personalWebsite).length;

    // Party details (fullName + logo + color) from parties table
    const parties = await ctx.db.query("parties").collect();
    const partyDetails: Record<string, { fullName: string; logo: string; color: string }> = {};
    for (const party of parties) {
      partyDetails[party.code] = {
        fullName: party.fullName,
        logo: party.logo,
        color: party.color,
      };
    }

    return {
      totalPoliticians: politicians.length,
      totalAccounts: accounts.length,
      missingHeadshots,
      missingAccounts: politiciansWithNoAccounts.size,
      platformCounts,
      roleCounts,
      partyCounts,
      wikipediaCount,
      personalWebsiteCount,
      partyDetails,
    };
  },
});

/** List politicians missing headshots (for dashboard expansion). */
export const listMissingHeadshots = query({
  handler: async (ctx) => {
    const politicians = await ctx.db.query("politicians").collect();
    const missing = politicians.filter((p) => !p.hasHeadshot);
    missing.sort((a, b) => a.name.localeCompare(b.name));
    return missing;
  },
});

/** Get unique parties for filter dropdowns. */
export const getUniqueParties = query({
  handler: async (ctx) => {
    const politicians = await ctx.db.query("politicians").collect();
    const parties = [
      ...new Set(politicians.map((p) => ({ code: p.party, full: p.partyFull }))),
    ];
    // Deduplicate by code
    const seen = new Set<string>();
    return parties.filter((p) => {
      if (seen.has(p.code)) return false;
      seen.add(p.code);
      return true;
    });
  },
});

/** Get unique provinces for filter dropdowns. */
export const getUniqueProvinces = query({
  handler: async (ctx) => {
    const politicians = await ctx.db.query("politicians").collect();
    return [...new Set(politicians.map((p) => p.province))].sort();
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Create a new politician. */
export const create = mutation({
  args: {
    externalId: v.string(),
    name: v.string(),
    slug: v.string(),
    party: v.string(),
    partyFull: v.string(),
    role: v.string(),
    roleCategory: v.union(
      v.literal("Deputy"),
      v.literal("Mayor"),
      v.literal("Governor"),
      v.literal("President")
    ),
    province: v.string(),
    district: v.optional(v.string()),
    circuit: v.optional(v.string()),
    hasHeadshot: v.boolean(),
    headshot: v.string(),
    headshotStorageId: v.optional(v.id("_storage")),
    officialGovUrl: v.optional(v.string()),
    wikipediaUrl: v.optional(v.string()),
    personalWebsite: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("politicians", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an existing politician. */
export const update = mutation({
  args: {
    id: v.id("politicians"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    party: v.optional(v.string()),
    partyFull: v.optional(v.string()),
    role: v.optional(v.string()),
    roleCategory: v.optional(
      v.union(
        v.literal("Deputy"),
        v.literal("Mayor"),
        v.literal("Governor"),
        v.literal("President")
      )
    ),
    province: v.optional(v.string()),
    district: v.optional(v.string()),
    circuit: v.optional(v.string()),
    hasHeadshot: v.optional(v.boolean()),
    headshot: v.optional(v.string()),
    headshotStorageId: v.optional(v.id("_storage")),
    officialGovUrl: v.optional(v.string()),
    wikipediaUrl: v.optional(v.string()),
    personalWebsite: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Filter out undefined values
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
    return id;
  },
});

/** Delete a politician and all their accounts. */
export const remove = mutation({
  args: { id: v.id("politicians") },
  handler: async (ctx, args) => {
    // Delete all linked accounts first
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_politician", (q) => q.eq("politicianId", args.id))
      .collect();

    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
