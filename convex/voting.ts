import { query } from "./_generated/server";
import { v } from "convex/values";

/** Convert epoch ms to "YYYY-MM-DD" date string */
function epochToDateStr(epoch: number): string {
  const d = new Date(epoch);
  return d.toISOString().slice(0, 10);
}

/**
 * Get complete dashboard data for a deputy politician.
 * Fetches profile, analytics, bio, and recent votes in one call.
 */
export const getDeputyDashboard = query({
  args: { politicianId: v.id("politicians") },
  handler: async (ctx, args) => {
    // Get the deputy voting profile linked to this politician
    const profile = await ctx.db
      .query("deputyVotingProfiles")
      .withIndex("by_politicianId", (q) =>
        q.eq("politicianId", args.politicianId)
      )
      .first();

    if (!profile) {
      return {
        profile: null,
        analytics: null,
        bio: null,
        recentVotes: [],
        chamberStats: await getChamberStatsInternal(ctx),
      };
    }

    // Fetch analytics, bio, and recent votes in parallel
    const [analytics, bio, recentVotesDocs] = await Promise.all([
      ctx.db
        .query("deputyAnalytics")
        .withIndex("by_deputyId", (q) => q.eq("deputyId", profile.deputyId))
        .first(),
      ctx.db
        .query("deputyBios")
        .withIndex("by_deputyId", (q) => q.eq("deputyId", profile.deputyId))
        .first(),
      ctx.db
        .query("votingRecords")
        .withIndex("by_deputyId", (q) =>
          q.eq("deputyId", profile.deputyId)
        )
        .order("desc")
        .take(20),
    ]);

    const recentVotes = recentVotesDocs.map((v) => ({
      votingId: v.votingId,
      questionId: v.questionId,
      questionText: v.questionText,
      questionPassed: v.questionPassed,
      vote: v.vote,
      sessionDate: epochToDateStr(v.sessionDate),
      votingTitle: v.votingTitle,
    }));

    return {
      profile: profile
        ? {
            deputyId: profile.deputyId,
            deputyName: profile.deputyName,
            partyCode: profile.partyCode,
            circuit: profile.circuit,
            isSuplente: profile.isSuplente,
            totalVotes: profile.totalVotes,
            totalAFavor: profile.totalAFavor,
            totalEnContra: profile.totalEnContra,
            totalAbstencion: profile.totalAbstencion,
            sessionsAttended: profile.sessionsAttended,
            participationRate: profile.participationRate,
          }
        : null,
      analytics: analytics
        ? {
            loyaltyScore: analytics.loyaltyScore,
            dissentCount: analytics.dissentCount,
            dissentVotes: analytics.dissentVotes,
            swingVoteCount: analytics.swingVoteCount,
            swingVotes: analytics.swingVotes,
            attendancePercentile: analytics.attendancePercentile,
            loyaltyPercentile: analytics.loyaltyPercentile,
            votesPercentile: analytics.votesPercentile,
            controversialVotes: analytics.controversialVotes,
            topAllies: analytics.topAllies,
            topRivals: analytics.topRivals,
            monthlyStats: analytics.monthlyStats,
            attendanceDates: analytics.attendanceDates,
            provinceAttendanceRank: analytics.provinceAttendanceRank,
            provinceTotalDeputies: analytics.provinceTotalDeputies,
          }
        : null,
      bio: bio
        ? {
            aiSummary: bio.aiSummary,
            aiKeyQualifications: bio.aiKeyQualifications,
            aiEducationLevel: bio.aiEducationLevel,
            aiProfessionalSector: bio.aiProfessionalSector,
            correo: bio.correo,
            structuredData: bio.structuredData,
          }
        : null,
      recentVotes,
      chamberStats: await getChamberStatsInternal(ctx),
    };
  },
});

