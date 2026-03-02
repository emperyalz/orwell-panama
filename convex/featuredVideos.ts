/**
 * Featured Video Pipeline
 * ──────────────────────
 * Flow: social media URL → platform-specific API → raw MP4 bytes → Convex file storage → permanent URL
 *
 * Platform strategies:
 *  - TikTok    → tikwm.com public API (no auth, returns direct CDN URL)
 *  - X/Twitter → vxtwitter.com public API (no auth, returns direct video URL)
 *  - Instagram → self-hosted cobalt at https://cobalt-orwell.onrender.com (no auth required)
 *  - YouTube   → iframe embed only (no download needed, YouTube embeds work cleanly)
 *
 * VideoSection calls `processAll` on page load. It schedules a `downloadOne`
 * background action for every video not yet in the DB. Each action runs
 * independently on Convex's infrastructure (no Vercel timeout). When done,
 * the reactive `list` query auto-updates every subscribed client.
 */

import { v } from "convex/values";
import { action, internalAction, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ─── Query: return all stored video records ───────────────────────────────────

export const list = query({
  handler: async (ctx) => {
    return ctx.db.query("featuredVideos").collect();
  },
});

// ─── Internal mutation: upsert a video record ─────────────────────────────────

export const upsert = internalMutation({
  args: {
    sourceUrl: v.string(),
    platform: v.optional(v.string()),
    handle: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mp4Url: v.optional(v.string()),
    posterUrl: v.optional(v.string()),
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
    // Free tier may have cold-start delay — allow up to 90 seconds
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) throw new Error(`cobalt_http_${res.status}`);

  const data = await res.json();

  if (data.status === "error") {
    throw new Error(`cobalt_error: ${data.error?.code ?? JSON.stringify(data.error)}`);
  }

  // status: "redirect" or "tunnel" — both have a direct url field
  if (data.status === "redirect" || data.status === "tunnel") {
    if (!data.url) throw new Error("cobalt_no_url");
    return data.url;
  }

  // status: "picker" (e.g. carousel) — grab the first video item
  if (data.status === "picker" && data.picker?.length > 0) {
    const video = data.picker.find((p: { type: string }) => p.type === "video") ?? data.picker[0];
    if (video?.url) return video.url;
  }

  throw new Error(`cobalt_unexpected_status: ${data.status}`);
}

// ─── Platform detector ────────────────────────────────────────────────────────

function detectPlatform(url: string): "tiktok" | "twitter" | "instagram" | "youtube" | "unknown" {
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("x.com") || url.includes("twitter.com")) return "twitter";
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

// ─── Helper: extract Instagram og:image URL from page HTML ───────────────────

async function getInstagramOgImage(sourceUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Twitterbot/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match?.[1];
  } catch {
    return undefined;
  }
}

// ─── TikTok downloader via tikwm.com (free, no auth) ─────────────────────────

async function getTikTokInfo(sourceUrl: string): Promise<{ downloadUrl: string; thumbnailUrl?: string }> {
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

  return { downloadUrl, thumbnailUrl: data.data?.cover ?? data.data?.origin_cover };
}

// ─── X/Twitter downloader via vxtwitter.com (free, no auth) ──────────────────

async function getTwitterDownloadUrl(sourceUrl: string): Promise<{ videoUrl: string; posterUrl?: string }> {
  // Extract tweet ID from URL
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

  // Pick the highest-quality video
  const media = data.media_extended?.find(
    (m: { type: string }) => m.type === "video",
  );

  const videoUrl = media?.url ?? data.mediaURLs?.[0];
  if (!videoUrl) throw new Error("vxtwitter_no_url");

  return { videoUrl, posterUrl: media?.thumbnail_url };
}

// ─── Internal action: download one video → Convex storage ─────────────────────

export const downloadOne = internalAction({
  args: {
    sourceUrl: v.string(),
    handle: v.optional(v.string()),
  },
  handler: async (ctx, { sourceUrl, handle }) => {
    const platform = detectPlatform(sourceUrl);

    // YouTube: mark as done without mp4Url — embed works great, no download needed
    if (platform === "youtube") {
      await ctx.runMutation(internal.featuredVideos.upsert, {
        sourceUrl,
        handle,
        platform,
        status: "done",
      });
      return { success: true, platform, note: "embed_only" };
    }

    // Mark as processing immediately so parallel calls skip this URL
    await ctx.runMutation(internal.featuredVideos.upsert, {
      sourceUrl,
      handle,
      platform,
      status: "processing",
    });

    try {
      let downloadUrl: string;
      let posterUrl: string | undefined;

      // ── Step 1: get the direct download URL + thumbnail via platform API ──
      if (platform === "tiktok") {
        const info = await getTikTokInfo(sourceUrl);
        downloadUrl = info.downloadUrl;
        // TikTok CDN thumbnails are publicly accessible — store permanently in Convex
        if (info.thumbnailUrl) {
          posterUrl = await storeImage(ctx, info.thumbnailUrl, "https://www.tiktok.com/");
        }
      } else if (platform === "twitter") {
        const result = await getTwitterDownloadUrl(sourceUrl);
        downloadUrl = result.videoUrl;
        posterUrl = result.posterUrl; // pbs.twimg.com — works directly in browser
      } else if (platform === "instagram") {
        // Self-hosted cobalt — no auth, no Turnstile
        downloadUrl = await getCobaltDownloadUrl(sourceUrl);
        // Fetch og:image server-side then store in Convex (bypasses hotlink protection)
        const ogImageUrl = await getInstagramOgImage(sourceUrl);
        if (ogImageUrl) {
          posterUrl = await storeImage(ctx, ogImageUrl, "https://www.instagram.com/");
        }
      } else {
        throw new Error(`unsupported_platform: ${platform}`);
      }

      // ── Step 2: download the raw video bytes ──────────────────────────────
      const videoRes = await fetch(downloadUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer":
            platform === "tiktok"
              ? "https://www.tiktok.com/"
              : platform === "instagram"
                ? "https://www.instagram.com/"
                : "https://x.com/",
        },
        signal: AbortSignal.timeout(120000), // 2 minutes for video download
      });

      if (!videoRes.ok) {
        throw new Error(`download_failed_${videoRes.status}`);
      }

      const blob = await videoRes.blob();

      // ── Step 3: persist to Convex file storage ────────────────────────────
      const storageId = await ctx.storage.store(blob);
      const mp4Url = await ctx.storage.getUrl(storageId);

      await ctx.runMutation(internal.featuredVideos.upsert, {
        sourceUrl,
        handle,
        platform,
        storageId,
        mp4Url: mp4Url ?? "",
        posterUrl,
        status: "done",
      });

      return { success: true, mp4Url };
    } catch (err) {
      await ctx.runMutation(internal.featuredVideos.upsert, {
        sourceUrl,
        status: "error",
        errorMsg: String(err),
      });
      // Don't rethrow — a single failed video shouldn't crash the whole batch
      console.error(`[featuredVideos] failed to download ${sourceUrl}:`, err);
      return { success: false, error: String(err) };
    }
  },
});

