import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query('comments')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .order('asc')
      .collect();
  },
});

export const add = mutation({
  args: {
    sessionId: v.string(),
    fieldPath: v.string(),
    text: v.string(),
    author: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('comments', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id('comments') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
