// =============================================================================
// MULTIPLAYER WORKSHOP — Convex schema fragment
// =============================================================================
//
// Spread this into your `convex/schema.ts`:
//
//   import { defineSchema } from 'convex/server';
//   import { multiplayerTables } from './multiplayerSchema';
//
//   export default defineSchema({
//     ...multiplayerTables,
//     // ...your own tables
//   });
//
// Or if you don't have any other tables, just re-export the whole schema:
//
//   export { default } from './multiplayerSchema';
// =============================================================================

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const multiplayerTables = {
  // One row per session (URL slug). Stores meta + version pointers.
  sessions: defineTable({
    sessionId: v.string(),
    title: v.string(),
    meetingDate: v.string(),
    participants: v.string(),
    createdAt: v.number(),
    // Versioning (optional for backwards compat with pre-v3 sessions)
    baseSessionId: v.optional(v.string()),
    version: v.optional(v.number()),
    createdFrom: v.optional(v.string()),
    label: v.optional(v.string()),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_baseSessionId', ['baseSessionId']),

  // Per-field collaborative values, keyed by sessionId + path.
  fields: defineTable({
    sessionId: v.string(),
    path: v.string(),
    value: v.any(),
    updatedBy: v.string(),
    updatedAt: v.number(),
  }).index('by_session_path', ['sessionId', 'path']),

  // Live presence — heartbeat per editor. Last 30s = online.
  presence: defineTable({
    sessionId: v.string(),
    editorId: v.string(),
    name: v.string(),
    color: v.string(),
    focusedField: v.optional(v.string()),
    lastSeen: v.number(),
  })
    .index('by_session_editor', ['sessionId', 'editorId'])
    .index('by_session', ['sessionId']),

  // Action items
  actionItems: defineTable({
    sessionId: v.string(),
    owner: v.string(),
    text: v.string(),
    done: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index('by_session', ['sessionId']),

  // Decisions log
  decisions: defineTable({
    sessionId: v.string(),
    topic: v.string(),
    decision: v.string(),
    loggedBy: v.string(),
    loggedAt: v.number(),
  }).index('by_session', ['sessionId']),

  // Inline comments — attach to a field path or section anchor
  comments: defineTable({
    sessionId: v.string(),
    fieldPath: v.string(),
    text: v.string(),
    author: v.string(),
    color: v.string(),
    createdAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_field', ['sessionId', 'fieldPath']),

  // Sticky notes — placed anywhere, optional arrow to a point or anchor,
  // optional groupId for duplicate-syncing, optional image attachment.
  stickyNotes: defineTable({
    sessionId: v.string(),
    groupId: v.optional(v.string()),
    text: v.string(),
    author: v.string(),
    authorColor: v.string(),
    x: v.number(),
    y: v.number(),
    targetX: v.optional(v.number()),
    targetY: v.optional(v.number()),
    anchorSelector: v.optional(v.string()),
    // v1.0 — structured anchor fingerprint (text hash, tag path, landmark
    // offsets…) so aimed notes can be re-located after the DOM changes. See
    // the package's src/lib/anchor. All-optional so old rows stay valid.
    anchorFingerprint: v.optional(
      v.object({
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
      }),
    ),
    resolved: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // 'aimed' (default) draws an arrow to a target; 'general' floats free.
    kind: v.optional(v.union(v.literal('aimed'), v.literal('general'))),
    // General note scope: 'page' (default/back-compat) stays on its session;
    // 'site' is intentionally surfaced on sibling page sessions by listForPage.
    scope: v.optional(v.union(v.literal('page'), v.literal('site'))),
    // Primary attachment (uses Convex's built-in _storage). Historically
    // image-only — as of v0.2.7 also accepts application/pdf. `imageMime`
    // tells the renderer how to display it. Legacy notes without imageMime
    // are assumed to be images (backwards compat).
    // imageStorageId is attachment #0 — its annotations live on imageAnnotations.
    imageStorageId: v.optional(v.id('_storage')),
    imageCaption: v.optional(v.string()),
    imageMime: v.optional(v.string()),
    // Annotation pins on the primary image (xy% + text).
    imageAnnotations: v.optional(
      v.array(
        v.object({
          x: v.number(),
          y: v.number(),
          text: v.string(),
          author: v.string(),
          color: v.string(),
          createdAt: v.number(),
        }),
      ),
    ),
    // Additional attachments (images and PDFs at indexes #1+). Annotations
    // are image-only — PDFs ignore the annotations array.
    additionalImages: v.optional(
      v.array(
        v.object({
          storageId: v.id('_storage'),
          caption: v.optional(v.string()),
          mime: v.optional(v.string()),
          annotations: v.optional(
            v.array(
              v.object({
                x: v.number(),
                y: v.number(),
                text: v.string(),
                author: v.string(),
                color: v.string(),
                createdAt: v.number(),
              }),
            ),
          ),
        }),
      ),
    ),
  })
    .index('by_session', ['sessionId'])
    .index('by_group', ['groupId']),

  // ─── User preferences (Multiplayer feature toggles + host extensions) ───
  // One row per (userId, key). Cheap key/value store keyed by auth user.
  // Required by useMultiplayerSettings + MultiplayerSettingsPanel.
  // Host needs an authenticated `users` table — assumed via @convex-dev/auth.
  userPreferences: defineTable({
    userId: v.id('users'),
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_key', ['userId', 'key']),
};

// Full default schema — use this if multiplayer is the only thing in your DB.
export default defineSchema(multiplayerTables);
