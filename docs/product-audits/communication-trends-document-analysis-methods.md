# Communication trends — analysis methods (source-of-truth audit)

Scope: document, with exact file:line references, how the live system ingests social posts, counts
them into buckets, attributes them to accounts, and applies date filters/limits. No source files are
modified by this step. Activity/format counts measure volume only; they do not measure tone or
ideology — nothing in the cited code computes sentiment, stance, or any ideological label.

## a) Ingest / collection (`convex/activity.ts`)

`ingest` (mutation, `convex/activity.ts:32`) accepts a batch of items and validates/dedupes each one
inside the loop at `convex/activity.ts:33`:

- **HTTPS scheme required**: `!/^https:\/\//.test(item.sourceUrl)` — rows whose `sourceUrl` is not an
  `https://` URL are skipped (`convex/activity.ts:33`).
- **`publishedAt` must be finite and not more than 1 day in the future**:
  `!Number.isFinite(item.publishedAt)||item.publishedAt>Date.now()+86400000` — non-finite timestamps,
  or timestamps more than `86400000` ms (1 day) ahead of "now", are skipped (`convex/activity.ts:33`).
- **Dedupe by `politicianId` + `sourceUrl`**: before inserting, the handler looks up an existing row via
  `ctx.db.query('activity').withIndex('by_politician_url',q=>q.eq('politicianId',item.politicianId).eq('sourceUrl',item.sourceUrl)).first()`
  (`convex/activity.ts:33`). If no match (`old` is falsy) a new row is inserted and `inserted` is
  incremented. If a match exists, the only mutation allowed is backfilling a missing image
  (`else if(item.imageUrl&&!old.imageUrl){await ctx.db.patch(old._id,{imageUrl:item.imageUrl,mediaKind:item.mediaKind})}`),
  so a row for the same politician+URL pair is never duplicated.

Each run's outcome is recorded by `logRun` (`convex/activity.ts:35`), which inserts a `collectionRuns`
document with `kind`, `inserted`, `errors`, and `checkedAt`.

## b) Counting activity into buckets (`convex/intelligence.ts`)

`archive` (query, `convex/intelligence.ts:4`) reads every stored post of `kind==='social'`
(`convex/intelligence.ts:6`) and builds two maps while iterating posts (`convex/intelligence.ts:13-25`):

- **Bucket key**: `[person, platform, month, format].join(':')` (`convex/intelligence.ts:18`), where:
  - `person` is `String(post.politicianId)` (`convex/intelligence.ts:15`).
  - `platform` is `post.platform||'unknown'` (`convex/intelligence.ts:15`).
  - `month` is the **UTC** calendar month, computed as
    `new Date(post.publishedAt).toISOString().slice(0,7)` (`convex/intelligence.ts:16`) — `toISOString()`
    always renders UTC, so the month boundary is UTC midnight, not local time.
  - `format` is derived purely from URL/media shape, not content: a regex match for TikTok
    `/video/`, Instagram `/reel/`/`/reels/`, or `/shorts/` yields `'short'`; otherwise
    `post.mediaKind==='video'`→`'video'`, `post.mediaKind==='image'`→`'image'`, else `'unspecified'`
    (`convex/intelligence.ts:17`).
  - Posts with a non-finite `publishedAt` are skipped before bucketing (`convex/intelligence.ts:14`).
- Each bucket accumulates a raw `count` and a `latest` timestamp (`convex/intelligence.ts:19-20`). This
  is strictly a count of matching rows — no sentiment, stance, or ideology signal is computed anywhere
  in this function.
- **Representative examples**: for the *same* `[person, platform, month, format]` key
  (`convex/intelligence.ts:23`), the handler keeps exactly one example post — the one with the latest
  `publishedAt` seen so far (`convex/intelligence.ts:24`) — so there is one representative example per
  person/platform/month/format bucket, bounded by people × platforms × months × formats
  (comment at `convex/intelligence.ts:21-22`).
- Buckets are returned sorted by month ascending (`convex/intelligence.ts:27`); examples are returned
  sorted by date descending (`convex/intelligence.ts:28`).

## c) Attributing posts to accounts (`convex/intelligence.ts:29`)

For each stored `accounts` document `a`, the handler computes:

- `identified = a.platform==='tiktok'||a.platform==='x_twitter'` — only these two platforms are treated
  as having a reliably extractable handle from the post URL.
- `handle = a.handle.replace(/^@/,'').toLowerCase()` — the stored handle normalized (leading `@`
  stripped, lowercased).
