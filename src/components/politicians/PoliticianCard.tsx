import Link from "next/link";
import type { Politician } from "@/lib/types";
import { PartyBadge } from "@/components/ui/PartyBadge";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { PlatformIcons } from "./PlatformIcons";
import { MapPin } from "lucide-react";

interface PoliticianCardProps {
  politician: Politician;
}

export function PoliticianCard({ politician }: PoliticianCardProps) {
  return (
    <Link
      href={`/politician/${politician.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
    >
      {/* Headshot */}
      <div className="relative aspect-square overflow-hidden bg-[var(--muted)]">
        <img
          src={politician.hasHeadshot ? politician.headshot : "/images/placeholder.svg"}
          alt={politician.name}
          className="h-full w-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* Role badge overlay */}
        <div className="absolute bottom-2 left-2">
          <RoleBadge role={politician.role} roleCategory={politician.roleCategory} />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Name */}
        <h3 className="text-sm font-semibold leading-tight text-[var(--card-foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
          {politician.name}
        </h3>

        {/* Party */}
        <PartyBadge party={politician.party} />

        {/* Province */}
        <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {politician.province}
            {politician.district ? ` (${politician.district})` : ""}
          </span>
        </div>

        {/* Platform icons */}
        <div className="mt-auto pt-2 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <PlatformIcons accounts={politician.accounts} size={18} showLinks={false} />
            <div className="flex items-center gap-1.5">
              {politician.officialGovUrl && (
                <img
                  src="/icons/official/asamblea-nacional.png"
                  alt="Perfil oficial"
                  className="h-4 w-4 opacity-50"
                />
              )}
              {politician.wikipediaUrl && (
                <img
                  src="/icons/official/wikipedia.svg"
                  alt="Wikipedia"
                  className="h-4 w-4 opacity-50 dark:invert"
                />
              )}
              {politician.personalWebsite && (
                <img
                  src="/icons/official/website.svg"
                  alt="Sitio Web"
                  className="h-4 w-4 opacity-50 dark:invert"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
