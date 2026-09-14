import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// =============================================================================
// MULTI-IMAGE MODEL
// =============================================================================
// Each note has:
//   • imageStorageId    → image #0 (primary)         + imageAnnotations
//   • additionalImages  → images #1, #2, ...         + per-image annotations
//
// `imageIndex` arguments use:
//   0  → primary (imageStorageId / imageAnnotations)
//   1+ → additionalImages[imageIndex - 1]
// =============================================================================

const annotationValidator = v.object({
  x: v.number(),
  y: v.number(),
  text: v.string(),
  author: v.string(),
  color: v.string(),
  createdAt: v.number(),
});

const noteScopeValidator = v.union(v.literal('page'), v.literal('site'));

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query('stickyNotes')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .order('asc')
      .collect();
  },
});

// Fetch notes across multiple sessions at once — used by StickyNotesProvider
// when `relatedSessions` is set, so a workspace-wide notes navigator can
// show notes from every page in the workspace without N separate queries.
// Returns a flat array; consumers group by sessionId on the client.
export const listMulti = query({
  args: { sessionIds: v.array(v.string()) },
  handler: async (ctx, { sessionIds }) => {
    if (sessionIds.length === 0) return [];
    const out: any[] = [];
    for (const sid of sessionIds) {
      const rows = await ctx.db
        .query('stickyNotes')
        .withIndex('by_session', (q) => q.eq('sessionId', sid))
        .order('asc')
        .collect();
      for (const r of rows) out.push(r);
    }
    return out;
  },
});