- `records` = posts filtered by `p.politicianId===a.politicianId && p.platform===a.platform`
  (person-platform scope) and, **only when `identified` is true**, further filtered so the post URL's
  extracted handle must match `handle`:
  - TikTok: `p.sourceUrl.match(/tiktok\.com\/@([^/?#]+)/i)`
  - X/Twitter: `p.sourceUrl.match(/(?:x|twitter)\.com\/([^/?#]+)\/status\//i)`
  - a post only counts for the account if the regex matches and the captured group (lowercased) equals
    `handle`.
- For all other platforms (`identified` is false), every post matching `politicianId` + `platform` is
  attributed to the account — i.e. attribution falls back to **person-platform scope**, not a verified
  handle match.
- The returned `scope` field is `'account'` when `identified` (handle-verified) or `'person-platform'`
  otherwise, so downstream consumers can distinguish verified-handle attribution from
  broader person+platform attribution (`convex/intelligence.ts:29`).

## d) Date filters and query limits

### Frontend month-range filter (`src/components/reference/IntelligenceWorkspace.tsx`)

- `availableMonths` is every bucket's `month`, sorted (`IntelligenceWorkspace.tsx:27`).
- The default visible window is the **last 12 months** ending at the latest available month: `endMonth`
  is the last available month, `startDate` is that month minus 11 months (UTC), and
  `defaultFrom = startDate.toISOString().slice(0,7)` (`IntelligenceWorkspace.tsx:28`).
- `effectiveFrom = from || defaultFrom` — an explicit user-selected `from` overrides the 12-month
  default (`IntelligenceWorkspace.tsx:28`).
- Chart `buckets` are filtered by: matching one of the selected cohort's person ids, optional platform
  equality, and the month range `(!effectiveFrom||b.month>=effectiveFrom)&&(!to||b.month<=to)`
  (`IntelligenceWorkspace.tsx:29`) — i.e. month comparisons are plain string comparisons on the
  `YYYY-MM` format, which sort correctly lexicographically.
- A continuous month series between `first` (`effectiveFrom` or the earliest available month) and
  `last` (`to` or the latest available month) is built by stepping one UTC month at a time
  (`IntelligenceWorkspace.tsx:32-33`), then each in-range bucket's count is added onto the matching
  month point (`IntelligenceWorkspace.tsx:34`). Months with no matching bucket remain at `0` rather than
  being omitted, so gaps in the archive show as zero, not as missing rows.

### Backend list/paginated limits (`convex/activity.ts`)

- `list` (query, `convex/activity.ts:16`) **caps** the requested limit at 50:
  `const limit=Math.min(args.limit||12,50)` (`convex/activity.ts:17`), defaulting to `12` when no
  `limit` arg is given.
- It then over-fetches candidate rows before diversity filtering:
  `const take=Math.max(limit*8,100)` (`convex/activity.ts:18`). Because of the `Math.max(...,100)`
  floor, `take` is **not always `limit*8`**: it is always at least `100`, it equals exactly `8×` the
  requested `limit` only when `limit>=13` (since `13*8=104>100`), and it is **strictly more than `8×`
  the limit when `limit<13`** (e.g. the default `limit=12` gives `take=100`, which is greater than
  `12*8=96`). That many rows are pulled **per kind** via `.take(take)` on both the `by_politician_date`
  branch (`convex/activity.ts:20`) and the `by_published` branch (`convex/activity.ts:21`), then passed
  through the `diverse()` de-duplication/diversity selector (`convex/activity.ts:7-14`) before being
  trimmed back down to `limit` results via `return diverse(enriched,limit,args.kind)`
  (`convex/activity.ts:28`).
- `paginated` (query, `convex/activity.ts:15`) uses standard Convex `paginationOptsValidator` /
  `.paginate(args.paginationOpts)` cursor pagination instead of a fixed `take`/`limit` cap — its page
  size is controlled entirely by the caller-supplied `paginationOpts`, not by the `list` limit/take
  logic above.

## Coverage limitations

- This audit covers exactly the four requested mechanisms in `convex/intelligence.ts` and
  `convex/activity.ts`, plus the frontend month-filter block in `IntelligenceWorkspace.tsx` cited above.
  It does not re-derive or audit upstream scraping/collection scripts that call `ingest`, nor any other
  query/mutation in either file not named above.
- "Format" and "activity count" are purely structural/volume signals (URL shape, media kind, row
  counts) as shown in the cited lines; the code contains no tone, stance, or ideology computation, so
  any such claim about these buckets would be unsourced from this codebase.
