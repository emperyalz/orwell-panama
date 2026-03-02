"use client";

import { useState, useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "instagram" | "youtube" | "tiktok" | "facebook" | "x";

export interface VideoEntry {
  url: string;     // original share URL (always required)
  mp4?: string;    // self-hosted file → clean native <video>
  poster?: string; // thumbnail override
  handle?: string; // @username shown on card
  avatar?: string; // profile picture URL
}

// ─── URL resolver ─────────────────────────────────────────────────────────────

function resolvePlatform(url: string): {
  platform: Platform;
  handle: string;
  thumbnail?: string;
  embedSrc?: string;
} {
  // YouTube
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/,
  );
  if (yt)
    return {
      platform: "youtube",
      handle: "YouTube",
      thumbnail: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
      embedSrc: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`,
    };

  // Instagram
  if (url.includes("instagram.com")) {
    const shortcode =
      url.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] ??
      url.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1];
    return {
      platform: "instagram",
      handle: "Instagram",
      embedSrc: shortcode
        ? `https://www.instagram.com/reel/${shortcode}/embed/`
        : undefined,
    };
  }

  // TikTok
  if (url.includes("tiktok.com")) {
    const acct = url.match(/tiktok\.com\/@([^/?]+)/)?.[1];
    const vid = url.match(/\/video\/(\d+)/)?.[1];
    return {
      platform: "tiktok",
      handle: acct ? `@${acct}` : "@TikTok",
      embedSrc: vid ? `https://www.tiktok.com/embed/v2/${vid}` : undefined,
    };
  }

  // Facebook
  if (url.includes("facebook.com"))
    return {
      platform: "facebook",
      handle: "Facebook",
      embedSrc: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true`,
    };

  // X / Twitter
  if (url.includes("x.com") || url.includes("twitter.com")) {
    const id = url.match(/\/status\/(\d+)/)?.[1];
    return {
      platform: "x",
      handle: "@X",
      embedSrc: id
        ? `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark&dnt=true`
        : undefined,
    };
  }

  return { platform: "instagram", handle: "" };
}

// ─── Platform gradient map ────────────────────────────────────────────────────

const GRADIENT: Record<Platform, string> = {
  instagram: "from-purple-600 via-pink-500 to-orange-400",
  youtube: "from-red-700 to-red-500",
  tiktok: "from-gray-900 to-gray-700",
  facebook: "from-blue-700 to-blue-500",
  x: "from-zinc-900 to-zinc-700",
};

// ─── Lazy thumbnail hook ──────────────────────────────────────────────────────

function useThumbnail(url: string, preloaded?: string): string | null {
  const [thumb, setThumb] = useState<string | null>(preloaded ?? null);

  useEffect(() => {
    if (preloaded) return;
    fetch(`/api/thumbnail?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.thumbnail) setThumb(d.thumbnail);
      })
      .catch(() => {});
  }, [url, preloaded]);

  return thumb;
}

// ─── Video data ───────────────────────────────────────────────────────────────
// Add mp4 field for self-hosted videos → clean native player.
// Without mp4 → plays embed in on-site modal (no navigation away).

const VIDEOS: VideoEntry[] = [
  { url: "https://www.instagram.com/reel/DVHF_WXj9SH/", handle: "@mayermm" },
  { url: "https://www.instagram.com/reel/DVMneM-AgUN/" },
  { url: "https://x.com/i/status/2026297531055878397" },
  { url: "https://www.instagram.com/reel/DSA7Z4qkXk8/" },
  { url: "https://www.instagram.com/reel/DVJpQHLCkdF/" },
  { url: "https://www.tiktok.com/@walkiriachd/video/7610960640768740615" },
  // Up to 12 total:
  // { url: "https://...", mp4: "https://cdn.example.com/clip.mp4", handle: "@user" },
];

// ─── Single video card ────────────────────────────────────────────────────────

