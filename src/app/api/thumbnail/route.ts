import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side thumbnail resolver.
 * Bypasses CORS so the client never has to hit social platforms directly.
 *
 * Strategy:
 *  - TikTok → public oEmbed API (returns thumbnail_url without auth)
 *  - Everyone else → fetch the page and extract og:image
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ thumbnail: null });

  const headers = {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  };

  // ── Instagram: CDN (scontent-*.cdninstagram.com) always returns 403 ────────
  // Returning null lets the frontend fall back to video-as-thumbnail instead.
  if (url.includes("instagram.com")) {
    return NextResponse.json({ thumbnail: null });
  }

  // ── TikTok oEmbed (no auth required) ──────────────────────────────────────
  if (url.includes("tiktok.com")) {
    try {
      const oembed = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (oembed.ok) {
        const data = await oembed.json();
        if (data.thumbnail_url) {
          return NextResponse.json({ thumbnail: data.thumbnail_url }, headers);
        }
      }
    } catch {
      // fall through
    }
  }

  // ── og:image via page fetch ────────────────────────────────────────────────
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Twitterbot/1.0)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return NextResponse.json({ thumbnail: null });

    const html = await res.text();

    const ogImage =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
      null;

    if (ogImage) {
      return NextResponse.json(
        { thumbnail: ogImage },
        { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
      );
    }
  } catch {
    // fall through
  }

  return NextResponse.json({ thumbnail: null });
}
