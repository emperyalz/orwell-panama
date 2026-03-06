import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/** Convert epoch ms to "YYYY-MM-DD" date string */
function epochToDateStr(epoch: number): string {
  const d = new Date(epoch);
  return d.toISOString().slice(0, 10);
}

/**
 * Batch computation of deputy analytics.
 * Reads all voting records and computes: loyalty, dissent, swing votes,
 * controversial participation, pairwise alignment, monthly timeline,
 * attendance dates, and percentile rankings.
 *
 * Run after data ingestion: `npx convex run computeAnalytics:compute`
 */
export const compute = internalAction({
  handler: async (ctx) => {
    // 1. Load all deputy profiles
    const profiles: any[] = await ctx.runQuery(
      internal.computeAnalytics.getAllProfiles
    );
    if (profiles.length === 0) {
      console.log("No deputy profiles found — skipping analytics computation");
      return;
    }

    console.log(`Computing analytics for ${profiles.length} deputies...`);

    // 2. Load all voting records grouped by deputy
    const allRecords: any[] = await ctx.runQuery(
      internal.computeAnalytics.getAllVotingRecords
    );

    // 2b. Load lawsVoted for per-voting totals (swing/controversial detection)
    const allLaws: any[] = await ctx.runQuery(
      internal.computeAnalytics.getAllLaws
    );
    const lawByVotingId = new Map<number, any>();
    for (const law of allLaws) {
      lawByVotingId.set(law.votingId, law);
    }

    // Group records by deputy
    const byDeputy = new Map<number, any[]>();
    for (const rec of allRecords) {
      const existing = byDeputy.get(rec.deputyId) ?? [];
      existing.push(rec);
      byDeputy.set(rec.deputyId, existing);
    }

    // Group records by voting+question for party majority calculation
    const byQuestion = new Map<string, any[]>();
    for (const rec of allRecords) {
      const key = `${rec.votingId}-${rec.questionId}`;
      const existing = byQuestion.get(key) ?? [];
      existing.push(rec);
      byQuestion.set(key, existing);
    }

    // 3. Compute per-deputy analytics
    const allAnalytics: any[] = [];
    const attendanceRates: { deputyId: number; rate: number }[] = [];
    const loyaltyScores: { deputyId: number; score: number }[] = [];
    const voteCounts: { deputyId: number; count: number }[] = [];

    for (const profile of profiles) {
      const records = byDeputy.get(profile.deputyId) ?? [];
      if (records.length === 0) continue;

      // Monthly stats
      const monthMap = new Map<
        string,
        { total: number; aFavor: number; enContra: number; abstencion: number }
      >();
      const attendanceDateSet = new Set<string>();

      // Loyalty: compare to party majority on each question
      let agreements = 0;
      let disagreements = 0;
      const dissentVotes: any[] = [];

      // Swing votes: bills passing 36-38 where they voted a_favor
      const swingVotes: any[] = [];

      // Controversial: questions with 15+ en_contra
      const controversialVotes: any[] = [];

      for (const rec of records) {
        // Convert epoch ms to date string for aggregation
        const dateStr = epochToDateStr(rec.sessionDate);

        // Monthly aggregation
        const month = dateStr.slice(0, 7); // "2024-01"
        const ms = monthMap.get(month) ?? {
          total: 0,
          aFavor: 0,
          enContra: 0,
          abstencion: 0,
        };
        ms.total++;
        if (rec.vote === "a_favor") ms.aFavor++;
        else if (rec.vote === "en_contra") ms.enContra++;
        else ms.abstencion++;
        monthMap.set(month, ms);

        // Attendance dates
        attendanceDateSet.add(dateStr);

        // Party loyalty
        const questionKey = `${rec.votingId}-${rec.questionId}`;
        const questionVotes = byQuestion.get(questionKey) ?? [];
        const partyVotes = questionVotes.filter(
          (v: any) => v.partyCode === profile.partyCode && v.deputyId !== profile.deputyId
        );
        if (partyVotes.length > 0) {
          const voteCounts2 = { a_favor: 0, en_contra: 0, abstencion: 0 } as Record<string, number>;
          for (const pv of partyVotes) {
            voteCounts2[pv.vote] = (voteCounts2[pv.vote] ?? 0) + 1;
          }
          const majorityVote = Object.entries(voteCounts2).reduce((a, b) =>
            b[1] > a[1] ? b : a
          )[0];

          if (rec.vote === majorityVote) {
            agreements++;
          } else {
            disagreements++;
            if (dissentVotes.length < 10) {
              dissentVotes.push({
                votingId: rec.votingId,
                votingTitle: rec.votingTitle,
                sessionDate: dateStr,
                deputyVote: rec.vote,
                partyMajorityVote: majorityVote,
              });
            }
          }
        }

        // Get per-voting totals from lawsVoted for swing/controversial detection
        const law = lawByVotingId.get(rec.votingId);
        const lawTotalAFavor = law?.totalAFavor ?? 0;
        const lawTotalEnContra = law?.totalEnContra ?? 0;

        // Swing votes: total a_favor between 36-38 and they voted a_favor
        if (
          lawTotalAFavor >= 36 &&
          lawTotalAFavor <= 38 &&
          rec.vote === "a_favor" &&
          swingVotes.length < 10
        ) {
          // Avoid duplicates per voting
          if (!swingVotes.some((sv: any) => sv.votingId === rec.votingId)) {
            swingVotes.push({
              votingId: rec.votingId,
              votingTitle: rec.votingTitle,
              sessionDate: dateStr,
              totalAFavor: lawTotalAFavor,
            });
          }
        }

        // Controversial: 15+ en_contra
        if (
          lawTotalEnContra >= 15 &&
          controversialVotes.length < 10
        ) {
          if (
            !controversialVotes.some(
              (cv: any) => cv.votingId === rec.votingId
            )
          ) {
            controversialVotes.push({
              votingId: rec.votingId,
              votingTitle: rec.votingTitle,
              sessionDate: dateStr,
              deputyVote: rec.vote,
              totalEnContra: lawTotalEnContra,
              totalAFavor: lawTotalAFavor,
              passed: rec.questionPassed,
            });
          }
        }
      }

      const totalLoyaltyVotes = agreements + disagreements;
      const loyaltyScore =
        totalLoyaltyVotes > 0
          ? Math.round((agreements / totalLoyaltyVotes) * 100)
          : 100;

      // Monthly stats array
      const monthlyStats = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, ms]) => ({
          month,
          totalVotes: ms.total,
          aFavor: ms.aFavor,
          enContra: ms.enContra,
          abstencion: ms.abstencion,
          pctAFavor:
            ms.total > 0 ? Math.round((ms.aFavor / ms.total) * 100) : 0,
        }));

      const attendanceDates = Array.from(attendanceDateSet).sort();

      // Collect for ranking
      attendanceRates.push({
        deputyId: profile.deputyId,
        rate: profile.participationRate,
      });
      loyaltyScores.push({ deputyId: profile.deputyId, score: loyaltyScore });
      voteCounts.push({
        deputyId: profile.deputyId,
        count: records.length,
      });

      allAnalytics.push({
        deputyId: profile.deputyId,
        politicianId: profile.politicianId ?? undefined,
        loyaltyScore,
        dissentCount: disagreements,
        dissentVotes,
        swingVoteCount: swingVotes.length,
        swingVotes,
        controversialVotes,
        monthlyStats,
        attendanceDates,
        // Placeholders — filled after ranking computation
        attendancePercentile: 0,
        loyaltyPercentile: 0,
        votesPercentile: 0,
        topAllies: [],
        topRivals: [],
      });
    }

    // 4. Compute percentile rankings
    attendanceRates.sort((a, b) => a.rate - b.rate);
    loyaltyScores.sort((a, b) => a.score - b.score);
    voteCounts.sort((a, b) => a.count - b.count);

    const attendanceRank = new Map(
      attendanceRates.map((r, i) => [
        r.deputyId,
        Math.round((i / (attendanceRates.length - 1 || 1)) * 100),
      ])
    );
    const loyaltyRank = new Map(
      loyaltyScores.map((r, i) => [
        r.deputyId,
        Math.round((i / (loyaltyScores.length - 1 || 1)) * 100),
      ])
    );
    const votesRank = new Map(
      voteCounts.map((r, i) => [
        r.deputyId,
        Math.round((i / (voteCounts.length - 1 || 1)) * 100),
      ])
    );

    // 5. Compute pairwise alignment (sampled — last 200 questions per deputy)
    console.log("Computing pairwise alignment...");
    const deputyQuestions = new Map<number, Map<string, string>>();
    for (const [deputyId, records] of byDeputy) {
      const qMap = new Map<string, string>();
      // Take last 200 unique questions — sort by epoch desc
      const sorted = records.sort(
        (a: any, b: any) => b.sessionDate - a.sessionDate
      );
      let count = 0;
      for (const r of sorted) {
        const key = `${r.votingId}-${r.questionId}`;
        if (!qMap.has(key)) {
          qMap.set(key, r.vote);
          count++;
          if (count >= 200) break;
        }
      }
      deputyQuestions.set(deputyId, qMap);
    }

    // Build deputy name/party lookup
    const profileMap = new Map(
      profiles.map((p: any) => [
        p.deputyId,
        { name: p.deputyName, partyCode: p.partyCode },
      ])
    );

    for (const analytics of allAnalytics) {
      const myQuestions = deputyQuestions.get(analytics.deputyId);
      if (!myQuestions || myQuestions.size === 0) continue;

      const agreements: { deputyId: number; agree: number; total: number }[] =
        [];
      for (const [otherId, otherQuestions] of deputyQuestions) {
        if (otherId === analytics.deputyId) continue;

        let agree = 0;
        let total = 0;
        for (const [qKey, myVote] of myQuestions) {
          const otherVote = otherQuestions.get(qKey);
          if (otherVote) {
            total++;
            if (myVote === otherVote) agree++;
          }
        }
        if (total >= 10) {
          agreements.push({ deputyId: otherId, agree, total });
        }
      }

      // Sort by agreement % desc for allies
      agreements.sort(
        (a, b) => b.agree / b.total - a.agree / a.total
      );

      analytics.topAllies = agreements.slice(0, 5).map((a) => ({
        deputyId: a.deputyId,
        deputyName: profileMap.get(a.deputyId)?.name ?? "Desconocido",
        partyCode: profileMap.get(a.deputyId)?.partyCode ?? "?",
        agreementPct: Math.round((a.agree / a.total) * 100),
        sharedVotes: a.total,
      }));

      // Sort by agreement % asc for rivals
      agreements.sort(
        (a, b) => a.agree / a.total - b.agree / b.total
      );

      analytics.topRivals = agreements.slice(0, 5).map((a) => ({
        deputyId: a.deputyId,
        deputyName: profileMap.get(a.deputyId)?.name ?? "Desconocido",
        partyCode: profileMap.get(a.deputyId)?.partyCode ?? "?",
        agreementPct: Math.round((a.agree / a.total) * 100),
        sharedVotes: a.total,
      }));

      // Apply rankings
      analytics.attendancePercentile =
        attendanceRank.get(analytics.deputyId) ?? 50;
      analytics.loyaltyPercentile =
        loyaltyRank.get(analytics.deputyId) ?? 50;
      analytics.votesPercentile = votesRank.get(analytics.deputyId) ?? 50;
    }

    // 6. Upsert into deputyAnalytics (batch)
    console.log(`Upserting ${allAnalytics.length} analytics records...`);
    const BATCH_SIZE = 10;
    for (let i = 0; i < allAnalytics.length; i += BATCH_SIZE) {
      const batch = allAnalytics.slice(i, i + BATCH_SIZE);
      await ctx.runMutation(internal.computeAnalytics.upsertBatch, {
        records: batch.map((a) => ({
          deputyId: a.deputyId,
          politicianId: a.politicianId,
          loyaltyScore: a.loyaltyScore,
          dissentCount: a.dissentCount,
          dissentVotes: a.dissentVotes,
          swingVoteCount: a.swingVoteCount,
          swingVotes: a.swingVotes,
          attendancePercentile: a.attendancePercentile,
          loyaltyPercentile: a.loyaltyPercentile,
          votesPercentile: a.votesPercentile,
          controversialVotes: a.controversialVotes,
          topAllies: a.topAllies,
          topRivals: a.topRivals,
          monthlyStats: a.monthlyStats,
          attendanceDates: a.attendanceDates,
        })),
      });
    }

    console.log("Analytics computation complete!");
  },
});

