import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const PRESENCE_TIMEOUT = 30_000; // 30s — anyone older is offline

export const heartbeat = mutation({
  args: {
    sessionId: v.string(),
    editorId: v.string(),
    name: v.string(),
    color: v.string(),
    focusedField: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_session_editor', (q) =>
        q.eq('sessionId', args.sessionId).eq('editorId', args.editorId),
      )
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        color: args.color,
        focusedField: args.focusedField,
        lastSeen: now,
      });
    } else {
      await ctx.db.insert('presence', {
        sessionId: args.sessionId,
        editorId: args.editorId,
        name: args.name,
        color: args.color,
        focusedField: args.focusedField,
        lastSeen: now,
      });
    }
  },
});

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const rows = await ctx.db
      .query('presence')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .collect();
    const cutoff = Date.now() - PRESENCE_TIMEOUT;
    return rows.filter((r) => r.lastSeen > cutoff);
  },
});

export const cleanup = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const cutoff = Date.now() - PRESENCE_TIMEOUT * 4;
    const stale = await ctx.db
      .query('presence')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .collect();
    for (const r of stale) {
      if (r.lastSeen < cutoff) await ctx.db.delete(r._id);
    }
  },
});
