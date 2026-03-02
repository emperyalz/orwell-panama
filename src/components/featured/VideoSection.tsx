"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "instagram" | "youtube" | "tiktok" | "facebook" | "x";

export interface VideoEntry {
  url: string;
  mp4?: string;
  poster?: string;
  handle?: string;
  avatar?: string;   // profile picture (Convex-stored)
  platform?: Platform;
}

// ─── URL resolver ─────────────────────────────────────────────────────────────

function resolvePlatform(url: string): {
  platform: Platform;
  handle: string;
  thumbnail?: string;
  embedSrc?: string;
} {
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

  if (url.includes("tiktok.com")) {
    const acct = url.match(/tiktok\.com\/@([^/?]+)/)?.[1];
    const vid = url.match(/\/video\/(\d+)/)?.[1];
    return {
      platform: "tiktok",
      handle: acct ? `@${acct}` : "@TikTok",
      embedSrc: vid ? `https://www.tiktok.com/embed/v2/${vid}` : undefined,
    };
  }

  if (url.includes("facebook.com"))
    return {
      platform: "facebook",
      handle: "Facebook",
      embedSrc: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true`,
    };

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

// ─── Platform gradients ────────────────────────────────────────────────────────

const GRADIENT: Record<Platform, string> = {
  instagram: "from-purple-600 via-pink-500 to-orange-400",
  youtube: "from-red-700 to-red-500",
  tiktok: "from-gray-900 to-gray-700",
  facebook: "from-blue-700 to-blue-500",
  x: "from-zinc-900 to-zinc-700",
};

// ─── Platform logo icon ────────────────────────────────────────────────────────
// Uses the SVG icons already in /public/icons/platforms/

function PlatformIcon({ platform, className = "" }: { platform: Platform | string; className?: string }) {
  // Normalize legacy "twitter" value stored in Convex to "x"
  const key = platform === "twitter" ? "x" : platform as Platform;
  const src: Record<Platform, string> = {
    instagram: "/icons/platforms/instagram.svg",
    youtube: "/icons/platforms/youtube.svg",
    tiktok: "/icons/platforms/tiktok.svg",
    facebook: "/icons/platforms/facebook.svg",
    x: "/icons/platforms/x-twitter.svg",
  };
  return (
    <img
      src={src[key] ?? src.instagram}
      alt={platform}
      className={`object-contain ${className}`}
      style={{ filter: "brightness(0) invert(1)" }}
    />
  );
}

// ─── Lazy thumbnail hook ──────────────────────────────────────────────────────

function useThumbnail(url: string, preloaded?: string): string | null {
  const [thumb, setThumb] = useState<string | null>(preloaded ?? null);

  useEffect(() => {
    if (preloaded) return;
    fetch(`/api/thumbnail?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => { if (d.thumbnail) setThumb(d.thumbnail); })
      .catch(() => {});
  }, [url, preloaded]);

  return thumb;
}

// ─── Video data (source of truth for which URLs to show) ──────────────────────
// The platform will auto-download these. Add/remove URLs here to control the grid.

const VIDEOS: VideoEntry[] = [
  { url: "https://www.instagram.com/reel/DVHF_WXj9SH/", handle: "@mayermm" },
  { url: "https://www.instagram.com/reel/DVMneM-AgUN/" },
  { url: "https://x.com/i/status/2026297531055878397" },
  { url: "https://www.instagram.com/reel/DSA7Z4qkXk8/" },
  { url: "https://www.instagram.com/reel/DVJpQHLCkdF/" },
  { url: "https://www.tiktok.com/@walkiriachd/video/7610960640768740615" },
];

// ─── Single video card ────────────────────────────────────────────────────────