/** Internal query: get all deputy profiles */
export const getAllProfiles = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("deputyVotingProfiles").collect();
  },
});

/** Internal query: get all voting records */
export const getAllVotingRecords = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("votingRecords").collect();
  },
});

/** Internal query: get all laws for vote totals */
export const getAllLaws = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("lawsVoted").collect();
  },
});

/** Internal mutation: upsert a batch of analytics records */
export const upsertBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        deputyId: v.number(),
        politicianId: v.optional(v.id("politicians")),
        loyaltyScore: v.number(),
        dissentCount: v.number(),
        dissentVotes: v.array(
          v.object({
            votingId: v.number(),
            votingTitle: v.string(),
            sessionDate: v.string(),
            deputyVote: v.string(),
            partyMajorityVote: v.string(),
          })
        ),
        swingVoteCount: v.number(),
        swingVotes: v.array(
          v.object({
            votingId: v.number(),
            votingTitle: v.string(),
            sessionDate: v.string(),
            totalAFavor: v.number(),
          })
        ),
        attendancePercentile: v.number(),
        loyaltyPercentile: v.number(),
        votesPercentile: v.number(),
        controversialVotes: v.array(
          v.object({
            votingId: v.number(),
            votingTitle: v.string(),
            sessionDate: v.string(),
            deputyVote: v.string(),
            totalEnContra: v.number(),
            totalAFavor: v.number(),
            passed: v.boolean(),
          })
        ),
        topAllies: v.array(
          v.object({
            deputyId: v.number(),
            deputyName: v.string(),
            partyCode: v.string(),
            agreementPct: v.number(),
            sharedVotes: v.number(),
          })
        ),
        topRivals: v.array(
          v.object({
            deputyId: v.number(),
            deputyName: v.string(),
            partyCode: v.string(),
            agreementPct: v.number(),
            sharedVotes: v.number(),
          })
        ),
        monthlyStats: v.array(
          v.object({
            month: v.string(),
            totalVotes: v.number(),
            aFavor: v.number(),
            enContra: v.number(),
            abstencion: v.number(),
            pctAFavor: v.number(),
          })
        ),
        attendanceDates: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const rec of args.records) {
      // Check if existing
      const existing = await ctx.db
        .query("deputyAnalytics")
        .withIndex("by_deputyId", (q) => q.eq("deputyId", rec.deputyId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...rec,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("deputyAnalytics", {
          ...rec,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});
