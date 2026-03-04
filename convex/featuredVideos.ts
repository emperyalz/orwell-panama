/**
 * Featured Video Pipeline
 * ──────────────────────
 * Flow: social media URL → platform-specific API → raw MP4 bytes → Convex file storage → permanent URL
 *
 * Platform strategies:
 *  - TikTok    → tikwm.com public API (no auth, returns direct CDN URL + avatar)
 *  - X/Twitter → vxtwitter.com public API (no auth, returns direct video URL + avatar)
 *  - Instagram → self-hosted cobalt at https://cobalt-orwell.onrender.com (no auth required)
 *  - YouTube   → iframe embed only (no download needed, YouTube embeds work cleanly)
 *
 * Admin mutations allow adding/removing/reordering videos from the admin panel.
 */

import { v } from "convex/values";
import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ─── Query: return all stored video records (ordered by displayOrder) ──────────

export const list = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("featuredVideos").collect();
    return rows.sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  },
});

// ─── Internal mutation: upsert a video record ─────────────────────────────────

export const upsert = internalMutation({
  args: {
    sourceUrl: v.string(),
    platform: v.optional(v.string()),
    handle: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mp4Url: v.optional(v.string()),
    posterUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error"),
    ),
    errorMsg: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("featuredVideos")
      .withIndex("by_sourceUrl", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("featuredVideos", { ...args, createdAt: now, updatedAt: now });
  },
});

// ─── Admin mutation: add a new video URL (triggers download pipeline) ──────────

