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
