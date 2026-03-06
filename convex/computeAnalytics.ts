import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/** Convert epoch ms to "YYYY-MM-DD" date string */
function epochToDateStr(epoch: number): string {
  const d = new Date(epoch);
  return d.toISOString().slice(0, 10);
}

/**
 * Memory-efficient analytics computation.
 *
 * Two-pass approach to stay within Convex's 64MB memory limit:
 * Pass 1: For each deputy, load their records via indexed query,
 *          extract individual stats + compact vote map, then discard raw records.
 * Pass 2: Compute cross-deputy metrics (loyalty, pairwise alignment, percentiles)
 *          from compact in-memory data structures only.
 *
 * Run after data ingestion: `npx convex run computeAnalytics:compute`
 */
export const compute = internalAction({
  handler: async (ctx) => {
    // Load profiles and laws (small datasets)
    const profiles: any[] = await ctx.runQuery(
      internal.computeAnalytics.getAllProfiles
    );
    if (profiles.length === 0) {
      console.log("No deputy profiles found — skipping analytics computation");
      return;
    }

    console.log(`Computing analytics for ${profiles.length} deputies...`);

    const allLaws: any[] = await ctx.runQuery(
      internal.computeAnalytics.getAllLaws
    );
    const lawByVotingId = new Map<number, { totalAFavor: number; totalEnContra: number }>();
    for (const law of allLaws) {
      lawByVotingId.set(law.votingId, {
        totalAFavor: law.totalAFavor,
        totalEnContra: law.totalEnContra,
      });
    }

    // Profile lookup
    const profileMap = new Map(
      profiles.map((p: any) => [
        p.deputyId,
        { name: p.deputyName, partyCode: p.partyCode, politicianId: p.politicianId },
      ])
    );

    // ═══════════════════════════════════════════════════════════
    // PASS 1: Per-deputy processing — build compact data
    // ═══════════════════════════════════════════════════════════
    // Compact vote map per deputy: questionKey → vote string (~20 bytes per entry)
    // 244 deputies × ~1500 entries × ~70 bytes/entry ≈ ~25MB — fits in 64MB
    const deputyVoteMaps = new Map<number, Map<string, string>>();
    // Per-deputy individual stats (excluding cross-deputy metrics)
    const deputyStats = new Map<number, {
      swingVotes: any[];
      controversialVotes: any[];
      monthlyStats: any[];
      attendanceDates: string[];
      recordCount: number;
    }>();

    const attendanceRates: { deputyId: number; rate: number }[] = [];
    const voteCounts: { deputyId: number; count: number }[] = [];

    for (let idx = 0; idx < profiles.length; idx++) {
      const profile = profiles[idx];

      // Load this deputy's records (~1500 avg, well under 32K doc limit)
      const records: any[] = await ctx.runQuery(
        internal.computeAnalytics.getVotingRecordsByDeputy,
        { deputyId: profile.deputyId }
      );
      if (records.length === 0) continue;

      // Build FULL vote map (all questions, not sampled) for loyalty computation
      const voteMap = new Map<string, string>();
      for (const r of records) {
        const key = `${r.votingId}-${r.questionId}`;
        voteMap.set(key, r.vote);
      }
      deputyVoteMaps.set(profile.deputyId, voteMap);

      // Compute individual stats
      const monthMap = new Map<string, { total: number; aFavor: number; enContra: number; abstencion: number }>();
      const attendanceDateSet = new Set<string>();
      const swingVotes: any[] = [];
      const controversialVotes: any[] = [];

      for (const rec of records) {
        const dateStr = epochToDateStr(rec.sessionDate);
        const month = dateStr.slice(0, 7);

        const ms = monthMap.get(month) ?? { total: 0, aFavor: 0, enContra: 0, abstencion: 0 };
        ms.total++;
        if (rec.vote === "a_favor") ms.aFavor++;
        else if (rec.vote === "en_contra") ms.enContra++;
        else ms.abstencion++;
        monthMap.set(month, ms);

        attendanceDateSet.add(dateStr);

        const law = lawByVotingId.get(rec.votingId);
        if (law) {
          if (
            law.totalAFavor >= 36 && law.totalAFavor <= 38 &&
            rec.vote === "a_favor" && swingVotes.length < 10 &&
            !swingVotes.some((sv: any) => sv.votingId === rec.votingId)
          ) {
            swingVotes.push({
              votingId: rec.votingId,
              votingTitle: rec.votingTitle,
              sessionDate: dateStr,
              totalAFavor: law.totalAFavor,
            });
          }
          if (
            law.totalEnContra >= 15 && controversialVotes.length < 10 &&
            !controversialVotes.some((cv: any) => cv.votingId === rec.votingId)
          ) {
            controversialVotes.push({
              votingId: rec.votingId,
              votingTitle: rec.votingTitle,
              sessionDate: dateStr,
              deputyVote: rec.vote,
              totalEnContra: law.totalEnContra,
              totalAFavor: law.totalAFavor,
              passed: rec.questionPassed,
            });
          }
        }
      }

      deputyStats.set(profile.deputyId, {
        swingVotes,
        controversialVotes,
        monthlyStats: Array.from(monthMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, ms]) => ({
            month,
            totalVotes: ms.total,
            aFavor: ms.aFavor,
            enContra: ms.enContra,
            abstencion: ms.abstencion,
            pctAFavor: ms.total > 0 ? Math.round((ms.aFavor / ms.total) * 100) : 0,
          })),
        attendanceDates: Array.from(attendanceDateSet).sort(),
        recordCount: records.length,
      });

      attendanceRates.push({ deputyId: profile.deputyId, rate: profile.participationRate });
      voteCounts.push({ deputyId: profile.deputyId, count: records.length });

      // Raw records discarded here (only voteMap and stats kept)
      if ((idx + 1) % 50 === 0) console.log(`  Loaded ${idx + 1}/${profiles.length} deputies`);
    }

    console.log(`Pass 1 complete: ${deputyStats.size} deputies with votes`);

    // ═══════════════════════════════════════════════════════════
    // PASS 2: Cross-deputy analytics from compact vote maps
    // ═══════════════════════════════════════════════════════════

    // Group deputies by party for loyalty computation
    const partyMembers = new Map<string, number[]>();
    for (const profile of profiles) {
      if (!deputyVoteMaps.has(profile.deputyId)) continue;
      const members = partyMembers.get(profile.partyCode) ?? [];
      members.push(profile.deputyId);
      partyMembers.set(profile.partyCode, members);
    }

    // Build final analytics
    const allAnalytics: any[] = [];
    const loyaltyScores: { deputyId: number; score: number }[] = [];

    for (const profile of profiles) {
      const myVoteMap = deputyVoteMaps.get(profile.deputyId);
      const stats = deputyStats.get(profile.deputyId);
      if (!myVoteMap || !stats) continue;

      // ── Party loyalty ──
      // For each question this deputy voted on, determine party majority
      // by checking party members' vote maps
      const myPartyMembers = (partyMembers.get(profile.partyCode) ?? [])
        .filter((id: number) => id !== profile.deputyId);

      let agreements = 0;
      let disagreements = 0;
      const dissentVotes: any[] = [];

      for (const [qKey, myVote] of myVoteMap) {
        // Count party votes on this question
        const partyCounts: Record<string, number> = { a_favor: 0, en_contra: 0, abstencion: 0 };
        let partyVotersOnQ = 0;

        for (const memberId of myPartyMembers) {
          const memberMap = deputyVoteMaps.get(memberId);
          const memberVote = memberMap?.get(qKey);
          if (memberVote) {
            partyCounts[memberVote]++;
            partyVotersOnQ++;
          }
        }

        if (partyVotersOnQ === 0) continue;

        const majorityVote = Object.entries(partyCounts).reduce((a, b) =>
          b[1] > a[1] ? b : a
        )[0];

        if (myVote === majorityVote) {
          agreements++;
        } else {
          disagreements++;
          if (dissentVotes.length < 10) {
            const votingId = parseInt(qKey.split("-")[0]);
            dissentVotes.push({
              votingId,
              votingTitle: "",
              sessionDate: "",
              deputyVote: myVote,
              partyMajorityVote: majorityVote,
            });
          }
        }
      }

      const totalLoyalty = agreements + disagreements;
      const loyaltyScore = totalLoyalty > 0
        ? Math.round((agreements / totalLoyalty) * 100)
        : 100;
      loyaltyScores.push({ deputyId: profile.deputyId, score: loyaltyScore });

      // ── Pairwise alignment (sampled: last 100 questions) ──
      // Limit to recent questions for pairwise to keep computation fast
      const recentQuestions = new Map<string, string>();
      let count = 0;
      for (const [k, v2] of myVoteMap) {
        recentQuestions.set(k, v2);
        count++;
        if (count >= 100) break;
      }

      const pairAgreements: { deputyId: number; agree: number; total: number }[] = [];
      for (const [otherId, otherMap] of deputyVoteMaps) {
        if (otherId === profile.deputyId) continue;
        let agree = 0;
        let total = 0;
        for (const [qKey, myVote] of recentQuestions) {
          const otherVote = otherMap.get(qKey);
          if (otherVote) {
            total++;
            if (myVote === otherVote) agree++;
          }
        }
        if (total >= 10) {
          pairAgreements.push({ deputyId: otherId, agree, total });
        }
      }

      pairAgreements.sort((a, b) => b.agree / b.total - a.agree / a.total);
      const topAllies = pairAgreements.slice(0, 5).map((a) => ({
        deputyId: a.deputyId,
        deputyName: profileMap.get(a.deputyId)?.name ?? "Desconocido",
        partyCode: profileMap.get(a.deputyId)?.partyCode ?? "?",
        agreementPct: Math.round((a.agree / a.total) * 100),
        sharedVotes: a.total,
      }));

      pairAgreements.sort((a, b) => a.agree / a.total - b.agree / b.total);
      const topRivals = pairAgreements.slice(0, 5).map((a) => ({
        deputyId: a.deputyId,
        deputyName: profileMap.get(a.deputyId)?.name ?? "Desconocido",
        partyCode: profileMap.get(a.deputyId)?.partyCode ?? "?",
        agreementPct: Math.round((a.agree / a.total) * 100),
        sharedVotes: a.total,
      }));

      allAnalytics.push({
        deputyId: profile.deputyId,
        politicianId: profileMap.get(profile.deputyId)?.politicianId,
        loyaltyScore,
        dissentCount: disagreements,
        dissentVotes,
        swingVoteCount: stats.swingVotes.length,
        swingVotes: stats.swingVotes,
        controversialVotes: stats.controversialVotes,
        monthlyStats: stats.monthlyStats,
        attendanceDates: stats.attendanceDates,
        topAllies,
        topRivals,
        // Percentiles filled below
        attendancePercentile: 0,
        loyaltyPercentile: 0,
        votesPercentile: 0,
      });
    }

    // ── Percentile rankings ──
    attendanceRates.sort((a, b) => a.rate - b.rate);
    loyaltyScores.sort((a, b) => a.score - b.score);
    voteCounts.sort((a, b) => a.count - b.count);

    const attendanceRank = new Map(
      attendanceRates.map((r, i) => [r.deputyId, Math.round((i / (attendanceRates.length - 1 || 1)) * 100)])
    );
    const loyaltyRank = new Map(
      loyaltyScores.map((r, i) => [r.deputyId, Math.round((i / (loyaltyScores.length - 1 || 1)) * 100)])
    );
    const votesRank = new Map(
      voteCounts.map((r, i) => [r.deputyId, Math.round((i / (voteCounts.length - 1 || 1)) * 100)])
    );

    for (const a of allAnalytics) {
      a.attendancePercentile = attendanceRank.get(a.deputyId) ?? 50;
      a.loyaltyPercentile = loyaltyRank.get(a.deputyId) ?? 50;
      a.votesPercentile = votesRank.get(a.deputyId) ?? 50;
    }

    // ═══════════════════════════════════════════════════════════
    // UPSERT results
    // ═══════════════════════════════════════════════════════════
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

/** Internal query: get voting records for a specific deputy */
export const getVotingRecordsByDeputy = internalQuery({
  args: { deputyId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("votingRecords")
      .withIndex("by_deputyId", (q) => q.eq("deputyId", args.deputyId))
      .collect();
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
      const existing = await ctx.db
        .query("deputyAnalytics")
        .withIndex("by_deputyId", (q) => q.eq("deputyId", rec.deputyId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { ...rec, updatedAt: now });
      } else {
        await ctx.db.insert("deputyAnalytics", { ...rec, createdAt: now, updatedAt: now });
      }
    }
  },
});
