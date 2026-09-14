// =============================================================================
// MULTIPLAYER WORKSHOP — sessions + versioning
// =============================================================================
// Copy this file to your `convex/sessions.ts` (or merge with your existing one
// if you already have a sessions module — none of these names collide with
// stock Convex behavior).
// =============================================================================

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const get = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query('sessions')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .first();
  },
});

export const ensure = mutation({
  args: {
    sessionId: v.string(),
    title: v.optional(v.string()),
    participants: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, title, participants }) => {
    const existing = await ctx.db
      .query('sessions')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('sessions', {
      sessionId,
      title: title ?? 'Workshop',
      meetingDate: new Date().toISOString().slice(0, 10),
      participants: participants ?? '',
      createdAt: Date.now(),
    });
  },
});

export const updateMeta = mutation({
  args: {
    sessionId: v.string(),
    title: v.optional(v.string()),
    meetingDate: v.optional(v.string()),
    participants: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .first();
    if (!session) return;
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.meetingDate !== undefined) patch.meetingDate = args.meetingDate;
    if (args.participants !== undefined) patch.participants = args.participants;
    await ctx.db.patch(session._id, patch);
  },
});

// =============================================================================
// VERSIONING — fork a session into v2/v3/etc snapshots
// =============================================================================

function parseVersion(sessionId: string): { base: string; version: number } {
  const m = sessionId.match(/^(.+)-v(\d+)$/);
  if (m) return { base: m[1], version: parseInt(m[2], 10) };
  return { base: sessionId, version: 1 };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// All versions that share a base sessionId, ascending.
export const listVersions = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const { base } = parseVersion(sessionId);
    const all = await ctx.db.query('sessions').collect();
    const re = new RegExp(`^${escapeRegex(base)}-v\\d+$`);
    const matching = all.filter((s) => s.sessionId === base || re.test(s.sessionId));
    return matching
      .map((s) => ({ ...s, _parsedVersion: parseVersion(s.sessionId).version }))
      .sort((a, b) => a._parsedVersion - b._parsedVersion);
  },
});

// Fork a new version: clones meta + fields + open notes + open actions + decisions.
// Resolved notes and completed actions are NOT carried — that's the point of forking.
export const createVersion = mutation({
  args: {
    sourceSessionId: v.string(),
    label: v.optional(v.string()),
    actor: v.string(),
  },
  handler: async (ctx, { sourceSessionId, label, actor }) => {
    const { base } = parseVersion(sourceSessionId);
    const all = await ctx.db.query('sessions').collect();
    const re = new RegExp(`^${escapeRegex(base)}-v\\d+$`);
    const matching = all.filter((s) => s.sessionId === base || re.test(s.sessionId));
    const maxVersion = matching.reduce((max, s) => {
      const v = parseVersion(s.sessionId).version;
      return v > max ? v : max;
    }, 0);
    const nextVersion = Math.max(1, maxVersion) + 1;
    const newSessionId = `${base}-v${nextVersion}`;
    const now = Date.now();

    const sourceSession = await ctx.db
      .query('sessions')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sourceSessionId))
      .first();

    await ctx.db.insert('sessions', {
      sessionId: newSessionId,
      title: sourceSession?.title || 'Workshop',
      meetingDate: new Date().toISOString().slice(0, 10),
      participants: sourceSession?.participants || '',
      createdAt: now,
      baseSessionId: base,
      version: nextVersion,
      createdFrom: sourceSessionId,
      label: label || `v${nextVersion} (forked by ${actor})`,
    });

    const fields = await ctx.db
      .query('fields')
      .withIndex('by_session_path', (q) => q.eq('sessionId', sourceSessionId))
      .collect();
    for (const f of fields) {
      await ctx.db.insert('fields', {
        sessionId: newSessionId,
        path: f.path,
        value: f.value,
        updatedBy: f.updatedBy,
        updatedAt: f.updatedAt,
      });
    }

    const notes = await ctx.db
      .query('stickyNotes')
      .withIndex('by_session', (q) => q.eq('sessionId', sourceSessionId))
      .collect();
    for (const n of notes.filter((nn) => !nn.resolved)) {
      await ctx.db.insert('stickyNotes', {
        sessionId: newSessionId,
        groupId: n.groupId,
        text: n.text,
        author: n.author,
        authorColor: n.authorColor,
        x: n.x,
        y: n.y,
        targetX: n.targetX,
        targetY: n.targetY,
        anchorSelector: n.anchorSelector,
        kind: n.kind,
        scope: n.scope,
        imageStorageId: n.imageStorageId,
        imageCaption: n.imageCaption,
        resolved: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    const actions = await ctx.db
      .query('actionItems')
      .withIndex('by_session', (q) => q.eq('sessionId', sourceSessionId))
      .collect();
    for (const a of actions.filter((aa) => !aa.done)) {
      await ctx.db.insert('actionItems', {
        sessionId: newSessionId,
        owner: a.owner,
        text: a.text,
        done: false,
        createdBy: a.createdBy,
        createdAt: now,
      });
    }

    const decisions = await ctx.db
      .query('decisions')
      .withIndex('by_session', (q) => q.eq('sessionId', sourceSessionId))
      .collect();
    for (const d of decisions) {
      await ctx.db.insert('decisions', {
        sessionId: newSessionId,
        topic: d.topic,
        decision: d.decision,
        loggedBy: d.loggedBy,
        loggedAt: d.loggedAt,
      });
    }

    return { newSessionId, version: nextVersion, base };
  },
});
