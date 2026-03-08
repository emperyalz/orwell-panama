import type { Politician } from "@/lib/types";
import { PARTY_COLORS } from "@/lib/constants";

interface HeroSectionProps {
  politician: Politician;
}

export function HeroSection({ politician }: HeroSectionProps) {
  const partyColor = PARTY_COLORS[politician.party] ?? PARTY_COLORS.IND;

  return (
    <section
      className="relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${partyColor} 10%, var(--card)) 0%, var(--card) 100%)`,
      }}
    >
      <div className="flex flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:items-start sm:gap-10 sm:px-10 sm:py-12">
        {/* Headshot */}
        <div className="shrink-0">
          <img
            src={politician.hasHeadshot ? politician.headshot : "/images/placeholder.svg"}
            alt={politician.name}
            className="w-[180px] sm:w-[220px] rounded-2xl border-4 border-[var(--border)] bg-[var(--muted)] object-cover shadow-lg"
          />
        </div>

        {/* Info */}
        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            {politician.name}
          </h1>

          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: partyColor }}
          >
            {politician.role}
          </span>

          <p className="text-lg font-medium text-[var(--card-foreground)]">
            {politician.partyFull}
          </p>

          <p className="text-sm text-[var(--muted-foreground)]">
            {politician.province}
            {politician.district ? ` — ${politician.district}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
