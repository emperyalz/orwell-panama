"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
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

interface FeaturedArticle {
  category: string;
  title: string;
  image: string;
  href: string;
}

// ─── Static right-column content (unchanged from original design) ─────────────

const YOUTUBE_EMBED = "https://www.youtube.com/embed/0evoN0fImGY?autoplay=1&rel=0";
const YOUTUBE_THUMB = "https://img.youtube.com/vi/0evoN0fImGY/hqdefault.jpg";

const BOTTOM_ARTICLE: FeaturedArticle = {
  category: "NOTICIAS",
  title: "Panamá conmemora el hecho patriótico del 9 de enero de 1964",
  image: "/images/headshots/GOV-002.jpg",
  href: "#",
};

// ─── Platform helpers ─────────────────────────────────────────────────────────

function normalizePlatform(raw: string | undefined): Platform {
  if (!raw) return "instagram";
  if (raw === "twitter") return "x";
  return raw as Platform;
}

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

// ─── Platform icon — renders brand SVG in natural color (no filter needed) ────

function PlatformIcon({ platform, className = "" }: { platform: Platform | string; className?: string }) {
  const key = normalizePlatform(platform as string);
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

function AvatarBadge({ avatar, handle, gradient, size = "md" }: {
  avatar?: string;
  handle: string;
  gradient: string;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const dim = size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-xs";
  const ring = size === "sm" ? "ring-1" : "ring-2";
  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt={handle}
        className={`${dim} shrink-0 rounded-full object-cover ${ring} ring-white/40`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold uppercase text-white`}>
      {handle.replace("@", "").charAt(0)}
    </div>
  );
}

// ─── Right-column: YouTube video card ─────────────────────────────────────────

function YoutubeCard() {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative h-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={YOUTUBE_EMBED}
          title="Conferencia de Prensa"
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setPlaying(true)}
      className="group relative h-full cursor-pointer overflow-hidden rounded-xl bg-black"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-red-700 to-red-500 opacity-70" />
      <img
        src={YOUTUBE_THUMB}
        alt="YouTube video"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/15" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-2xl transition-transform duration-200 group-hover:scale-110">
          <Play className="ml-0.5 h-5 w-5 fill-black text-black" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-6">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600">
            <PlatformIcon platform="youtube" className="h-3 w-3" />
          </div>
          <span className="text-[11px] font-medium text-white drop-shadow">Conferencia de Prensa</span>
        </div>
      </div>
    </div>
  );
}

// ─── Right-column: Article card ───────────────────────────────────────────────

function ArticleCard({ item }: { item: FeaturedArticle }) {
  return (
    <Link
      href={item.href}
      className="group relative flex h-full min-h-[150px] overflow-hidden rounded-xl"
    >
      <img
        src={item.image}
        alt={item.title}
        className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
      <div className="relative mt-auto p-4">
        <span className="inline-block rounded-sm bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
          {item.category}
        </span>
        <h3 className="mt-1.5 text-sm font-bold leading-snug text-white drop-shadow-md">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}

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

  // Auto-play when becoming active while in play mode
  useEffect(() => {
    if (!active || !playing) return;
    const el = videoRef.current;
    if (el) { el.currentTime = 0; el.play().catch(() => {}); }
  }, [active, playing]);

  // Pause and reset when deactivated
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

      {/* Video or poster image */}
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

      {/* Embed iframe when playing without mp4 */}
      {playing && !video.mp4 && video.embedSrc && (
        <iframe
          src={video.embedSrc}
          title={video.handle}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* Dark scrim */}
      <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${playing && !paused ? "opacity-0" : "opacity-30"}`} />

      {/* Play/pause button — covers full slide; shows circle when paused/stopped,
          hides when playing (group-hover makes it reappear for pause). */}
      <button
        onClick={handlePlayPause}
        className="group absolute inset-0 z-10 flex items-center justify-center focus:outline-none"
        aria-label={playing && !paused ? "Pause" : "Play"}
      >
        <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-2xl transition-all duration-300 ${
          playing && !paused
            ? "scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100"
            : "scale-100 opacity-100"
        }`}>
          {playing && !paused
            ? <Pause className="h-7 w-7 fill-black text-black" />
            : <Play className="ml-1 h-7 w-7 fill-black text-black" />
          }
        </div>
      </button>

      {/* Info overlay — platform icon (top-right), avatar + handle (bottom-left) */}
      {showOverlay && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
          <div className="flex justify-end">
            <div className="rounded-full bg-black/50 p-1.5 backdrop-blur-sm">
              <PlatformIcon platform={video.platform} className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {video.handle && (
              <AvatarBadge avatar={video.avatar} handle={video.handle} gradient={gradient} size="md" />
            )}
            {!video.handle && video.avatar && (
              <AvatarBadge avatar={video.avatar} handle={video.platform} gradient={gradient} size="md" />
            )}
            <div>
              {video.handle ? (
                <p className="text-sm font-bold text-white drop-shadow">
                  {video.handle.startsWith("@") ? video.handle : `@${video.handle}`}
                </p>
              ) : null}
              <p className={`capitalize text-white/70 ${video.handle ? "text-[11px]" : "text-xs font-semibold"}`}>
                {video.platform}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function FeaturedHero() {
  const storedVideos = useQuery(api.featuredVideos.list);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Build carousel from Convex: prefer isFeatured videos, fall back to all active+done
  const allReady = (storedVideos ?? []).filter(
    (r) => r.isActive !== false && r.status === "done",
  );
  const featured = allReady.filter((r) => r.isFeatured);
  const sourceRecords = featured.length > 0 ? featured : allReady;

  // Generic platform-name handles like "instagram" / "x" aren't real @handles
  const GENERIC = new Set(["instagram", "x", "tiktok", "youtube", "facebook", "twitter"]);

  const items: CarouselVideo[] = sourceRecords.map((r) => {
    const platform = normalizePlatform(r.platform);
    const rawHandle = r.handle;
    // Use stored handle if it's real (not a generic platform fallback)
    const handle = rawHandle && !GENERIC.has(rawHandle.replace(/^@/, "").toLowerCase())
      ? rawHandle
      : null;
    return {
      url: r.sourceUrl,
      mp4: r.mp4Url ?? undefined,
      poster: r.posterUrl ?? undefined,
      handle: handle ?? "",
      avatar: r.avatarUrl ?? undefined,
      platform,
      embedSrc: buildEmbedSrc(r.sourceUrl, platform),
    };
  });

  const total = items.length;

  const goTo = useCallback(
    (idx: number) => {
      if (total === 0) return;
      setCurrent(((idx % total) + total) % total);
    },
    [total],
  );

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const handleEnded = useCallback(() => { next(); }, [next]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Section header: label left, thumbnail strip right */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-5 w-1 shrink-0 rounded-full bg-red-600" />
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--foreground)]">
            Destacados
          </h2>
        </div>

        {/* Thumbnail strip — above the grid, right-aligned */}
        {total > 1 && (
          <div className="flex gap-1.5">
            {items.map((video, i) => (
              <button
                key={i}
                onClick={() => { goTo(i); }}
                className={`relative h-12 w-9 shrink-0 overflow-hidden rounded-lg transition-all duration-300 focus:outline-none ${
                  i === current
                    ? "ring-2 ring-red-500 scale-110 shadow-lg"
                    : "opacity-55 hover:opacity-90 hover:scale-105"
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
                  <img
                    src={video.poster}
                    alt={video.handle}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT[video.platform]}`} />
                )}
                {/* Platform chip */}
                <div className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 p-0.5">
                  <PlatformIcon platform={video.platform} className="h-2.5 w-2.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3-card hero grid: carousel left (3/5) | YouTube top-right | article bottom-right */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:grid-rows-2 lg:h-[480px]">

        {/* ── Left: Video carousel (3/5 columns, full height) ── */}
        <div className="group relative lg:col-span-3 lg:row-span-2 min-h-[320px] overflow-hidden rounded-2xl bg-black">
          {total === 0 ? (
            /* Loading or empty state */
            <div className="flex h-full min-h-[320px] items-center justify-center bg-[var(--muted)]">
              <Play className="h-12 w-12 opacity-20 text-[var(--foreground)]" />
            </div>
          ) : (
            <>

              {/* Prev / Next arrows */}
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/70 focus:outline-none"
                aria-label="Previous video"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/70 focus:outline-none"
                aria-label="Next video"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Dot navigation */}
              {total > 1 && (
                <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-1.5">
                  {items.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none ${
                        i === current ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                      }`}
                      aria-label={`Go to video ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Top-right: YouTube video ── */}
        <div className="lg:col-span-2 lg:row-span-1 min-h-[150px]">
          <YoutubeCard />
        </div>

        {/* ── Bottom-right: Article card ── */}
        <div className="lg:col-span-2 lg:row-span-1">
          <ArticleCard item={BOTTOM_ARTICLE} />
        </div>
      </div>
    </section>
  );
}
