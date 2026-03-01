import Link from "next/link";
import type { Politician } from "@/lib/types";
import { PartyBadge } from "@/components/ui/PartyBadge";
import { PlatformIcons } from "./PlatformIcons";
import { MapPin } from "lucide-react";

interface PoliticianListItemProps {
  politician: Politician;
}

export function PoliticianListItem({ politician }: PoliticianListItemProps) {
  return (
    <Link
      href={`/politician/${politician.id}`}
      className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 hover:shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
    >
      {/* Headshot thumbnail */}
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--muted)]">
        <img
          src={
            politician.hasHeadshot
              ? politician.headshot
              : "/images/placeholder.svg"
          }
          alt={politician.name}
          className="h-full w-full object-cover object-top"
          loading="lazy"
        />
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-[var(--card-foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
          {politician.name}
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] truncate">
          {politician.role}
        </p>
      </div>

      {/* Party badge */}
      <div className="hidden sm:block shrink-0">
        <PartyBadge party={politician.party} />
      </div>

      {/* Province */}
      <div className="hidden md:flex items-center gap-1 text-xs text-[var(--muted-foreground)] shrink-0 max-w-[140px]">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{politician.province}</span>
      </div>

      {/* Platform icons */}
      <div className="hidden lg:block shrink-0">
        <PlatformIcons
          accounts={politician.accounts}
          size={16}
          showLinks={false}
        />
      </div>

      {/* Official links icons */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        {politician.officialGovUrl && (
          <img
            src="/icons/official/asamblea-nacional.png"
            alt="Perfil oficial"
            className="h-3.5 w-3.5 opacity-50"
          />
        )}
        {politician.wikipediaUrl && (
          <img
            src="/icons/official/wikipedia.svg"
            alt="Wikipedia"
            className="h-3.5 w-3.5 opacity-50 dark:invert"
          />
        )}
        {politician.personalWebsite && (
          <img
            src="/icons/official/website.svg"
            alt="Sitio Web"
            className="h-3.5 w-3.5 opacity-50 dark:invert"
          />
        )}
      </div>
    </Link>
  );
}
