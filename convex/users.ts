import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get user by email (public profile, no password). */
export const getUser = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) return null;

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      provider: user.provider,
      createdAt: user.createdAt,
    };
  },
});

/** Get user with password hash for credentials auth. */
export const getUserWithPassword = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) return null;

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      password: user.password,
      image: user.image,
      role: user.role,
      provider: user.provider,
    };
  },
});

/** Get user by OAuth provider. */
export const getUserByProvider = query({
  args: { provider: v.string(), providerId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_provider", (q) =>
        q.eq("provider", args.provider).eq("providerId", args.providerId)
      )
      .first();

    if (!user) return null;

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      provider: user.provider,
    };
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Create or update user (OAuth sign-in or registration). */
export const saveUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
    image: v.optional(v.string()),
    role: v.optional(v.string()),
    provider: v.optional(v.string()),
    providerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        image: args.image ?? existing.image,
        provider: args.provider ?? existing.provider,
        providerId: args.providerId ?? existing.providerId,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      password: args.password,
      image: args.image,
      role: args.role ?? "admin",
      provider: args.provider,
      providerId: args.providerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Seed the King Admin user (run once during setup). */
export const seedAdmin = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(), // Pre-hashed bcrypt
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      // Update existing to king_admin
      await ctx.db.patch(existing._id, {
        name: args.name,
        password: args.password,
        role: "king_admin",
        provider: "credentials",
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      password: args.password,
      role: "king_admin",
      provider: "credentials",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
