import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Politicians — elected officials
  politicians: defineTable({
    externalId: v.string(), // e.g. "DEP-015", "MAY-003"
    name: v.string(),
    slug: v.string(), // URL-friendly: "jamis-acosta"
    party: v.string(), // Short code: "RM", "PRD"
    partyFull: v.string(), // Full name: "Realizando Metas"
    role: v.string(), // "Diputado", "Alcalde", etc.
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
    headshot: v.string(), // Path: "/images/headshots/DEP-015.jpg"
    headshotStorageId: v.optional(v.id("_storage")), // Convex file storage
    officialGovUrl: v.optional(v.string()),
    wikipediaUrl: v.optional(v.string()),
    personalWebsite: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_slug", ["slug"])
    .index("by_party", ["party"])
    .index("by_roleCategory", ["roleCategory"])
    .index("by_province", ["province"]),

  // Social media accounts linked to politicians
  accounts: defineTable({
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
    avatar: v.string(), // Path: "/images/avatars/DEP-015-instagram.jpg"
    avatarStorageId: v.optional(v.id("_storage")), // Convex file storage
    verdict: v.union(v.literal("CONFIRMED"), v.literal("PROBABLE")),
    score: v.number(),
    pollingTier: v.union(
      v.literal("hot"),
      v.literal("warm"),
      v.literal("cool"),
      v.literal("dormant")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_politician", ["politicianId"])
    .index("by_platform", ["platform"])
    .index("by_platform_handle", ["platform", "handle"]),

  // Political parties
  parties: defineTable({
    code: v.string(), // "CD", "PRD", "PAN", etc.
    name: v.string(), // Short name: "Cambio Democrático"
    fullName: v.string(), // Full official name
    logo: v.string(), // Path: "/icons/parties/cd.svg"
    logoStorageId: v.optional(v.id("_storage")),
    officialWebsite: v.optional(v.string()),
    socialAccounts: v.optional(
      v.array(
        v.object({
          platform: v.string(),
          url: v.string(),
        })
      )
    ),
    wikipediaUrls: v.optional(
      v.array(
        v.object({
          language: v.string(), // "es", "en", etc.
          url: v.string(),
        })
      )
    ),
    wikidataUrl: v.optional(v.string()), // e.g. https://www.wikidata.org/wiki/Q12345
    color: v.string(), // Hex color
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),

  // Media sources — news, blogs, TV, reporters, podcasters
  mediaSources: defineTable({
    name: v.string(),
    slug: v.string(),
    category: v.union(
      v.literal("Digital News"),
      v.literal("Newspaper"),
      v.literal("TV Network"),
      v.literal("Political Blog"),
      v.literal("Reporter"),
      v.literal("Podcaster"),
      v.literal("Radio")
    ),
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
          title: v.string(), // e.g. "La Prensa Podcast", "En Contexto"
          url: v.string(),
        })
      )
    ),
    contactEmail: v.optional(v.string()),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  // Featured video clips — downloaded via cobalt and stored in Convex file storage
  featuredVideos: defineTable({
    sourceUrl: v.string(),           // original social media share URL
    platform: v.optional(v.string()),
    handle: v.optional(v.string()),  // @username shown on card
    avatarUrl: v.optional(v.string()), // profile picture URL
    storageId: v.optional(v.id("_storage")),
    mp4Url: v.optional(v.string()),  // permanent Convex serving URL
    posterUrl: v.optional(v.string()),
    title: v.optional(v.string()),   // optional caption/title for admin display
    isFeatured: v.optional(v.boolean()),   // show in featured carousel hero
    showInVideos: v.optional(v.boolean()), // show in the Videos grid section
    displayOrder: v.optional(v.number()),  // ordering within each section
    isActive: v.optional(v.boolean()),     // legacy — no longer used in UI
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error"),
    ),
    errorMsg: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_sourceUrl", ["sourceUrl"]),

  // ─── Voting Records ────────────────────────────────────────────────────────

  // Individual vote records (~360K) — one row per deputy per question
  votingRecords: defineTable({
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
    vote: v.string(), // "a_favor", "en_contra", "abstencion"
    isSuplente: v.boolean(),
    suplenteOf: v.optional(v.string()),
    sessionDate: v.string(), // "2021-04-05"
    votingTitle: v.string(),
    politicianId: v.optional(v.id("politicians")),
  })
    .index("by_deputyId", ["deputyId"])
    .index("by_votingId", ["votingId"])
    .index("by_politicianId", ["politicianId"])
    .index("by_deputyId_sessionDate", ["deputyId", "sessionDate"]),

  // Voting sessions / laws (~937) — one row per legislative vote event
  votingSessions: defineTable({
    votingId: v.number(),
    reportId: v.number(),
    sessionId: v.number(),
    sessionDate: v.string(),
    sessionType: v.string(),
    votingTitle: v.string(),
    votingDescription: v.optional(v.string()),
    totalAFavor: v.optional(v.number()),
    totalEnContra: v.optional(v.number()),
    totalAbstencion: v.optional(v.number()),
    passed: v.optional(v.boolean()),
    votesNeeded: v.optional(v.number()),
  })
    .index("by_votingId", ["votingId"])
    .index("by_sessionDate", ["sessionDate"]),

  // Deputy voting profiles (~244) — aggregated stats per deputy
  deputyVotingProfiles: defineTable({
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
    totalVotes: v.number(),
    totalAFavor: v.number(),
    totalEnContra: v.number(),
    totalAbstencion: v.number(),
    sessionsAttended: v.number(),
    participationRate: v.number(), // 0-1
  })
    .index("by_deputyId", ["deputyId"])
    .index("by_politicianId", ["politicianId"])
    .index("by_partyCode", ["partyCode"]),

  // Deputy biographical data (~71 principal deputies)
  deputyBios: defineTable({
    deputyId: v.number(),
    politicianId: v.optional(v.id("politicians")),
    correo: v.optional(v.string()),
    aiSummary: v.optional(v.string()),
    aiKeyQualifications: v.optional(v.array(v.string())),
    aiEducationLevel: v.optional(v.string()),
    aiProfessionalSectors: v.optional(v.array(v.string())),
    structuredData: v.optional(
      v.object({
        educacion: v.optional(
          v.array(
            v.object({
              institucion: v.optional(v.string()),
              titulo: v.optional(v.string()),
              anio: v.optional(v.string()),
            })
          )
        ),
        experienciaLaboral: v.optional(
          v.array(
            v.object({
              organizacion: v.optional(v.string()),
              cargo: v.optional(v.string()),
              periodo: v.optional(v.string()),
            })
          )
        ),
        cargosPoliticos: v.optional(
          v.array(
            v.object({
              cargo: v.optional(v.string()),
              cargo_nombre: v.optional(v.string()),
              periodo: v.optional(v.string()),
              entidad: v.optional(v.string()),
            })
          )
        ),
        idiomas: v.optional(v.array(v.string())),
      })
    ),
  })
    .index("by_deputyId", ["deputyId"])
    .index("by_politicianId", ["politicianId"]),

  // Pre-computed cross-deputy analytics (~244 rows)
  deputyAnalytics: defineTable({
    deputyId: v.number(),
    politicianId: v.optional(v.id("politicians")),
    loyaltyScore: v.number(), // 0-100
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
        month: v.string(), // "2024-01"
        totalVotes: v.number(),
        aFavor: v.number(),
        enContra: v.number(),
        abstencion: v.number(),
        pctAFavor: v.number(), // 0-100
      })
    ),
    attendanceDates: v.array(v.string()), // ["2024-01-15", ...]
    provinceAttendanceRank: v.optional(v.number()),
    provinceTotalDeputies: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_deputyId", ["deputyId"])
    .index("by_politicianId", ["politicianId"]),

  // Admin users
  users: defineTable({
    name: v.string(),
    email: v.string(),
    password: v.optional(v.string()), // bcrypt hash for credentials auth
    image: v.optional(v.string()),
    role: v.optional(v.string()), // "king_admin", "admin", "editor"
    provider: v.optional(v.string()), // "google", "credentials"
    providerId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_provider", ["provider", "providerId"]),
});
