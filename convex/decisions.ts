import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query('decisions')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .order('asc')
      .collect();
  },
});

export const add = mutation({
  args: {
    sessionId: v.string(),
    topic: v.string(),
    decision: v.string(),
    loggedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('decisions', {
      sessionId: args.sessionId,
      topic: args.topic,
      decision: args.decision,
      loggedBy: args.loggedBy,
      loggedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id('decisions') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
