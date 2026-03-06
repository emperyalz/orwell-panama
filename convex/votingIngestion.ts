import { mutation } from "./_generated/server";
import { v } from "convex/values";

// NOTE: These are `mutation` (not internalMutation) so the seed script can call them.
// After ingestion, change to `internalMutation` for production safety.

export const seedLaws = mutation({
  args: {
    laws: v.array(
      v.object({
        votingId: v.number(),
        reportId: v.number(),
        sessionId: v.number(),
        sessionDate: v.number(),
        sessionType: v.string(),
        votingTitle: v.string(),
        votingDescription: v.optional(v.string()),
        isSecret: v.boolean(),
        votingStart: v.optional(v.number()),
        votingEnd: v.optional(v.number()),
        totalAFavor: v.number(),
        totalEnContra: v.number(),
        totalAbstencion: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    for (const law of args.laws) {
      const existing = await ctx.db
        .query("lawsVoted")
        .withIndex("by_votingId", (q) => q.eq("votingId", law.votingId))
        .first();
      if (existing) continue;
      await ctx.db.insert("lawsVoted", { ...law, createdAt: now, updatedAt: now });
      inserted++;
    }
    return { inserted };
  },
});

export const seedVotingRecords = mutation({
  args: {
    records: v.array(
      v.object({
        voteId: v.number(),
        votingId: v.number(),
        questionId: v.number(),
        deputyId: v.number(),
        deputyName: v.string(),
        politicianId: v.optional(v.id("politicians")),
        partyCode: v.string(),
        circuit: v.string(),
        vote: v.union(
          v.literal("a_favor"),
          v.literal("en_contra"),
          v.literal("abstencion")
        ),
        isSuplente: v.boolean(),
        sessionDate: v.number(),
        votingTitle: v.string(),
        questionText: v.string(),
        questionPassed: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    for (const rec of args.records) {
      await ctx.db.insert("votingRecords", { ...rec, createdAt: now, updatedAt: now });
      inserted++;
    }
    return { inserted };
  },
});

export const seedProfiles = mutation({
  args: {
    profiles: v.array(
      v.object({
        deputyId: v.number(),
        deputyName: v.string(),
        politicianId: v.optional(v.id("politicians")),
        partyCode: v.string(),
        circuit: v.string(),
        isSuplente: v.boolean(),
        totalVotes: v.number(),
        totalAFavor: v.number(),
        totalEnContra: v.number(),
        totalAbstencion: v.number(),
        participationRate: v.number(),
        firstVoteDate: v.number(),
        lastVoteDate: v.number(),
        sessionsAttended: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    for (const profile of args.profiles) {
      const existing = await ctx.db
        .query("deputyVotingProfiles")
        .withIndex("by_deputyId", (q) => q.eq("deputyId", profile.deputyId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...profile, updatedAt: now });
      } else {
        await ctx.db.insert("deputyVotingProfiles", { ...profile, createdAt: now, updatedAt: now });
        inserted++;
      }
    }
    return { inserted };
  },
});

export const seedDeputyBios = mutation({
  args: {
    bios: v.array(
      v.object({
        diputadoId: v.number(),
        deputyId: v.number(),
        nombreCompleto: v.string(),
        nombres: v.string(),
        apellidos: v.string(),
        slug: v.string(),
        partido: v.string(),
        partyCode: v.string(),
        provincia: v.string(),
        circuito: v.string(),
        suplentes: v.optional(v.string()),
        correo: v.optional(v.string()),
        profileUrl: v.optional(v.string()),
        fotoUrl: v.optional(v.string()),
        pdfUrl: v.optional(v.string()),
        hasPdf: v.boolean(),
        resumeText: v.optional(v.string()),
        resumePages: v.optional(v.number()),
        structuredData: v.optional(
          v.object({
            fechaNacimiento: v.optional(v.string()),
            cedula: v.optional(v.string()),
            estadoCivil: v.optional(v.string()),
            direccion: v.optional(v.string()),
            educacion: v.array(
              v.object({
                institucion: v.optional(v.string()),
                titulo: v.optional(v.string()),
                periodo: v.optional(v.string()),
                descripcion: v.optional(v.string()),
              })
            ),
            experienciaLaboral: v.array(
              v.object({
                empresa: v.optional(v.string()),
                cargo: v.optional(v.string()),
                periodo: v.optional(v.string()),
                descripcion: v.optional(v.string()),
              })
            ),
            cargosPoliticos: v.array(
              v.object({
                cargo: v.optional(v.string()),
                periodo: v.optional(v.string()),
                partido: v.optional(v.string()),
              })
            ),
            habilidades: v.array(v.string()),
            idiomas: v.array(v.string()),
            seminariosCursos: v.array(v.string()),
          })
        ),
        aiSummary: v.optional(v.string()),
        aiKeyQualifications: v.optional(v.array(v.string())),
        aiEducationLevel: v.optional(v.string()),
        aiYearsExperience: v.optional(v.number()),
        aiProfessionalSector: v.optional(v.string()),
        seatNumber: v.optional(v.number()),
        gender: v.optional(v.string()),
        bancada: v.optional(v.string()),
        bancadaFull: v.optional(v.string()),
        bancadaColor: v.optional(v.string()),
        cssReformVote: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;
    for (const bio of args.bios) {
      const existing = await ctx.db
        .query("deputyBios")
        .withIndex("by_deputyId", (q) => q.eq("deputyId", bio.deputyId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...bio, updatedAt: now });
        updated++;
      } else {
        await ctx.db.insert("deputyBios", { ...bio, createdAt: now, updatedAt: now });
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

/** Check how many voting records exist (for resume support). */
export const getVotingRecordCount = mutation({
  handler: async (ctx) => {
    // Count a sample to check if data exists
    const sample = await ctx.db.query("votingRecords").take(1);
    if (sample.length === 0) return { count: 0, maxVoteId: 0 };
    // Get approximate count by checking latest records
    const latest = await ctx.db
      .query("votingRecords")
      .withIndex("by_voteId")
      .order("desc")
      .first();
    return { count: -1, maxVoteId: latest?.voteId ?? 0 };
  },
});
