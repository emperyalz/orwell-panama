"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "instagram" | "youtube" | "tiktok" | "facebook" | "x";

// ─── Platform helpers ─────────────────────────────────────────────────────────

function normalizePlatform(raw: string | undefined, url: string): Platform {
  if (raw && raw !== "twitter") return raw as Platform;
  if (raw === "twitter") return "x";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("x.com") || url.includes("twitter.com")) return "x";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("facebook.com")) return "facebook";
  return "instagram";
}

function buildEmbedSrc(url: string, platform: Platform): string | undefined {
  if (platform === "youtube") {
    const id = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : undefined;
  }
  if (platform === "instagram") {
    const sc = url.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] ?? url.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1];
    return sc ? `https://www.instagram.com/reel/${sc}/embed/` : undefined;
  }
  if (platform === "tiktok") {
    const vid = url.match(/\/video\/(\d+)/)?.[1];
    return vid ? `https://www.tiktok.com/embed/v2/${vid}` : undefined;
  }
  if (platform === "x") {
    const id = url.match(/\/status\/(\d+)/)?.[1];
    return id ? `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark&dnt=true` : undefined;
  }
  return undefined;
}

const GRADIENT: Record<Platform, string> = {
  instagram: "from-purple-600 via-pink-500 to-orange-400",
  youtube: "from-red-700 to-red-500",
  tiktok: "from-gray-900 to-gray-700",
  facebook: "from-blue-700 to-blue-500",
  x: "from-zinc-900 to-zinc-700",
};

// ─── Platform icon — renders brand SVG in its natural colors ─────────────────

function PlatformIcon({ platform, className = "" }: { platform: Platform | string; className?: string }) {
  const key = (platform === "twitter" ? "x" : platform) as Platform;
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
      alt={platform as string}
      className={`object-contain ${className}`}
    />
  );
}

// ─── Avatar badge ─────────────────────────────────────────────────────────────

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
    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[9px] font-bold uppercase text-white`}>
      {handle.replace("@", "").charAt(0)}
    </div>
  );
}

// ─── Single video card ────────────────────────────────────────────────────────

interface VideoEntry {
  url: string;
  mp4?: string;
  poster?: string;
  handle: string;
  avatar?: string;
  platform: Platform;
}

function VideoCard({ entry }: { entry: VideoEntry }) {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const gradient = GRADIENT[entry.platform];
  const embedSrc = buildEmbedSrc(entry.url, entry.platform);
  const showOverlay = !playing || paused;

  const handle = entry.handle.startsWith("@") ? entry.handle : `@${entry.handle}`;

  // ── Playing state ──────────────────────────────────────────────────────────
  if (playing) {
    return (
      <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
        {entry.mp4 ? (
          <video
            src={entry.mp4}
            poster={entry.poster}
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
            title={entry.handle}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : null}

        {/* Overlay — always visible: platform icon top-left, avatar + handle bottom */}
        {entry.mp4 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2.5">
            <div className="flex justify-start">
              <PlatformIcon platform={entry.platform} className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2 py-1.5 backdrop-blur-sm">
              <AvatarBadge avatar={entry.avatar} handle={handle} gradient={gradient} />
              <span className="truncate text-[10px] font-semibold text-white drop-shadow">
                {handle}
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

      {/* Thumbnail: prefer posterUrl, fall back to video first-frame */}
      {entry.mp4 && (!entry.poster || imgFailed) ? (
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
      ) : entry.poster ? (
        <img
          src={entry.poster}
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
      <div className="absolute left-2.5 top-2.5">
        <PlatformIcon platform={entry.platform} className="h-3.5 w-3.5" />
      </div>

      {/* Avatar + handle — bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2.5 pt-5">
        <div className="flex items-center gap-1.5">
          <AvatarBadge avatar={entry.avatar} handle={handle} gradient={gradient} />
          <span className="truncate text-[10px] font-semibold text-white drop-shadow">
            {handle}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function VideoSection() {
  const storedVideos = useQuery(api.featuredVideos.list);

  // Show only videos explicitly marked showInVideos (admin-controlled), max 18 (3 rows × 6 cols)
  const videos: VideoEntry[] = (storedVideos ?? [])
    .filter((r) => r.showInVideos === true && r.status === "done")
    .slice(0, 18)
    .map((r) => {
      const platform = normalizePlatform(r.platform, r.sourceUrl);
      return {
        url: r.sourceUrl,
        mp4: r.mp4Url ?? undefined,
        poster: r.posterUrl ?? undefined,
        handle: r.handle ?? platform,
        avatar: r.avatarUrl ?? undefined,
        platform,
      };
    });

  if (videos.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-5 w-1 rounded-full bg-red-600" />
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--foreground)]">
          Videos
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {videos.map((entry, i) => (
          <VideoCard key={i} entry={entry} />
        ))}
      </div>
    </section>
  );
}
