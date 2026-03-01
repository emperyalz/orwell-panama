import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Generate an upload URL for the client to upload a file to Convex storage. */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Get a serving URL for a stored file. */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/** Store a headshot for a politician. Updates politician record with storageId and serving URL. */
export const storeHeadshot = mutation({
  args: {
    politicianId: v.id("politicians"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Get the serving URL so the UI can display the new image immediately
    const url = await ctx.storage.getUrl(args.storageId);
    await ctx.db.patch(args.politicianId, {
      headshotStorageId: args.storageId,
      headshot: url ?? "",
      hasHeadshot: true,
      updatedAt: Date.now(),
    });
    return args.storageId;
  },
});

/** Store a logo for a party. Updates party record with storageId. */
export const storePartyLogo = mutation({
  args: {
    partyId: v.id("parties"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.partyId, {
      logoStorageId: args.storageId,
      updatedAt: Date.now(),
    });
    return args.storageId;
  },
});

/** Store an avatar for a social account. Updates account record with storageId. */
export const storeAvatar = mutation({
  args: {
    accountId: v.id("accounts"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      avatarStorageId: args.storageId,
      updatedAt: Date.now(),
    });
    return args.storageId;
  },
});
