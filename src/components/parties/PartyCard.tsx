import { Globe } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { PLATFORM_CONFIG, getPartyLogoPath } from "@/lib/constants";

interface PartyCardProps {
  party: Doc<"parties">;
}

/** Parse a "YYYY" or "YYYY-MM-DD" founded string into year + readable label. */
function foundedInfo(foundedDate?: string): { year: number; label: string } | null {
  if (!foundedDate) return null;
  const year = parseInt(foundedDate.slice(0, 4), 10);
  if (Number.isNaN(year)) return null;

  // Full date → localized month/day; year-only → just the year.
  let label = String(year);
  if (/^\d{4}-\d{2}-\d{2}$/.test(foundedDate)) {
    const d = new Date(`${foundedDate}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      label = d.toLocaleDateString("es-PA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  }
  return { year, label };
}

export function PartyCard({ party }: PartyCardProps) {
  const logo = party.logo || getPartyLogoPath(party.code);
  const founded = foundedInfo(party.foundedDate);
  const currentYear = new Date().getFullYear();
  const years = founded ? currentYear - founded.year : null;

  const website = party.officialWebsite;
  const wikiEs =
    party.wikipediaUrls?.find((w) => w.language === "es") ??
    party.wikipediaUrls?.[0];

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-shadow hover:shadow-lg">
      {/* Party-color accent bar */}
      <div
        className="h-1.5 w-full"
        style={{
          background: party.secondaryColor
            ? `linear-gradient(90deg, ${party.color}, ${party.secondaryColor})`
            : party.color,
        }}
      />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Header: logo + names */}
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt={`Logo de ${party.name}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-tight text-[var(--foreground)]">
              {party.name}
            </h2>
            {party.fullName && party.fullName !== party.name && (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {party.fullName}
              </p>
            )}
            {founded ? (
              <p className="mt-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                Fundado en {founded.year}
                {years !== null && years >= 0 && (
                  <span className="text-[var(--foreground)]">
                    {" · "}
                    {years} {years === 1 ? "año" : "años"}
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1.5 inline-block rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Mecanismo electoral
              </p>
            )}
          </div>
        </div>

        {/* Brief */}
        {party.description && (
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            {party.description}
          </p>
        )}

        {/* Party head */}
        {party.headName && (
          <div className="mt-auto flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={party.headPhoto || "/images/placeholder.svg"}
              alt={party.headName}
              className="h-12 w-12 shrink-0 rounded-full object-cover object-top ring-2"
              style={{ ["--tw-ring-color" as string]: party.color }}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {party.headRole || "Líder"}
              </p>
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                {party.headName}
              </p>
            </div>
          </div>
        )}

        {/* Links footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
          {/* Social platform icons */}
          {party.socialAccounts?.map((acc) => {
            const config = PLATFORM_CONFIG[acc.platform];
            if (!config) return null;
            return (
              <a
                key={acc.platform}
                href={acc.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${party.name} en ${config.label}`}
                className="shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.icon}
                  alt={config.label}
                  width={20}
                  height={20}
                  className="opacity-70 transition-opacity hover:opacity-100 dark:brightness-0 dark:invert dark:opacity-50 dark:hover:opacity-80"
                />
              </a>
            );
          })}

          <div className="ml-auto flex items-center gap-3">
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                title="Sitio web oficial"
                className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <Globe className="h-[18px] w-[18px]" />
              </a>
            )}
            {wikiEs && (
              <a
                href={wikiEs.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Wikipedia"
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/official/wikipedia.svg"
                  alt="Wikipedia"
                  width={18}
                  height={18}
                  className="dark:brightness-0 dark:invert"
                />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