function VideoCard({ entry }: { entry: VideoEntry }) {
  const [playing, setPlaying] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const resolved = resolvePlatform(entry.url);
  const platform = resolved.platform;
  const handle = entry.handle ?? resolved.handle;
  const thumbnail = useThumbnail(entry.url, entry.poster ?? resolved.thumbnail);
  const gradient = GRADIENT[platform];
  const embedSrc = resolved.embedSrc;

  // ── Playing state: video/iframe fills the card inline ──────────────────────
  if (playing) {
    return (
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
        {entry.mp4 ? (
          // Self-hosted: native video, full controls, plays with sound
          <video
            src={entry.mp4}
            poster={entry.poster ?? resolved.thumbnail}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : embedSrc ? (
          // Platform embed: fills card inline — YouTube autoplays with sound
          <iframe
            src={embedSrc}
            title={handle}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : null}
      </div>
    );
  }

  // ── Thumbnail / facade state ────────────────────────────────────────────────
  return (
    <div
      onClick={() => setPlaying(true)}
      className="group relative aspect-[9/16] w-full cursor-pointer overflow-hidden rounded-xl bg-black"
    >
      {/* Gradient base — always visible, covers loading / failed thumbnails */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-75`}
      />

      {/* Thumbnail hierarchy:
          1. If mp4 is available and no working thumbnail → use video's own first frame
          2. If thumbnail URL is available (and hasn't failed) → show img
          3. imgFailed safety net: if img 403s/errors, fall back to video frame */}
      {entry.mp4 && (!thumbnail || imgFailed) ? (
        <video
          src={entry.mp4}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onLoadedMetadata={(e) => {
            (e.currentTarget as HTMLVideoElement).currentTime = 0.1;
          }}
        />
      ) : thumbnail ? (
        /* External thumbnail URL (YouTube CDN, twimg, Convex-stored TikTok, etc.) */
        <img
          src={thumbnail}
          alt={handle}
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : null}

      {/* Scrim */}
      <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center opacity-80 transition-opacity group-hover:opacity-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-xl transition-transform duration-200 group-hover:scale-110">
          <Play className="ml-0.5 h-5 w-5 fill-black text-black" />
        </div>
      </div>

      {/* Bottom: avatar + handle */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-6">
        <div className="flex items-center gap-2">
          {entry.avatar ? (
            <img
              src={entry.avatar}
              alt={handle}
              className="h-6 w-6 rounded-full object-cover ring-1 ring-white/40"
            />
          ) : (
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[9px] font-bold uppercase text-white`}
            >
              {handle.replace("@", "").charAt(0)}
            </div>
          )}
          <span className="truncate text-[11px] font-semibold text-white drop-shadow">
            {handle.startsWith("@") ? handle : `@${handle}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function VideoSection() {
  // ── Convex reactive query — updates automatically when downloads finish ──
  const storedVideos = useQuery(api.featuredVideos.list);
  const processAll = useAction(api.featuredVideos.processAll);

  // Auto-trigger download pipeline on first load for any unprocessed videos.
  // Uses a ref so we only fire once per component mount, not on every re-render.
  const triggered = useRef(false);
  useEffect(() => {
    if (storedVideos === undefined || triggered.current) return;
    const hasPending = VIDEOS.some((v) => {
      const r = storedVideos.find((s) => s.sourceUrl === v.url);
      return !r || (r.status !== "done" && r.status !== "processing");
    });
    if (hasPending) {
      triggered.current = true;
      processAll({ videos: VIDEOS.map((v) => ({ url: v.url, handle: v.handle })) });
    }
  }, [storedVideos, processAll]);

  // Merge static metadata with dynamic mp4 URLs + poster thumbnails from Convex storage
  const videos = VIDEOS.map((entry) => {
    const stored = storedVideos?.find((r) => r.sourceUrl === entry.url);
    return {
      ...entry,
      mp4: stored?.status === "done" && stored.mp4Url ? stored.mp4Url : undefined,
      // posterUrl from Convex is served from convex.cloud — no hotlink issues
      poster: stored?.posterUrl ?? entry.poster,
    };
  });

  if (VIDEOS.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-5 w-1 rounded-full bg-red-600" />
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--foreground)]">
          Videos
        </h2>
        <span className="text-[10px] text-[var(--muted-foreground)]">
          {VIDEOS.length} / 12
        </span>
      </div>

      {/* One row of up to 6; expands to 12 on larger screens */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {videos.slice(0, 12).map((entry, i) => (
          <VideoCard key={i} entry={entry} />
        ))}
      </div>
    </section>
  );
}
