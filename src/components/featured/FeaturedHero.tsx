"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "instagram" | "youtube" | "tiktok" | "facebook" | "x";

interface CarouselVideo {
  url: string;
  mp4?: string;
  poster?: string;
  handle: string;
  avatar?: string;
  platform: Platform;
  embedSrc?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPlatform(url: string): Platform {
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
    const shortcode = url.match(/\/reel\/([A-Za-z0-9_-]+)/)?.[1] ?? url.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1];
    return shortcode ? `https://www.instagram.com/reel/${shortcode}/embed/` : undefined;
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

function PlatformIcon({ platform, className = "" }: { platform: Platform | string; className?: string }) {
  // Normalize legacy "twitter" value stored in Convex to "x"
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
      alt={platform}
      className={`object-contain ${className}`}
      style={{ filter: "brightness(0) invert(1)" }}
    />
  );
}

function AvatarBadge({ avatar, handle, gradient }: { avatar?: string; handle: string; gradient: string }) {
  const [failed, setFailed] = useState(false);
  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt={handle}
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/40"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-xs font-bold uppercase text-white`}>
      {handle.replace("@", "").charAt(0)}
    </div>
  );
}

// ─── Source videos (same list the VideoSection grid uses) ─────────────────────
// The carousel shows ALL active videos in order. Managed via admin panel.

const STATIC_VIDEOS = [
  { url: "https://www.instagram.com/reel/DVHF_WXj9SH/", handle: "@mayermm" },
  { url: "https://www.instagram.com/reel/DVMneM-AgUN/" },
  { url: "https://x.com/i/status/2026297531055878397" },
  { url: "https://www.instagram.com/reel/DSA7Z4qkXk8/" },
  { url: "https://www.instagram.com/reel/DVJpQHLCkdF/" },
  { url: "https://www.tiktok.com/@walkiriachd/video/7610960640768740615" },
];

// ─── Carousel slide ───────────────────────────────────────────────────────────

