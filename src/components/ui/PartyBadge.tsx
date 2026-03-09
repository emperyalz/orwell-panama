import { getPartyLogoPath, normalizePartyCode, PARTY_LABELS } from "@/lib/constants";

interface PartyBadgeProps {
  party: string;
  partyFull?: string;
  size?: "sm" | "md" | "lg";
  showFull?: boolean;
}

export function PartyBadge({
  party,
  partyFull,
  size = "sm",
  showFull = false,
}: PartyBadgeProps) {
  const sizeClasses = {
    sm: "h-5 w-5 text-[10px]",
    md: "h-6 w-6 text-xs",
    lg: "h-8 w-8 text-sm",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const normalised = normalizePartyCode(party);
  const logoPath = getPartyLogoPath(party);
  const label = showFull
    ? partyFull ?? PARTY_LABELS[normalised] ?? normalised
    : normalised;

  return (
    <div className="flex items-center gap-1.5">
      <img
        src={logoPath}
        alt={normalised}
        className={`${sizeClasses[size]} object-contain`}
      />
      <span className={`font-medium text-[var(--foreground)] ${textSizeClasses[size]}`}>
        {label}
      </span>
    </div>
  );
}
