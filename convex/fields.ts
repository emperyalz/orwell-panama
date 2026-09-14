import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const rows = await ctx.db
      .query('fields')
      .withIndex('by_session_path', (q) => q.eq('sessionId', sessionId))
      .collect();
    return rows;
  },
});

export const set = mutation({
  args: {
    sessionId: v.string(),
    path: v.string(),
    value: v.any(),
    updatedBy: v.string(),
  },
  handler: async (ctx, { sessionId, path, value, updatedBy }) => {
    const existing = await ctx.db
      .query('fields')
      .withIndex('by_session_path', (q) =>
        q.eq('sessionId', sessionId).eq('path', path),
      )
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedBy, updatedAt: now });
    } else {
      await ctx.db.insert('fields', { sessionId, path, value, updatedBy, updatedAt: now });
    }
  },
});