function VideoCard({ entry }: { entry: VideoEntry }) {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const resolved = resolvePlatform(entry.url);
  // Normalize "twitter" (legacy Convex value) → "x"
  const rawPlatform = (entry.platform as string | undefined) ?? resolved.platform;
  const platform: Platform = rawPlatform === "twitter" ? "x" : rawPlatform as Platform;
  const handle = entry.handle ?? resolved.handle;
  const thumbnail = useThumbnail(entry.url, entry.poster ?? resolved.thumbnail);
  const gradient = GRADIENT[platform] ?? GRADIENT.x;
  const embedSrc = resolved.embedSrc;

  // Show overlay (handle / platform logo) when not playing, or when paused
  const showOverlay = !playing || paused;

  // ── Playing state ──────────────────────────────────────────────────────────
  if (playing) {
    return (
      <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
        {entry.mp4 ? (
          <video
            ref={videoRef}
            src={entry.mp4}
            poster={entry.poster ?? resolved.thumbnail}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            onPause={() => setPaused(true)}
            onPlay={() => setPaused(false)}
          />
        ) : embedSrc ? (
          <iframe
            src={embedSrc}
            title={handle}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : null}

        {/* Overlay — only shown when paused (native video only) */}
        {entry.mp4 && showOverlay && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
            {/* Platform icon — top left */}
            <div className="flex justify-start">
              <div className="rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
                <PlatformIcon platform={platform} className="h-4 w-4" />
              </div>
            </div>
            {/* Avatar + handle — bottom */}
            <div className="flex items-center gap-2 rounded-lg bg-black/40 px-2.5 py-2 backdrop-blur-sm">
              <AvatarBadge avatar={entry.avatar} handle={handle} gradient={gradient} />
              <span className="truncate text-[11px] font-semibold text-white drop-shadow">
                {handle.startsWith("@") ? handle : `@${handle}`}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Thumbnail / facade state ────────────────────────────────────────────────
  return (
    <div
      onClick={() => { setPlaying(true); setPaused(false); }}
      className="group relative aspect-[9/16] w-full cursor-pointer overflow-hidden rounded-xl bg-black"
    >
      {/* Gradient base */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-75`} />

      {/* Thumbnail / video first-frame */}
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
        <img
          src={thumbnail}
          alt={handle}
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : null}

      {/* Dark scrim */}
      <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center opacity-80 transition-opacity group-hover:opacity-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-xl transition-transform duration-200 group-hover:scale-110">
          <Play className="ml-0.5 h-5 w-5 fill-black text-black" />
        </div>
      </div>

      {/* Platform icon — top left */}
      <div className="absolute left-2.5 top-2.5 rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
        <PlatformIcon platform={platform} className="h-4 w-4" />
      </div>

      {/* Avatar + handle — bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-6">
        <div className="flex items-center gap-2">
          <AvatarBadge avatar={entry.avatar} handle={handle} gradient={gradient} />
          <span className="truncate text-[11px] font-semibold text-white drop-shadow">
            {handle.startsWith("@") ? handle : `@${handle}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Avatar badge helper ──────────────────────────────────────────────────────

function AvatarBadge({ avatar, handle, gradient }: {
  avatar?: string;
  handle: string;
  gradient: string;
}) {
  const [failed, setFailed] = useState(false);
  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt={handle}
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/40"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[9px] font-bold uppercase text-white`}
    >
      {handle.replace("@", "").charAt(0)}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function VideoSection() {
  const storedVideos = useQuery(api.featuredVideos.list);
  const processAll = useAction(api.featuredVideos.processAll);

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

  // Merge static metadata with dynamic data from Convex
  const videos = VIDEOS.map((entry) => {
    const stored = storedVideos?.find((r) => r.sourceUrl === entry.url);
    return {
      ...entry,
      platform: (stored?.platform ?? undefined) as Platform | undefined,
      mp4: stored?.status === "done" && stored.mp4Url ? stored.mp4Url : undefined,
      poster: stored?.posterUrl ?? entry.poster,
      avatar: stored?.avatarUrl ?? entry.avatar,
      handle: stored?.handle ?? entry.handle,
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
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {videos.slice(0, 12).map((entry, i) => (
          <VideoCard key={i} entry={entry} />
        ))}
      </div>
    </section>
  );
}
