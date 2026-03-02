"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeaturedItem {
  id: number;
  category: string;
  tag?: string;
  title: string;
  excerpt?: string;
  image: string;
  href: string;
}

// ─── Placeholder data (swap for Convex query when articles table exists) ─────

const FEATURED: FeaturedItem[] = [
  {
    id: 1,
    category: "ANÁLISIS",
    tag: "Destacado",
    title: "La nueva composición de la Asamblea Nacional tras las elecciones de 2024",
    excerpt:
      "Con 71 diputados repartidos entre ocho partidos y movimientos independientes, la nueva Asamblea presenta el escenario más fragmentado de la historia democrática panameña.",
    image: "/images/headshots/PRES-001.jpg",
    href: "#",
  },
  {
    id: 2,
    category: "PERFIL",
    tag: "Opinión",
    title: "Tres versiones de la misma reunión: ¿a quién le creemos?",
    excerpt:
      "La divergencia entre los relatos del Ejecutivo, la oposición y la prensa revela una crisis de credibilidad institucional.",
    image: "/images/headshots/GOV-001.jpg",
    href: "#",
  },
  {
    id: 3,
    category: "NOTICIAS",
    tag: "Política",
    title: "Panamá conmemora el hecho patriótico del 9 de enero de 1964",
    excerpt:
      "Una solemne ceremonia reunió a funcionarios, diplomáticos y ciudadanos para honrar a quienes cayeron exigiendo soberanía sobre el Canal.",
    image: "/images/headshots/GOV-002.jpg",
    href: "#",
  },
];

// ─── Article cards ────────────────────────────────────────────────────────────

function LargeCard({ item }: { item: FeaturedItem }) {
  return (
    <Link
      href={item.href}
      className="group relative flex h-full min-h-[420px] overflow-hidden rounded-xl"
    >
      <img
        src={item.image}
        alt={item.title}
        className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
      <div className="relative mt-auto p-5">
        <span className="inline-block rounded-sm bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          {item.category}
        </span>
        <h2 className="mt-2 text-xl font-bold leading-snug text-white drop-shadow-md sm:text-2xl">
          {item.title}
        </h2>
        {item.excerpt && (
          <p className="mt-2 line-clamp-2 text-xs text-neutral-300 sm:text-sm">
            {item.excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}

function SmallCard({ item }: { item: FeaturedItem }) {
  return (
    <Link
      href={item.href}
      className="group relative flex h-full min-h-[180px] overflow-hidden rounded-xl"
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
        <h3 className="mt-1.5 text-sm font-bold leading-snug text-white drop-shadow-md sm:text-base">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}

// ─── Hero video card — thumbnail → click → plays inline ──────────────────────

function HeroVideoCard({
  embedSrc,
  mp4,
  thumbnail,
  originalUrl,
  handle,
  className = "",
}: {
  embedSrc: string;
  mp4?: string;       // if set, use clean native <video> instead of iframe
  thumbnail?: string;
  originalUrl?: string;
  handle: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Lazy-fetch og:image for cards without a built-in thumbnail (e.g. IG reels)
  const [fetchedThumb, setFetchedThumb] = useState<string | null>(null);
  useEffect(() => {
    if (thumbnail || !originalUrl) return;
    fetch(`/api/thumbnail?url=${encodeURIComponent(originalUrl)}`)
      .then((r) => r.json())
      .then((d) => { if (d.thumbnail) setFetchedThumb(d.thumbnail); })
      .catch(() => {});
  }, [originalUrl, thumbnail]);

  const displayThumb = thumbnail ?? fetchedThumb;

  // ── Playing: fills the card exactly where it sat ───────────────────────────
  if (playing) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-black ${className}`}>
        {mp4 ? (
          // Self-hosted: pure native video, no platform UI
          <video
            src={mp4}
            poster={displayThumb ?? undefined}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // Platform embed fallback
          <iframe
            src={embedSrc}
            title={handle}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    );
  }

  // ── Thumbnail / facade ──────────────────────────────────────────────────────
  return (
    <div
      onClick={() => setPlaying(true)}
      className={`group relative cursor-pointer overflow-hidden rounded-xl bg-black ${className}`}
    >
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 opacity-70" />

      {/* Thumbnail hierarchy — same logic as VideoSection:
          1. mp4 available + no working thumbnail → video first-frame
          2. displayThumb available (and not failed) → img
          3. imgFailed safety net covers 403s from Instagram CDN etc. */}
      {mp4 && (!displayThumb || imgFailed) ? (
        <video
          src={mp4}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onLoadedMetadata={(e) => {
            (e.currentTarget as HTMLVideoElement).currentTime = 0.1;
          }}
        />
      ) : displayThumb ? (
        <img
          src={displayThumb}
          alt={handle}
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : null}
      <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-2xl transition-transform duration-200 group-hover:scale-110">
          <Play className="ml-1 h-7 w-7 fill-black text-black" />
        </div>
      </div>

      {/* Handle badge */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-[10px] font-bold uppercase text-white ring-1 ring-white/20">
            {handle.replace("@", "").charAt(0)}
          </div>
          <span className="text-sm font-medium text-white drop-shadow">
            {handle.startsWith("@") ? handle : `@${handle}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const IG_REEL_URL = "https://www.instagram.com/reel/DVHF_WXj9SH/";

export function FeaturedHero() {
  const [, , bottom] = FEATURED;

  // Check if the IG reel has been downloaded and stored in Convex
  const storedVideos = useQuery(api.featuredVideos.list);
  const igStored = storedVideos?.find(
    (r) => r.sourceUrl === IG_REEL_URL && r.status === "done" && r.mp4Url,
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Section label */}
      <div className="mb-5 flex items-center gap-3">
        <span className="h-5 w-1 rounded-full bg-red-600" />
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--foreground)]">
          Destacados
        </h2>
      </div>

      {/* Hero grid: IG reel left | YouTube top-right | article card bottom-right */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:grid-rows-2 lg:h-[480px]">

        {/* Instagram reel — large left (uses stored mp4 once downloaded, else iframe) */}
        <div className="lg:col-span-3 lg:row-span-2 min-h-[420px]">
          <HeroVideoCard
            embedSrc="https://www.instagram.com/reel/DVHF_WXj9SH/embed/"
            mp4={igStored?.mp4Url ?? undefined}
            originalUrl={IG_REEL_URL}
            handle="@mayermm"
            className="h-full"
          />
        </div>

        {/* YouTube — top right (thumbnail auto-loaded from YouTube CDN) */}
        <div className="lg:col-span-2 lg:row-span-1 min-h-[180px]">
          <HeroVideoCard
            embedSrc="https://www.youtube.com/embed/0evoN0fImGY?autoplay=1"
            thumbnail="https://img.youtube.com/vi/0evoN0fImGY/hqdefault.jpg"
            handle="@Conferencia de Prensa"
            className="h-full"
          />
        </div>

        {/* Article card — bottom right */}
        <div className="lg:col-span-2 lg:row-span-1">
          <SmallCard item={bottom} />
        </div>
      </div>
    </section>
  );
}
