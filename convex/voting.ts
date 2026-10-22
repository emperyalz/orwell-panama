import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getVoteDetail=query({args:{politicianId:v.id('politicians'),questionId:v.number()},handler:async(ctx,args)=>{
 const profile=await ctx.db.query('deputyVotingProfiles').withIndex('by_politicianId',q=>q.eq('politicianId',args.politicianId)).first();if(!profile)return null;
 const vote=await ctx.db.query('votingRecords').withIndex('by_deputyId',q=>q.eq('deputyId',profile.deputyId)).filter(q=>q.eq(q.field('questionId'),args.questionId)).first();if(!vote)return null;
 const session=await ctx.db.query('votingSessions').withIndex('by_votingId',q=>q.eq('votingId',vote.votingId)).first();return {...vote,sourceUrl:session?.reportId?`https://prensa507.asamblea.gob.pa/api/v1/report/${session.reportId}/public`:null};
}});

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

    // Fetch analytics, bio, transparency, and recent votes in parallel
    const [analytics, bio, transparency, recentVotesDocs] = await Promise.all([
      ctx.db
        .query("deputyAnalytics")
        .withIndex("by_deputyId", (q) => q.eq("deputyId", profile.deputyId))
        .first(),
      ctx.db
        .query("deputyBios")
        .withIndex("by_deputyId", (q) => q.eq("deputyId", profile.deputyId))
        .first(),
      ctx.db
        .query("deputyTransparency")
        .withIndex("by_politicianId", (q) =>
          q.eq("politicianId", args.politicianId)
        )
        .first(),
      ctx.db
        .query("votingRecords")
        .withIndex("by_deputyId_sessionDate", (q) =>
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
      sessionDate: String(v.sessionDate),
      votingTitle: v.votingTitle,
      totalAFavor: v.totalAFavor ?? 0,
      totalEnContra: v.totalEnContra ?? 0,
      totalAbstencion: v.totalAbstencion ?? 0,
      votesNeeded: v.votesNeeded ?? 0,
    }));

    return {
      profile: profile
        ? {
            deputyId: profile.deputyId,
            fullName: String(profile.fullName ?? profile.deputyName ?? "Unknown"),
            partyCode: profile.partyCode,
            partyName: String(profile.partyName ?? profile.partyCode),
            partyColor: String(profile.partyColor ?? "#666"),
            circuit: profile.circuit,
            seat: Number(profile.seat ?? 0),
            isSuplente: profile.isSuplente,
            principalId: profile.principalId,
            principalName: profile.principalName,
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
            aiProfessionalSectors: bio.aiProfessionalSectors,
            correo: bio.correo,
            structuredData: bio.structuredData,
          }
        : null,
      transparency: transparency
        ? {
            suplente: transparency.suplente,
            planillaTotal: transparency.planillaTotal,
            biography: transparency.biography,
            commissions: transparency.commissions,
            performanceScores: transparency.performanceScores,
            documents: transparency.documents,
            voluntaryDeclarations: transparency.voluntaryDeclarations,
            espacioCivicoUrl: transparency.espacioCivicoUrl,
            extractedPropuesta: transparency.extractedPropuesta,
            extractedIntereses: transparency.extractedIntereses,
            extractedPatrimonio: transparency.extractedPatrimonio,
          }
        : null,
      recentVotes,
      chamberStats: await getChamberStatsInternal(ctx),
    };
  },
});

/** Chamber-wide stats from the one stored row (refreshChamberStats); computed live only before the first refresh. */
async function getChamberStatsInternal(ctx: any) {
  const row = await ctx.db
    .query("chamberStats")
    .withIndex("by_key", (q: any) => q.eq("key", CHAMBER_KEY))
    .first();
  if (row) {
    const { totalSessions, avgAttendance, avgLoyalty, totalDeputies } = row;
    return { totalSessions, avgAttendance, avgLoyalty, totalDeputies };
  }
  return computeChamberStats(ctx);
}

const CHAMBER_KEY = "chamber";

/** Recompute and store chamber-wide stats. Scans every deputy's profile and analytics (~1 MB), so it
 * runs after vote data changes, never per profile view. */
export async function storeChamberStats(ctx: any) {
  const stats = await computeChamberStats(ctx);
  const row = await ctx.db
    .query("chamberStats")
    .withIndex("by_key", (q: any) => q.eq("key", CHAMBER_KEY))
    .first();
  if (row) await ctx.db.patch(row._id, { ...stats, computedAt: Date.now() });
  else await ctx.db.insert("chamberStats", { key: CHAMBER_KEY, ...stats, computedAt: Date.now() });
  return stats;
}

export const refreshChamberStats = internalMutation({
  args: {},
  handler: (ctx) => storeChamberStats(ctx),
});

async function computeChamberStats(ctx: any) {
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

  const totalDeputies = profiles.filter((p: any) => !p.isSuplente).length;
  const avgAttendance =
    profiles.reduce((sum: number, p: any) => sum + p.participationRate, 0) /
    profiles.length;

  // Compute total unique session dates + average loyalty from analytics
  const analytics = await ctx.db.query("deputyAnalytics").collect();

  // Total unique session dates = union of all deputies' attendance dates
  const allSessionDates = new Set<string>();
  for (const a of analytics) {
    if (a.attendanceDates) {
      for (const d of a.attendanceDates) {
        allSessionDates.add(d);
      }
    }
  }

  const avgLoyalty =
    analytics.length > 0
      ? analytics.reduce((sum: number, a: any) => sum + a.loyaltyScore, 0) /
        analytics.length
      : 0;

  return {
    totalSessions: allSessionDates.size,
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
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 20)));
    const offset = Math.max(0, Math.floor(args.cursor ?? 0));
    const allVotes = await ctx.db
      .query("votingRecords")
      .withIndex("by_deputyId_sessionDate", (q) =>
        q.eq("deputyId", args.deputyId)
      )
      .order("desc")
      .take(offset + limit + 1);

    const page = allVotes.slice(offset, offset + limit);
    const hasMore = offset + limit < allVotes.length;

    return {
      votes: page.map((v) => ({
        votingId: v.votingId,
        questionId: v.questionId,
        questionText: v.questionText,
        questionPassed: v.questionPassed,
        vote: v.vote,
        sessionDate: String(v.sessionDate),
        votingTitle: v.votingTitle,
        totalAFavor: v.totalAFavor ?? 0,
        totalEnContra: v.totalEnContra ?? 0,
        totalAbstencion: v.totalAbstencion ?? 0,
        votesNeeded: v.votesNeeded ?? 0,
      })),
      nextCursor: hasMore ? offset + limit : null,
    };
  },
});