// ─── Public action: schedule downloads for all pending videos ─────────────────
// Called from VideoSection on page load. Returns immediately — downloads run
// in the background. Existing "done" or "processing" records are skipped.

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
    // Fetch current DB state to skip already-processed/in-flight videos
    const existing: Array<{ sourceUrl: string; status: string }> =
      await ctx.runQuery(api.featuredVideos.list);

    let scheduled = 0;

    for (const video of videos) {
      const record = existing.find((r) => r.sourceUrl === video.url);

      // Only queue if not already done or actively downloading
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

// ─── Admin action: reset "done but no mp4" records back to pending ─────────────
// Used when a platform that was previously embed-only now has download support

export const resetEmbedOnly = action({
  args: {},
  handler: async (ctx) => {
    const all: Array<{ _id: string; sourceUrl: string; status: string; mp4Url?: string }> =
      await ctx.runQuery(api.featuredVideos.list);

    const embedOnly = all.filter((r) => r.status === "done" && !r.mp4Url);
    for (const r of embedOnly) {
      await ctx.runMutation(internal.featuredVideos.upsert, {
        sourceUrl: r.sourceUrl,
        status: "pending",
      });
    }
    return { reset: embedOnly.length };
  },
});

// ─── Admin action: fetch + store thumbnails for records that are missing them ──
// Run this after upgrading the pipeline to add thumbnail support for existing videos.

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
          const ogUrl = await getInstagramOgImage(r.sourceUrl);
          if (ogUrl) posterUrl = await storeImage(ctx, ogUrl, "https://www.instagram.com/");
        } else if (platform === "tiktok") {
          const info = await getTikTokInfo(r.sourceUrl);
          if (info.thumbnailUrl) {
            posterUrl = await storeImage(ctx, info.thumbnailUrl, "https://www.tiktok.com/");
          }
        } else if (platform === "twitter") {
          const result = await getTwitterDownloadUrl(r.sourceUrl);
          posterUrl = result.posterUrl;
        }
      } catch (e) {
        console.warn(`[refreshThumbnails] failed for ${r.sourceUrl}:`, e);
        continue;
      }

      if (posterUrl) {
        await ctx.runMutation(internal.featuredVideos.upsert, {
          sourceUrl: r.sourceUrl,
          status: "done",
          posterUrl,
        });
        updated++;
      }
    }

    return { updated, checked: missing.length };
  },
});

// ─── Admin action: reset errored videos so they retry on next page load ────────

export const resetErrors = action({
  args: {},
  handler: async (ctx) => {
    const all: Array<{ _id: string; sourceUrl: string; status: string }> =
      await ctx.runQuery(api.featuredVideos.list);

    const errored = all.filter((r) => r.status === "error");
    for (const r of errored) {
      await ctx.runMutation(internal.featuredVideos.upsert, {
        sourceUrl: r.sourceUrl,
        status: "pending",
        errorMsg: undefined,
      });
    }
    return { reset: errored.length };
  },
});