function CarouselSlide({
  video,
  active,
  onEnded,
  playing,
  setPlaying,
}: {
  video: CarouselVideo;
  active: boolean;
  onEnded: () => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const gradient = GRADIENT[video.platform];

  // When becoming active and already in play mode — start the video
  useEffect(() => {
    if (!active || !playing) return;
    const el = videoRef.current;
    if (el) { el.currentTime = 0; el.play().catch(() => {}); }
  }, [active, playing]);

  // When deactivated — pause + reset
  useEffect(() => {
    if (active) return;
    const el = videoRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
    setPaused(false);
  }, [active]);

  const handlePlayPause = () => {
    const el = videoRef.current;
    if (!playing) {
      setPlaying(true);
      setPaused(false);
      if (el) { el.currentTime = 0; el.play().catch(() => {}); }
    } else if (paused) {
      setPaused(false);
      el?.play().catch(() => {});
    } else {
      setPaused(true);
      el?.pause();
    }
  };

  const showOverlay = !playing || paused;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Gradient base */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60`} />

      {/* Video / first-frame preview */}
      {video.mp4 ? (
        <video
          ref={videoRef}
          src={video.mp4}
          poster={video.poster}
          playsInline
          loop={false}
          muted={false}
          className="absolute inset-0 h-full w-full object-cover"
          onEnded={onEnded}
          onPause={() => setPaused(true)}
          onPlay={() => setPaused(false)}
          onLoadedMetadata={(e) => {
            // Show first frame as thumbnail when not yet playing
            if (!playing) (e.currentTarget as HTMLVideoElement).currentTime = 0.1;
          }}
        />
      ) : video.poster && !imgFailed ? (
        <img
          src={video.poster}
          alt={video.handle}
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {/* Embed iframe fallback (YouTube, etc.) — only shown when playing */}
      {playing && !video.mp4 && video.embedSrc && (
        <iframe
          src={video.embedSrc}
          title={video.handle}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* Dark scrim when paused/not playing */}
      <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${playing && !paused ? "opacity-0" : "opacity-30"}`} />

      {/* Centre play/pause button */}
      <button
        onClick={handlePlayPause}
        className="absolute inset-0 flex items-center justify-center focus:outline-none"
        aria-label={playing && !paused ? "Pause" : "Play"}
      >
        <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-2xl transition-all duration-300 ${playing && !paused ? "scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100" : "scale-100 opacity-100"}`}>
          {playing && !paused
            ? <Pause className="h-8 w-8 fill-black text-black" />
            : <Play className="ml-1.5 h-8 w-8 fill-black text-black" />
          }
        </div>
      </button>

      {/* Show play button on hover when playing */}
      {playing && !paused && (
        <div className="group absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Pause className="h-8 w-8 fill-black text-black" />
          </div>
        </div>
      )}

      {/* Overlay: platform icon + avatar + handle (shown when not playing / paused) */}
      {showOverlay && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5">
          {/* Platform icon — top right */}
          <div className="flex justify-end">
            <div className="rounded-full bg-black/40 p-2 backdrop-blur-sm">
              <PlatformIcon platform={video.platform} className="h-5 w-5" />
            </div>
          </div>

          {/* Avatar + handle — bottom left */}
          <div className="flex items-center gap-3">
            <AvatarBadge avatar={video.avatar} handle={video.handle} gradient={gradient} />
            <div>
              <p className="text-sm font-bold text-white drop-shadow">
                {video.handle.startsWith("@") ? video.handle : `@${video.handle}`}
              </p>
              <p className="text-[11px] capitalize text-white/70">{video.platform}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main carousel component ──────────────────────────────────────────────────

export function FeaturedHero() {
  const storedVideos = useQuery(api.featuredVideos.list);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Build the carousel items from Convex data merged with static list
  const items: CarouselVideo[] = STATIC_VIDEOS.map((entry) => {
    const stored = storedVideos?.find((r) => r.sourceUrl === entry.url);
    const platform = (stored?.platform as Platform | undefined) ?? detectPlatform(entry.url);
    return {
      url: entry.url,
      mp4: stored?.status === "done" && stored.mp4Url ? stored.mp4Url : undefined,
      poster: stored?.posterUrl ?? undefined,
      handle: stored?.handle ?? entry.handle ?? platform,
      avatar: stored?.avatarUrl ?? undefined,
      platform,
      embedSrc: buildEmbedSrc(entry.url, platform),
    };
  });

  const total = items.length;

  const goTo = useCallback((idx: number) => {
    setCurrent(((idx % total) + total) % total);
  }, [total]);

  const prev = () => { goTo(current - 1); };
  const next = useCallback(() => { goTo(current + 1); }, [current, goTo]);

  // Auto-advance to next video when current one ends
  const handleEnded = useCallback(() => {
    next();
    // Keep playing — the new slide's useEffect will auto-start it
  }, [next]);

  if (total === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Section label */}
      <div className="mb-5 flex items-center gap-3">
        <span className="h-5 w-1 rounded-full bg-red-600" />
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--foreground)]">
          Destacados
        </h2>
      </div>

      {/* Carousel container */}
      <div className="group relative overflow-hidden rounded-2xl" style={{ aspectRatio: "16/7", minHeight: 320 }}>

        {/* Slides — only the current one is visible */}
        {items.map((video, i) => (
          <div
            key={video.url}
            className={`absolute inset-0 transition-opacity duration-500 ${i === current ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            <CarouselSlide
              video={video}
              active={i === current}
              onEnded={handleEnded}
              playing={playing}
              setPlaying={setPlaying}
            />
          </div>
        ))}

        {/* Prev / Next arrows */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/70 focus:outline-none"
          aria-label="Previous video"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/70 focus:outline-none"
          aria-label="Next video"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Dot navigation */}
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-300 focus:outline-none ${
                i === current
                  ? "w-6 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Go to video ${i + 1}`}
            />
          ))}
        </div>

        {/* Thumbnail strip */}
        <div className="absolute bottom-12 left-0 right-0 z-20 hidden justify-center gap-2 px-8 sm:flex">
          {items.map((video, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`relative h-12 w-9 shrink-0 overflow-hidden rounded-md transition-all duration-300 focus:outline-none ${
                i === current
                  ? "ring-2 ring-white scale-110"
                  : "opacity-60 hover:opacity-100 hover:scale-105"
              }`}
              aria-label={`${video.handle} — video ${i + 1}`}
            >
              {video.mp4 ? (
                <video
                  src={video.mp4}
                  preload="metadata"
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  onLoadedMetadata={(e) => {
                    (e.currentTarget as HTMLVideoElement).currentTime = 0.1;
                  }}
                />
              ) : video.poster ? (
                <img src={video.poster} alt={video.handle} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT[video.platform]}`} />
              )}
              {/* Platform icon chip */}
              <div className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 p-0.5">
                <PlatformIcon platform={video.platform} className="h-2.5 w-2.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
