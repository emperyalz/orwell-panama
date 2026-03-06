import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** Upsert a deputy voting profile */
export const upsertDeputyProfile = mutation({
  args: {
    deputyId: v.number(),
    fullName: v.string(),
    partyCode: v.string(),
    partyName: v.string(),
    partyColor: v.string(),
    circuit: v.string(),
    seat: v.number(),
    isSuplente: v.boolean(),
    principalId: v.optional(v.number()),
    principalName: v.optional(v.string()),
    gender: v.optional(v.string()),
    politicianId: v.optional(v.id("politicians")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("deputyVotingProfiles")
      .withIndex("by_deputyId", (q) => q.eq("deputyId", args.deputyId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("deputyVotingProfiles", {
        ...args,
        totalVotes: 0,
        totalAFavor: 0,
        totalEnContra: 0,
        totalAbstencion: 0,
        sessionsAttended: 0,
        participationRate: 0,
      });
    }
  },
});

/** Upsert a voting session */
export const upsertVotingSession = mutation({
  args: {
    votingId: v.number(),
    reportId: v.number(),
    sessionId: v.number(),
    sessionDate: v.string(),
    sessionType: v.string(),
    votingTitle: v.string(),
    votingDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("votingSessions")
      .withIndex("by_votingId", (q) => q.eq("votingId", args.votingId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("votingSessions", args);
    }
  },
});

/** Insert a batch of voting records */
export const insertVotesBatch = mutation({
  args: {
    records: v.array(
      v.object({
        votingId: v.number(),
        questionId: v.number(),
        questionText: v.string(),
        questionPassed: v.boolean(),
        votesNeeded: v.number(),
        totalAFavor: v.number(),
        totalEnContra: v.number(),
        totalAbstencion: v.number(),
        deputyId: v.number(),
        deputyName: v.string(),
        partyCode: v.string(),
        circuit: v.string(),
        vote: v.string(),
        isSuplente: v.boolean(),
        suplenteOf: v.optional(v.string()),
        sessionDate: v.string(),
        votingTitle: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const rec of args.records) {
      await ctx.db.insert("votingRecords", rec);
    }
  },
});

/** Compute aggregate stats for all deputy profiles from their voting records */
export const computeProfileStats = mutation({
  handler: async (ctx) => {
    const profiles = await ctx.db.query("deputyVotingProfiles").collect();
    const totalSessionDates = new Set<string>();
    const allRecords = await ctx.db.query("votingRecords").collect();

    // Count unique session dates
    for (const rec of allRecords) {
      totalSessionDates.add(rec.sessionDate);
    }
    const totalSessions = totalSessionDates.size;

    // Group by deputy
    const byDeputy = new Map<number, any[]>();
    for (const rec of allRecords) {
      const existing = byDeputy.get(rec.deputyId) ?? [];
      existing.push(rec);
      byDeputy.set(rec.deputyId, existing);
    }

    for (const profile of profiles) {
      const records = byDeputy.get(profile.deputyId) ?? [];
      const sessionDates = new Set(records.map((r: any) => r.sessionDate));

      const totalVotes = records.length;
      const totalAFavor = records.filter(
        (r: any) => r.vote === "a_favor"
      ).length;
      const totalEnContra = records.filter(
        (r: any) => r.vote === "en_contra"
      ).length;
      const totalAbstencion = records.filter(
        (r: any) => r.vote === "abstencion"
      ).length;
      const sessionsAttended = sessionDates.size;
      const participationRate =
        totalSessions > 0 ? sessionsAttended / totalSessions : 0;

      await ctx.db.patch(profile._id, {
        totalVotes,
        totalAFavor,
        totalEnContra,
        totalAbstencion,
        sessionsAttended,
        participationRate,
      });
    }
  },
});
