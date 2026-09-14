import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query('actionItems')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .order('asc')
      .collect();
  },
});

export const add = mutation({
  args: {
    sessionId: v.string(),
    owner: v.string(),
    text: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('actionItems', {
      sessionId: args.sessionId,
      owner: args.owner,
      text: args.text,
      createdBy: args.createdBy,
      done: false,
      createdAt: Date.now(),
    });
  },
});

export const toggle = mutation({
  args: { id: v.id('actionItems') },
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.patch(id, { done: !item.done });
  },
});

export const remove = mutation({
  args: { id: v.id('actionItems') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
