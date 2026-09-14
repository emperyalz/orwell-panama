// =============================================================================
// User preferences — Convex template
// =============================================================================
//
// Per-user key/value store. Used by useMultiplayerSettings + the
// MultiplayerSettingsPanel for feature toggles.
//
// Copy this into your project's `convex/` directory:
//
//   cp node_modules/@quexopa/multiplayer-workshop/src/convex/templates/userPreferences.ts \
//      convex/userPreferences.ts
//
// Or run: `npx multiplayer-workshop init` (which copies all templates).
// =============================================================================

import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

/** Get all of the current user's prefs as a flat object. */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {};
    const rows = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q: any) => q.eq('userId', userId))
      .collect();
    const out: Record<string, any> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
});

/** Set a single key. */
export const setMine = mutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user_key', (q: any) =>
        q.eq('userId', userId).eq('key', args.key),
      )
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value, updatedAt: now });
    } else {
      await ctx.db.insert('userPreferences', {
        userId,
        key: args.key,
        value: args.value,
        updatedAt: now,
      });
    }
  },
});

/** Set multiple keys at once (one round-trip). */
export const setMineBulk = mutation({
  args: { entries: v.array(v.object({ key: v.string(), value: v.any() })) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    const now = Date.now();
    for (const { key, value } of args.entries) {
      const existing = await ctx.db
        .query('userPreferences')
        .withIndex('by_user_key', (q: any) =>
          q.eq('userId', userId).eq('key', key),
        )
        .first();
      if (existing) await ctx.db.patch(existing._id, { value, updatedAt: now });
      else await ctx.db.insert('userPreferences', { userId, key, value, updatedAt: now });
    }
  },
});
