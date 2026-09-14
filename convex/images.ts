import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Generate a signed URL the browser can POST a file to.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Resolve a storage ID to a public URL for display.
export const getUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