/** Internal helper for chamber-wide stats. */
async function getChamberStatsInternal(ctx: any) {
  const profiles = await ctx.db
    .query("deputyVotingProfiles")
    .collect();

  if (profiles.length === 0) {
    return {
      totalSessions: 0,
      avgAttendance: 0,
      avgLoyalty: 0,
      totalDeputies: 0,
    };
  }

  // Count unique sessions from lawsVoted
  const laws = await ctx.db.query("lawsVoted").collect();

  const totalDeputies = profiles.filter((p: any) => !p.isSuplente).length;
  const avgAttendance =
    profiles.reduce((sum: number, p: any) => sum + p.participationRate, 0) /
    profiles.length;

  // Average loyalty from analytics (if computed)
  const analytics = await ctx.db.query("deputyAnalytics").collect();
  const avgLoyalty =
    analytics.length > 0
      ? analytics.reduce((sum: number, a: any) => sum + a.loyaltyScore, 0) /
        analytics.length
      : 0;

  return {
    totalSessions: laws.length,
    avgAttendance: Math.round(avgAttendance * 100),
    avgLoyalty: Math.round(avgLoyalty),
    totalDeputies,
  };
}

/** Public chamber stats query. */
export const getChamberStats = query({
  handler: async (ctx) => {
    return getChamberStatsInternal(ctx);
  },
});

/** Paginated votes for a deputy — used by the Recent Votes table. */
export const getVotesByDeputyPaginated = query({
  args: {
    deputyId: v.number(),
    cursor: v.optional(v.number()), // offset-based
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const allVotes = await ctx.db
      .query("votingRecords")
      .withIndex("by_deputyId", (q) =>
        q.eq("deputyId", args.deputyId)
      )
      .order("desc")
      .collect();

    const offset = args.cursor ?? 0;
    const page = allVotes.slice(offset, offset + limit);
    const hasMore = offset + limit < allVotes.length;

    return {
      votes: page.map((v) => ({
        votingId: v.votingId,
        questionId: v.questionId,
        questionText: v.questionText,
        questionPassed: v.questionPassed,
        vote: v.vote,
        sessionDate: epochToDateStr(v.sessionDate),
        votingTitle: v.votingTitle,
      })),
      nextCursor: hasMore ? offset + limit : null,
    };
  },
});

// ─── Additional queries (from user's existing codebase) ──────────────────

/** List all deputy voting profiles, optionally filtered by party. */
export const listProfiles = query({
  args: {
    partyCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.partyCode) {
      return ctx.db
        .query("deputyVotingProfiles")
        .withIndex("by_partyCode", (q) => q.eq("partyCode", args.partyCode!))
        .collect();
    }
    return ctx.db.query("deputyVotingProfiles").collect();
  },
});

/** Get a single deputy profile by deputyId. */
export const getProfile = query({
  args: { deputyId: v.number() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("deputyVotingProfiles")
      .withIndex("by_deputyId", (q) => q.eq("deputyId", args.deputyId))
      .first();
  },
});

/** Get a deputy profile linked to a politician. */
export const getProfileByPolitician = query({
  args: { politicianId: v.id("politicians") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("deputyVotingProfiles")
      .withIndex("by_politicianId", (q) =>
        q.eq("politicianId", args.politicianId)
      )
      .first();
  },
});

/** Get voting records for a specific deputy. */
export const getVotesByDeputy = query({
  args: {
    deputyId: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return ctx.db
      .query("votingRecords")
      .withIndex("by_deputyId", (q) => q.eq("deputyId", args.deputyId))
      .order("desc")
      .take(limit);
  },
});

/** Get voting records for a specific law/voting. */
export const getVotesByVoting = query({
  args: { votingId: v.number() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("votingRecords")
      .withIndex("by_votingId", (q) => q.eq("votingId", args.votingId))
      .collect();
  },
});

/** Get voting records linked to a politician. */
export const getVotesByPolitician = query({
  args: {
    politicianId: v.id("politicians"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return ctx.db
      .query("votingRecords")
      .withIndex("by_politicianId", (q) =>
        q.eq("politicianId", args.politicianId)
      )
      .order("desc")
      .take(limit);
  },
});

/** List laws/votings, most recent first. */
export const listLaws = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return ctx.db
      .query("lawsVoted")
      .withIndex("by_sessionDate")
      .order("desc")
      .take(limit);
  },
});
