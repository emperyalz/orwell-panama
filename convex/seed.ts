import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seed the database from politicians.json data.
 * To re-seed: temporarily change to `mutation`, run seed script, change back.
 */
export const seedPoliticians = internalMutation({
  args: {
    politicians: v.array(
      v.object({
        id: v.string(),
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
        officialGovUrl: v.optional(v.string()),
        wikipediaUrl: v.optional(v.string()),
        personalWebsite: v.optional(v.string()),
        accounts: v.array(
          v.object({
            platform: v.union(
              v.literal("instagram"),
              v.literal("x_twitter"),
              v.literal("tiktok"),
              v.literal("facebook"),
              v.literal("youtube"),
              v.literal("discord"),
              v.literal("twitch")
            ),
            handle: v.string(),
            profileUrl: v.string(),
            avatar: v.string(),
            verdict: v.union(v.literal("CONFIRMED"), v.literal("PROBABLE")),
            score: v.number(),
            pollingTier: v.union(
              v.literal("hot"),
              v.literal("warm"),
              v.literal("cool"),
              v.literal("dormant")
            ),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let politicianCount = 0;
    let accountCount = 0;

    for (const p of args.politicians) {
      // Check if this politician already exists (idempotent)
      const existing = await ctx.db
        .query("politicians")
        .withIndex("by_externalId", (q) => q.eq("externalId", p.id))
        .first();

      if (existing) {
        console.log(`Skipping existing politician: ${p.name} (${p.id})`);
        continue;
      }

      // Insert politician
      const politicianId = await ctx.db.insert("politicians", {
        externalId: p.id,
        name: p.name,
        slug: p.slug,
        party: p.party,
        partyFull: p.partyFull,
        role: p.role,
        roleCategory: p.roleCategory,
        province: p.province,
        district: p.district,
        circuit: p.circuit,
        hasHeadshot: p.hasHeadshot,
        headshot: p.headshot,
        officialGovUrl: p.officialGovUrl,
        createdAt: now,
        updatedAt: now,
      });
      politicianCount++;

      // Insert each account
      for (const a of p.accounts) {
        await ctx.db.insert("accounts", {
          politicianId,
          platform: a.platform,
          handle: a.handle,
          profileUrl: a.profileUrl,
          avatar: a.avatar,
          verdict: a.verdict,
          score: a.score,
          pollingTier: a.pollingTier,
          createdAt: now,
          updatedAt: now,
        });
        accountCount++;
      }
    }

    console.log(
      `Seeded ${politicianCount} politicians and ${accountCount} accounts`
    );
    return { politicianCount, accountCount };
  },
});

/** Clear all politicians and accounts (use carefully). */
export const clearAll = internalMutation({
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    for (const a of accounts) {
      await ctx.db.delete(a._id);
    }

    const politicians = await ctx.db.query("politicians").collect();
    for (const p of politicians) {
      await ctx.db.delete(p._id);
    }

    console.log(
      `Cleared ${politicians.length} politicians and ${accounts.length} accounts`
    );
    return {
      deletedPoliticians: politicians.length,
      deletedAccounts: accounts.length,
    };
  },
});