export const addVideo = mutation({
  args: {
    sourceUrl: v.string(),
    handle: v.optional(v.string()),
    title: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, { sourceUrl, handle, title, isFeatured }) => {
    const existing = await ctx.db
      .query("featuredVideos")
      .withIndex("by_sourceUrl", (q) => q.eq("sourceUrl", sourceUrl))
      .first();

    if (existing) {
      // If it errored, allow re-queue by resetting to pending
      if (existing.status === "error") {
        await ctx.db.patch(existing._id, {
          status: "pending",
          errorMsg: undefined,
          updatedAt: Date.now(),
        });
      }
      return existing._id;
    }

    // Assign next display order
    const all = await ctx.db.query("featuredVideos").collect();
    const maxOrder = all.reduce((m, r) => Math.max(m, r.displayOrder ?? 0), 0);

    return ctx.db.insert("featuredVideos", {
      sourceUrl,
      handle,
      title,
      isFeatured: isFeatured ?? false,
      isActive: true,
      displayOrder: maxOrder + 1,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// ─── Admin mutation: delete a video record ────────────────────────────────────

export const removeVideo = mutation({
  args: { id: v.id("featuredVideos") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// ─── Admin mutation: update metadata (isFeatured, showInVideos, displayOrder, handle) ─

export const updateVideo = mutation({
  args: {
    id: v.id("featuredVideos"),
    handle: v.optional(v.string()),
    title: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    showInVideos: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error"),
    )),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

// ─── Self-hosted cobalt instance ──────────────────────────────────────────────

const COBALT_URL = "https://cobalt-orwell.onrender.com";

// ─── Cobalt downloader (handles Instagram + fallback for other platforms) ──────

async function getCobaltDownloadUrl(sourceUrl: string): Promise<string> {
  const res = await fetch(`${COBALT_URL}/`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: sourceUrl }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) throw new Error(`cobalt_http_${res.status}`);

  const data = await res.json();

  if (data.status === "error") {
    throw new Error(`cobalt_error: ${data.error?.code ?? JSON.stringify(data.error)}`);
  }

  if (data.status === "redirect" || data.status === "tunnel") {
    if (!data.url) throw new Error("cobalt_no_url");
    return data.url;
  }

  if (data.status === "picker" && data.picker?.length > 0) {
    const video = data.picker.find((p: { type: string }) => p.type === "video") ?? data.picker[0];
    if (video?.url) return video.url;
  }

  throw new Error(`cobalt_unexpected_status: ${data.status}`);
}

// ─── Platform detector ────────────────────────────────────────────────────────

function detectPlatform(url: string): "tiktok" | "x" | "instagram" | "youtube" | "unknown" {
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("x.com") || url.includes("twitter.com")) return "x";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return "unknown";
}

// ─── Helper: download any image URL and store it in Convex ───────────────────

async function storeImage(
  ctx: { storage: { store: (blob: Blob) => Promise<string>; getUrl: (id: string) => Promise<string | null> } },
  imageUrl: string,
  referer: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": referer,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const storageId = await ctx.storage.store(blob);
    return (await ctx.storage.getUrl(storageId)) ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── Helper: fetch Instagram profile avatar and store bytes in Convex ─────────
// Tries multiple sources in order until one succeeds.

async function getInstagramAvatarAndStore(
  ctx: { storage: { store: (blob: Blob) => Promise<string>; getUrl: (id: string) => Promise<string | null> } },
  username: string,
): Promise<string | undefined> {
  const clean = username.replace(/^@/, "");
  if (!clean) return undefined;

  // ── Source 1: unavatar.io — server-side download avoids browser CORS issues ─
  const unavatarUrl = `https://unavatar.io/instagram/${clean}`;
  const stored1 = await storeImage(ctx, unavatarUrl, "https://www.instagram.com/");
  if (stored1) return stored1;

  // ── Source 2: Instagram profile page og:image → download bytes ─────────────
  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Twitterbot/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const html = await res.text();
      const ogImageMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogImageMatch?.[1]) {
        const stored2 = await storeImage(ctx, ogImageMatch[1], "https://www.instagram.com/");
        if (stored2) return stored2;
      }
    }
  } catch { /* continue */ }

  // ── Source 3: store nothing, let the browser try the unavatar.io URL directly ─
  // (returns the URL itself as a last resort — AvatarBadge onError fallback handles failure)
  return unavatarUrl;
}

// ─── Helper: extract Instagram metadata (og:image + handle) from page HTML ────

async function getInstagramMetadata(sourceUrl: string): Promise<{
  ogImageUrl?: string;
  handle?: string;
}> {
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Twitterbot/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return {};
    const html = await res.text();

    // ── og:image ──────────────────────────────────────────────────────────────
    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    // Decode HTML entities in the URL (&amp; → &, etc.) — Instagram embeds
    // raw HTML-encoded URLs in meta tag content attributes
    const ogImageUrl = ogImageMatch?.[1]?.replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

    // ── handle extraction (best-effort) ──────────────────────────────────────
    let handle: string | undefined;

    // 1. og:title may contain (@username): "Yo Mayer (@yomayer) • Instagram Reels"
    const ogTitleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const ogTitle = ogTitleMatch?.[1];
    if (ogTitle) {
      const parenHandle = ogTitle.match(/\(@([A-Za-z0-9_.]{1,30})\)/);
      if (parenHandle) handle = `@${parenHandle[1]}`;
    }

    // 2. JSON-LD alternateName: "alternateName":"@username"
    if (!handle) {
      const altName = html.match(/"alternateName"\s*:\s*"(@[A-Za-z0-9_.]{1,30})"/);
      if (altName) handle = altName[1];
    }

    // 3. "username":"value" in embedded JSON (filter out common false-positives)
    if (!handle) {
      const BAD = new Set(["instagram", "web", "meta", "facebook", "null", "undefined"]);
      const usernameField = html.match(/"username"\s*:\s*"([A-Za-z0-9_.]{2,30})"/);
      if (usernameField && !BAD.has(usernameField[1].toLowerCase())) {
        handle = `@${usernameField[1]}`;
      }
    }

    return { ogImageUrl, handle };
  } catch {
    return {};
  }
}

// ─── TikTok downloader via tikwm.com ─────────────────────────────────────────

async function getTikTokInfo(sourceUrl: string): Promise<{
  downloadUrl: string;
  thumbnailUrl?: string;
  avatarUrl?: string;
  handle?: string;
}> {
  const res = await fetch(
    `https://www.tikwm.com/api/?url=${encodeURIComponent(sourceUrl)}&hd=1`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://www.tikwm.com/",
      },
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!res.ok) throw new Error(`tikwm_http_${res.status}`);

  const data = await res.json();
  if (data.code !== 0) throw new Error(`tikwm_error: ${data.msg ?? "unknown"}`);

  const downloadUrl = data.data?.play ?? data.data?.hdplay;
  if (!downloadUrl) throw new Error("tikwm_no_url");

  return {
    downloadUrl,
    thumbnailUrl: data.data?.cover ?? data.data?.origin_cover,
    avatarUrl: data.data?.author?.avatar ?? data.data?.author?.avatarMedium,
    handle: data.data?.author?.unique_id
      ? `@${data.data.author.unique_id}`
      : undefined,
  };
}

// ─── X/Twitter downloader via vxtwitter.com ──────────────────────────────────

async function getTwitterDownloadUrl(sourceUrl: string): Promise<{
  videoUrl: string;
  posterUrl?: string;
  avatarUrl?: string;
  handle?: string;
}> {
  const tweetId =
    sourceUrl.match(/\/status\/(\d+)/)?.[1] ??
    sourceUrl.match(/\/i\/status\/(\d+)/)?.[1];

  if (!tweetId) throw new Error("twitter_no_id");

  const res = await fetch(`https://api.vxtwitter.com/i/status/${tweetId}`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "OrwellPanama/1.0 (+https://orwellpanama.com)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`vxtwitter_http_${res.status}`);

  const data = await res.json();

  const media = data.media_extended?.find(
    (m: { type: string }) => m.type === "video",
  );

  const videoUrl = media?.url ?? data.mediaURLs?.[0];
  if (!videoUrl) throw new Error("vxtwitter_no_url");

  // vxtwitter returns user_screen_name and user_profile_image_url
  const handle = data.user_screen_name ? `@${data.user_screen_name}` : undefined;
  const avatarUrl = data.user_profile_image_url ?? undefined;

  return { videoUrl, posterUrl: media?.thumbnail_url, avatarUrl, handle };
}

// ─── Internal action: download one video → Convex storage ─────────────────────

export const downloadOne = internalAction({
  args: {
    sourceUrl: v.string(),
    handle: v.optional(v.string()),
  },
  handler: async (ctx, { sourceUrl, handle }) => {
    const platform = detectPlatform(sourceUrl);

    // YouTube: mark as done without mp4Url — embed works great
    if (platform === "youtube") {
      await ctx.runMutation(internal.featuredVideos.upsert, {
        sourceUrl,
        handle,
        platform,
        status: "done",
      });
      return { success: true, platform, note: "embed_only" };
    }

    // Mark as processing so parallel calls skip this URL
    await ctx.runMutation(internal.featuredVideos.upsert, {
      sourceUrl,
      handle,
      platform,
      status: "processing",
    });

    try {
      let downloadUrl: string;
      let posterUrl: string | undefined;
      let avatarUrl: string | undefined;
      let resolvedHandle: string | undefined = handle;

      // ── Step 1: get the direct download URL + thumbnail + avatar ──────────
      if (platform === "tiktok") {
        const info = await getTikTokInfo(sourceUrl);
        downloadUrl = info.downloadUrl;
        resolvedHandle = handle ?? info.handle;
        // Store thumbnail in Convex (TikTok CDN is publicly accessible)
        if (info.thumbnailUrl) {
          posterUrl = await storeImage(ctx, info.thumbnailUrl, "https://www.tiktok.com/");
        }
        // Store avatar in Convex
        if (info.avatarUrl) {
          avatarUrl = await storeImage(ctx, info.avatarUrl, "https://www.tiktok.com/");
        }
      } else if (platform === "x") {
        const result = await getTwitterDownloadUrl(sourceUrl);
        downloadUrl = result.videoUrl;
        posterUrl = result.posterUrl; // pbs.twimg.com — works directly in browser
        resolvedHandle = handle ?? result.handle;
        // Store Twitter avatar in Convex (pbs.twimg URLs are stable)
        if (result.avatarUrl) {
          avatarUrl = await storeImage(ctx, result.avatarUrl, "https://x.com/");
        }
      } else if (platform === "instagram") {
        downloadUrl = await getCobaltDownloadUrl(sourceUrl);
        // Fetch og:image + handle from Instagram page (server-side, no auth needed for public posts)
        const igMeta = await getInstagramMetadata(sourceUrl);
        if (igMeta.ogImageUrl) {
          posterUrl = await storeImage(ctx, igMeta.ogImageUrl, "https://www.instagram.com/");
        }
        if (igMeta.handle && !handle) {
          resolvedHandle = igMeta.handle;
        }
        // Avatar: download + store in Convex (server-side bypasses Instagram's browser blocks)
        const igHandleClean = (resolvedHandle ?? handle ?? igMeta.handle)?.replace(/^@/, "");
        if (igHandleClean) {
          avatarUrl = await getInstagramAvatarAndStore(ctx, igHandleClean);
        }
      } else {
        throw new Error(`unsupported_platform: ${platform}`);
      }

      // ── Step 2: download the raw video bytes ──────────────────────────────
      const videoRes = await fetch(downloadUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer":
            platform === "tiktok"
              ? "https://www.tiktok.com/"
              : platform === "instagram"
                ? "https://www.instagram.com/"
                : "https://x.com/",
        },
        signal: AbortSignal.timeout(120000),
      });

      if (!videoRes.ok) throw new Error(`download_failed_${videoRes.status}`);

      const blob = await videoRes.blob();

      // ── Step 3: persist to Convex file storage ────────────────────────────
      const storageId = await ctx.storage.store(blob);
      const mp4Url = await ctx.storage.getUrl(storageId);

      await ctx.runMutation(internal.featuredVideos.upsert, {
        sourceUrl,
        handle: resolvedHandle,
        platform,
        avatarUrl,
        storageId,
        mp4Url: mp4Url ?? "",
        posterUrl,
        status: "done",
        errorMsg: undefined, // clear any previous error message
      });

      return { success: true, mp4Url };
    } catch (err) {
      await ctx.runMutation(internal.featuredVideos.upsert, {
        sourceUrl,
        status: "error",
        errorMsg: String(err),
      });
      console.error(`[featuredVideos] failed to download ${sourceUrl}:`, err);
      return { success: false, error: String(err) };
    }
  },
});

// ─── Public action: trigger download pipeline for pending URLs ─────────────────

export const processAll = action({
  args: {
    videos: v.array(
      v.object({
        url: v.string(),
        handle: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { videos }) => {
    const existing: Array<{ sourceUrl: string; status: string }> =
      await ctx.runQuery(api.featuredVideos.list);

    let scheduled = 0;

    for (const video of videos) {
      const record = existing.find((r) => r.sourceUrl === video.url);
      if (record?.status === "done" || record?.status === "processing") continue;

      await ctx.scheduler.runAfter(0, internal.featuredVideos.downloadOne, {
        sourceUrl: video.url,
        handle: video.handle,
      });
      scheduled++;
    }

    return { scheduled };
  },
});

// ─── Avatar upload helpers (for manual uploads via admin panel or CLI script) ──

/** Step 1: Get a short-lived upload URL from Convex storage */
export const generateAvatarUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2: After uploading a file to the upload URL, call this to save it as the avatar */
export const patchAvatarFromStorageId = mutation({
  args: {
    sourceUrl: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { sourceUrl, storageId }) => {
    const existing = await ctx.db
      .query("featuredVideos")
      .withIndex("by_sourceUrl", (q) => q.eq("sourceUrl", sourceUrl))
      .first();
    if (!existing) throw new Error(`No record found for ${sourceUrl}`);
    const avatarUrl = await ctx.storage.getUrl(storageId);
    if (!avatarUrl) throw new Error("Storage URL not available");
    await ctx.db.patch(existing._id, { avatarUrl, updatedAt: Date.now() });
    return avatarUrl;
  },
});

// ─── Admin action: trigger download for a single URL ─────────────────────────

export const processOne = action({
  args: {
    sourceUrl: v.string(),
    handle: v.optional(v.string()),
  },
  handler: async (ctx, { sourceUrl, handle }) => {
    await ctx.scheduler.runAfter(0, internal.featuredVideos.downloadOne, {
      sourceUrl,
      handle,
    });
    return { scheduled: 1 };
  },
});

// ─── Admin actions: reset / refresh helpers ───────────────────────────────────

export const resetEmbedOnly = action({
  args: {},
  handler: async (ctx) => {
    const all: Array<{ _id: string; sourceUrl: string; status: string; mp4Url?: string }> =
      await ctx.runQuery(api.featuredVideos.list);
    const embedOnly = all.filter((r) => r.status === "done" && !r.mp4Url);
    for (const r of embedOnly) {
      await ctx.runMutation(internal.featuredVideos.upsert, { sourceUrl: r.sourceUrl, status: "pending" });
    }
    return { reset: embedOnly.length };
  },
});

export const refreshThumbnails = action({
  args: {},
  handler: async (ctx) => {
    const all: Array<{
      _id: string;
      sourceUrl: string;
      status: string;
      platform?: string;
      mp4Url?: string;
      posterUrl?: string;
    }> = await ctx.runQuery(api.featuredVideos.list);

    const missing = all.filter((r) => r.status === "done" && r.mp4Url && !r.posterUrl);
    let updated = 0;

    for (const r of missing) {
      let posterUrl: string | undefined;
      const platform = r.platform ?? detectPlatform(r.sourceUrl);

      try {
        if (platform === "instagram") {
          const igMeta = await getInstagramMetadata(r.sourceUrl);
          if (igMeta.ogImageUrl) posterUrl = await storeImage(ctx, igMeta.ogImageUrl, "https://www.instagram.com/");
        } else if (platform === "tiktok") {
          const info = await getTikTokInfo(r.sourceUrl);
          if (info.thumbnailUrl) posterUrl = await storeImage(ctx, info.thumbnailUrl, "https://www.tiktok.com/");
        } else if (platform === "twitter") {
          const result = await getTwitterDownloadUrl(r.sourceUrl);
          posterUrl = result.posterUrl;
        }
      } catch (e) {
        console.warn(`[refreshThumbnails] failed for ${r.sourceUrl}:`, e);
        continue;
      }

      if (posterUrl) {
        await ctx.runMutation(internal.featuredVideos.upsert, { sourceUrl: r.sourceUrl, status: "done", posterUrl });
        updated++;
      }
    }

    return { updated, checked: missing.length };
  },
});

export const resetErrors = action({
  args: {},
  handler: async (ctx) => {
    const all: Array<{ _id: string; sourceUrl: string; status: string }> =
      await ctx.runQuery(api.featuredVideos.list);
    const errored = all.filter((r) => r.status === "error");
    for (const r of errored) {
      await ctx.runMutation(internal.featuredVideos.upsert, { sourceUrl: r.sourceUrl, status: "pending", errorMsg: undefined });
    }
    return { reset: errored.length };
  },
});

// ─── Admin action: backfill handles + avatars for existing records ─────────────
// Fetches real @handles and profile pictures from TikTok (tikwm) and X (vxtwitter).
// Instagram avatar fetching is blocked without auth — those stay as gradient initials.

export const refreshAvatarsAndHandles = action({
  args: {
    // Set forceInstagram=true to re-download Instagram avatars even if one is already stored
    forceInstagram: v.optional(v.boolean()),
  },
  handler: async (ctx, { forceInstagram = false }) => {
    const all: Array<{
      _id: string;
      sourceUrl: string;
      status: string;
      platform?: string;
      handle?: string;
      avatarUrl?: string;
    }> = await ctx.runQuery(api.featuredVideos.list);

    const GENERIC_HANDLES = ["@X", "@TikTok", "@Instagram", "@YouTube", "@Facebook", "@x", "@tiktok"];
    let updated = 0;

    for (const r of all) {
      if (r.status !== "done") continue;

      // Normalize legacy "twitter" platform value to "x"
      const platform = (r.platform === "twitter" ? "x" : r.platform) ?? detectPlatform(r.sourceUrl);
      const hasRealHandle = r.handle && !GENERIC_HANDLES.includes(r.handle) && r.handle !== platform;
      const hasAvatar = !!r.avatarUrl;

      // For Instagram with forceInstagram, always re-download avatar
      const isInstagram = platform === "instagram";
      if (hasRealHandle && hasAvatar && !(isInstagram && forceInstagram)) continue;

      try {
        if (platform === "tiktok") {
          const info = await getTikTokInfo(r.sourceUrl);
          const newHandle = (hasRealHandle ? r.handle : info.handle) ?? r.handle;
          let newAvatarUrl = r.avatarUrl;
          if (!hasAvatar && info.avatarUrl) {
            newAvatarUrl = await storeImage(ctx, info.avatarUrl, "https://www.tiktok.com/");
          }
          await ctx.runMutation(internal.featuredVideos.upsert, {
            sourceUrl: r.sourceUrl,
            status: "done",
            handle: newHandle,
            avatarUrl: newAvatarUrl,
          });
          updated++;
        } else if (platform === "x") {
          const result = await getTwitterDownloadUrl(r.sourceUrl);
          const newHandle = (hasRealHandle ? r.handle : result.handle) ?? r.handle;
          let newAvatarUrl = r.avatarUrl;
          if (!hasAvatar && result.avatarUrl) {
            newAvatarUrl = await storeImage(ctx, result.avatarUrl, "https://x.com/");
          }
          await ctx.runMutation(internal.featuredVideos.upsert, {
            sourceUrl: r.sourceUrl,
            status: "done",
            handle: newHandle,
            avatarUrl: newAvatarUrl,
          });
          updated++;
        }
        // Instagram: download + store avatar bytes in Convex (bypasses browser-side IG blocks)
        else if (platform === "instagram") {
          let newHandle = r.handle;
          // Try to extract real handle if missing
          if (!hasRealHandle) {
            const igMeta = await getInstagramMetadata(r.sourceUrl);
            if (igMeta.handle) newHandle = igMeta.handle;
          }
          // Download and store avatar bytes in Convex so the URL is guaranteed to work
          const cleanHandle = newHandle?.replace(/^@/, "");
          const newAvatarUrl = cleanHandle
            ? await getInstagramAvatarAndStore(ctx, cleanHandle)
            : r.avatarUrl;
          // Only write if something changed
          if (newHandle !== r.handle || newAvatarUrl !== r.avatarUrl) {
            await ctx.runMutation(internal.featuredVideos.upsert, {
              sourceUrl: r.sourceUrl,
              status: "done",
              handle: newHandle,
              avatarUrl: newAvatarUrl,
            });
            updated++;
          }
        }
      } catch (e) {
        console.warn(`[refreshAvatarsAndHandles] failed for ${r.sourceUrl}:`, e);
      }
    }

    return { updated, checked: all.filter((r) => r.status === "done").length };
  },
});