export const listForPage = query({
  args: {
    sessionId: v.string(),
    siteSessionIds: v.array(v.string()),
  },
  handler: async (ctx, { sessionId, siteSessionIds }) => {
    const ids = Array.from(new Set([sessionId, ...siteSessionIds])).filter(Boolean);
    const out: any[] = [];
    for (const sid of ids) {
      const rows = await ctx.db
        .query('stickyNotes')
        .withIndex('by_session', (q) => q.eq('sessionId', sid))
        .order('asc')
        .collect();
      for (const row of rows) {
        if (row.sessionId === sessionId || row.scope === 'site') out.push(row);
      }
    }
    return out.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// Shared with the schema — the structured anchor fingerprint (v1.0).
const anchorFingerprintValidator = v.object({
  textHash: v.optional(v.string()),
  tagPath: v.optional(v.array(v.string())),
  classChain: v.optional(v.array(v.array(v.string()))),
  selfId: v.optional(v.string()),
  ancestorIds: v.optional(v.array(v.string())),
  landmarkSelector: v.optional(v.string()),
  landmarkDx: v.optional(v.number()),
  landmarkDy: v.optional(v.number()),
  initialRect: v.optional(
    v.object({ x: v.number(), y: v.number(), w: v.number(), h: v.number() }),
  ),
  url: v.optional(v.string()),
});

export const add = mutation({
  args: {
    sessionId: v.string(),
    text: v.string(),
    author: v.string(),
    authorColor: v.string(),
    x: v.number(),
    y: v.number(),
    targetX: v.optional(v.number()),
    targetY: v.optional(v.number()),
    anchorSelector: v.optional(v.string()),
    anchorFingerprint: v.optional(anchorFingerprintValidator),
    groupId: v.optional(v.string()),
    kind: v.optional(v.union(v.literal('aimed'), v.literal('general'))),
    scope: v.optional(noteScopeValidator),
    imageStorageId: v.optional(v.id('_storage')),
    imageCaption: v.optional(v.string()),
    imageMime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('stickyNotes', {
      ...args,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('stickyNotes'),
    text: v.optional(v.string()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    targetX: v.optional(v.number()),
    targetY: v.optional(v.number()),
    anchorSelector: v.optional(v.string()),
    anchorFingerprint: v.optional(anchorFingerprintValidator),
    resolved: v.optional(v.boolean()),
    kind: v.optional(v.union(v.literal('aimed'), v.literal('general'))),
    scope: v.optional(noteScopeValidator),
    imageStorageId: v.optional(v.id('_storage')),
    imageCaption: v.optional(v.string()),
    imageMime: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const cleaned: any = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) cleaned[k] = v;
    }
    await ctx.db.patch(id, cleaned);
  },
});

export const remove = mutation({
  args: { id: v.id('stickyNotes') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const clearAim = mutation({
  args: { id: v.id('stickyNotes') },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      targetX: undefined,
      targetY: undefined,
      anchorSelector: undefined,
      kind: 'general',
      scope: 'page',
      updatedAt: Date.now(),
    });
  },
});

export const duplicate = mutation({
  args: {
    sourceId: v.id('stickyNotes'),
    x: v.number(),
    y: v.number(),
    anchorSelector: v.optional(v.string()),
    // The duplicate lands at a NEW aim point — the client passes the fresh
    // fingerprint captured at the placement click (optional: old clients omit it).
    anchorFingerprint: v.optional(anchorFingerprintValidator),
    actor: v.string(),
    actorColor: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error('Source note not found');
    let groupId = source.groupId;
    if (!groupId) {
      groupId = `g-${source._id}`;
      await ctx.db.patch(source._id, { groupId });
    }
    const now = Date.now();
    return await ctx.db.insert('stickyNotes', {
      sessionId: source.sessionId,
      text: source.text,
      author: args.actor,
      authorColor: args.actorColor,
      x: args.x,
      y: args.y,
      targetX: args.x,
      targetY: args.y,
      anchorSelector: args.anchorSelector,
      anchorFingerprint: args.anchorFingerprint,
      groupId,
      scope: source.scope,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateGroup = mutation({
  args: {
    groupId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { groupId, text }) => {
    const notes = await ctx.db
      .query('stickyNotes')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect();
    const now = Date.now();
    for (const n of notes) await ctx.db.patch(n._id, { text, updatedAt: now });
  },
});

// =============================================================================
// IMAGES
// =============================================================================

// Add an attachment (image or PDF) to a note. If the note has no primary
// attachment yet, this becomes the primary; otherwise it's appended to
// additionalImages. The optional `mime` arg lets the renderer distinguish
// images from PDFs (legacy notes with no mime are assumed image).
export const addImage = mutation({
  args: {
    id: v.id('stickyNotes'),
    storageId: v.id('_storage'),
    caption: v.optional(v.string()),
    mime: v.optional(v.string()),
  },
  handler: async (ctx, { id, storageId, caption, mime }) => {
    const note = await ctx.db.get(id);
    if (!note) throw new Error('Note not found');
    const now = Date.now();
    if (!note.imageStorageId) {
      await ctx.db.patch(id, {
        imageStorageId: storageId,
        imageCaption: caption,
        imageMime: mime,
        updatedAt: now,
      });
    } else {
      const existing = note.additionalImages || [];
      await ctx.db.patch(id, {
        additionalImages: [...existing, { storageId, caption, mime, annotations: [] }],
        updatedAt: now,
      });
    }
  },
});

// Remove an image at a given index. Index 0 = primary, 1+ = additional.
// If primary is removed, additionalImages[0] is promoted to primary.
export const removeImage = mutation({
  args: { id: v.id('stickyNotes'), imageIndex: v.number() },
  handler: async (ctx, { id, imageIndex }) => {
    const note = await ctx.db.get(id);
    if (!note) throw new Error('Note not found');
    const additional = note.additionalImages || [];
    const now = Date.now();

    if (imageIndex === 0) {
      // Removing primary — promote first additional, if any
      if (additional.length > 0) {
        const [promoted, ...rest] = additional;
        await ctx.db.patch(id, {
          imageStorageId: promoted.storageId,
          imageCaption: promoted.caption,
          imageAnnotations: promoted.annotations,
          additionalImages: rest,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(id, {
          imageStorageId: undefined,
          imageCaption: undefined,
          imageAnnotations: undefined,
          updatedAt: now,
        });
      }
    } else {
      const additionalIdx = imageIndex - 1;
      if (additionalIdx < 0 || additionalIdx >= additional.length) {
        throw new Error('Image index out of range');
      }
      const next = additional.filter((_, i) => i !== additionalIdx);
      await ctx.db.patch(id, { additionalImages: next, updatedAt: now });
    }
  },
});

// Set the caption on a specific image
export const setImageCaption = mutation({
  args: {
    id: v.id('stickyNotes'),
    imageIndex: v.number(),
    caption: v.string(),
  },
  handler: async (ctx, { id, imageIndex, caption }) => {
    const note = await ctx.db.get(id);
    if (!note) throw new Error('Note not found');
    const now = Date.now();
    if (imageIndex === 0) {
      await ctx.db.patch(id, { imageCaption: caption, updatedAt: now });
    } else {
      const additional = note.additionalImages || [];
      const additionalIdx = imageIndex - 1;
      if (additionalIdx < 0 || additionalIdx >= additional.length) {
        throw new Error('Image index out of range');
      }
      const next = additional.map((img, i) =>
        i === additionalIdx ? { ...img, caption } : img,
      );
      await ctx.db.patch(id, { additionalImages: next, updatedAt: now });
    }
  },
});

// Clear ALL images from a note (primary + all additional)
export const clearImage = mutation({
  args: { id: v.id('stickyNotes') },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      imageStorageId: undefined,
      imageCaption: undefined,
      imageAnnotations: undefined,
      additionalImages: undefined,
      updatedAt: Date.now(),
    });
  },
});

// =============================================================================
// IMAGE ANNOTATIONS (per-image pins)
// =============================================================================
// `imageIndex` defaults to 0 (primary image) for backwards compatibility with
// the original single-image API.

export const addImageAnnotation = mutation({
  args: {
    noteId: v.id('stickyNotes'),
    imageIndex: v.optional(v.number()),
    x: v.number(),
    y: v.number(),
    text: v.string(),
    author: v.string(),
    color: v.string(),
  },
  handler: async (ctx, { noteId, imageIndex, x, y, text, author, color }) => {
    const note = await ctx.db.get(noteId);
    if (!note) throw new Error('Note not found');
    const idx = imageIndex ?? 0;
    const newAnnotation = { x, y, text, author, color, createdAt: Date.now() };
    const now = Date.now();

    if (idx === 0) {
      const existing = note.imageAnnotations || [];
      await ctx.db.patch(noteId, {
        imageAnnotations: [...existing, newAnnotation],
        updatedAt: now,
      });
    } else {
      const additional = note.additionalImages || [];
      const additionalIdx = idx - 1;
      if (additionalIdx < 0 || additionalIdx >= additional.length) {
        throw new Error('Image index out of range');
      }
      const next = additional.map((img, i) =>
        i === additionalIdx
          ? { ...img, annotations: [...(img.annotations || []), newAnnotation] }
          : img,
      );
      await ctx.db.patch(noteId, { additionalImages: next, updatedAt: now });
    }
  },
});

export const removeImageAnnotation = mutation({
  args: {
    noteId: v.id('stickyNotes'),
    imageIndex: v.optional(v.number()),
    index: v.number(),
  },
  handler: async (ctx, { noteId, imageIndex, index }) => {
    const note = await ctx.db.get(noteId);
    if (!note) throw new Error('Note not found');
    const idx = imageIndex ?? 0;
    const now = Date.now();

    if (idx === 0) {
      const existing = note.imageAnnotations || [];
      const next = existing.filter((_, i) => i !== index);
      await ctx.db.patch(noteId, { imageAnnotations: next, updatedAt: now });
    } else {
      const additional = note.additionalImages || [];
      const additionalIdx = idx - 1;
      if (additionalIdx < 0 || additionalIdx >= additional.length) {
        throw new Error('Image index out of range');
      }
      const next = additional.map((img, i) => {
        if (i !== additionalIdx) return img;
        const annos = (img.annotations || []).filter((_, j) => j !== index);
        return { ...img, annotations: annos };
      });
      await ctx.db.patch(noteId, { additionalImages: next, updatedAt: now });
    }
  },
});

export const updateImageAnnotation = mutation({
  args: {
    noteId: v.id('stickyNotes'),
    imageIndex: v.optional(v.number()),
    index: v.number(),
    text: v.string(),
  },
  handler: async (ctx, { noteId, imageIndex, index, text }) => {
    const note = await ctx.db.get(noteId);
    if (!note) throw new Error('Note not found');
    const idx = imageIndex ?? 0;
    const now = Date.now();

    if (idx === 0) {
      const existing = note.imageAnnotations || [];
      const next = existing.map((a, i) => (i === index ? { ...a, text } : a));
      await ctx.db.patch(noteId, { imageAnnotations: next, updatedAt: now });
    } else {
      const additional = note.additionalImages || [];
      const additionalIdx = idx - 1;
      if (additionalIdx < 0 || additionalIdx >= additional.length) {
        throw new Error('Image index out of range');
      }
      const next = additional.map((img, i) => {
        if (i !== additionalIdx) return img;
        const annos = (img.annotations || []).map((a, j) =>
          j === index ? { ...a, text } : a,
        );
        return { ...img, annotations: annos };
      });
      await ctx.db.patch(noteId, { additionalImages: next, updatedAt: now });
    }
  },
});
