import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { normalizePartyCode, PARTY_LABELS } from "@/lib/constants";

export const runtime = "edge";
export const alt = "Político — ORWELL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Fetch an image as a data-URI (base64). Returns null on failure. */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/png";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch politician + party data in parallel
  const [doc, parties] = await Promise.all([
    fetchQuery(api.politicians.getByExternalId, { externalId: id }),
    fetchQuery(api.parties.list, {}),
  ]);

  if (!doc) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFFFFF",
            color: "#111827",
            fontSize: 48,
            fontFamily: "sans-serif",
          }}
        >
          ORWELL | POLITICA
        </div>
      ),
      { ...size }
    );
  }

  // Get party data from DB (normalise alias codes like PA→ALZ)
  const normalisedCode = normalizePartyCode(doc.party);
  const party = parties.find((p) => p.code === normalisedCode);
  const primaryColor = party?.color ?? "#374151";
  const secondaryColor = party?.secondaryColor ?? primaryColor;

  // Build base URL for static assets
  const baseUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://orwell-panama.vercel.app";

  // Fetch images in parallel
  const headshotUrl = doc.hasHeadshot ? `${baseUrl}${doc.headshot}` : null;
  const partyLogoUrl = party?.logo ? `${baseUrl}${party.logo}` : null;
  const sealUrl = `${baseUrl}/icons/official/asamblea-nacional.png`;
  const [headshotSrc, partyLogoSrc, sealSrc] = await Promise.all([
    headshotUrl ? fetchAsDataUri(headshotUrl) : Promise.resolve(null),
    partyLogoUrl ? fetchAsDataUri(partyLogoUrl) : Promise.resolve(null),
    fetchAsDataUri(sealUrl),
  ]);

  const location = [doc.province, doc.district].filter(Boolean).join(" — ");
  const circuit = doc.circuit ? `Circuito ${doc.circuit}` : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          backgroundColor: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left accent bar — dual-color gradient */}
        <div
          style={{
            width: 8,
            height: "100%",
            background: `linear-gradient(to bottom, ${primaryColor}, ${secondaryColor})`,
          }}
        />

        {/* Headshot area */}
        <div
          style={{
            width: 340,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
        >
          {headshotSrc ? (
            <div
              style={{
                display: "flex",
                position: "relative",
                width: 264,
                height: 344,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                padding: 4,
              }}
            >
              {/* Headshot image — clipped by overflow hidden wrapper */}
              <div
                style={{
                  display: "flex",
                  width: 256,
                  height: 336,
                  borderRadius: 17,
                  overflow: "hidden",
                }}
              >
                <img
                  src={headshotSrc}
                  alt={doc.name}
                  width={256}
                  height={336}
                  style={{
                    objectFit: "cover",
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 264,
                height: 344,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 80,
              }}
            >
              ?
            </div>
          )}
        </div>

        {/* Right: text info */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "40px 50px 40px 10px",
            gap: 14,
          }}
        >
          {/* Name + Assembly seal */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                fontSize: 50,
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.1,
              }}
            >
              {doc.name}
            </div>
            {sealSrc && (
              <img
                src={sealSrc}
                alt="Asamblea Nacional"
                width={44}
                height={48}
                style={{ marginTop: 2 }}
              />
            )}
          </div>

          {/* Role badge — outline/stroke style */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                color: primaryColor,
                fontSize: 22,
                fontWeight: 600,
                padding: "5px 20px",
                borderRadius: 999,
                border: `2.5px solid ${primaryColor}`,
                backgroundColor: "transparent",
              }}
            >
              {doc.role}
            </div>
          </div>

          {/* Party logo + name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {partyLogoSrc && (
              <img
                src={partyLogoSrc}
                alt={doc.party}
                width={30}
                height={30}
                style={{ borderRadius: 4 }}
              />
            )}
            <div
              style={{
                fontSize: 28,
                color: "#374151",
                fontWeight: 500,
              }}
            >
              {doc.partyFull}
            </div>
          </div>

          {/* Location */}
          {location && (
            <div
              style={{
                fontSize: 24,
                color: "#6B7280",
              }}
            >
              {location}
            </div>
          )}

          {/* Circuit */}
          {circuit && (
            <div
              style={{
                fontSize: 22,
                color: "#9CA3AF",
              }}
            >
              {circuit}
            </div>
          )}

          {/* Branding — ORWELL | POLÍTICA */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: 0.25,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: "#131519",
                letterSpacing: 4,
              }}
            >
              ORWELL
            </span>
            <span
              style={{
                fontSize: 20,
                color: "#131519",
                fontWeight: 200,
              }}
            >
              |
            </span>
            <span
              style={{
                fontSize: 17,
                color: "#131519",
                letterSpacing: 3,
                fontWeight: 400,
              }}
            >
              POLÍTICA
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
