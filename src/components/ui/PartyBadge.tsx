/** Map party code → logo file (mixed formats from Wikipedia/official sources). */
const PARTY_LOGOS: Record<string, string> = {
  cd: "/icons/parties/cd.png",
  prd: "/icons/parties/prd.png",
  pan: "/icons/parties/pan.png",
  lp: "/icons/parties/lp.svg",
  rm: "/icons/parties/rm.png",
  moca: "/icons/parties/moca.svg",
  pp: "/icons/parties/pp.png",
  molirena: "/icons/parties/molirena.png",
  alz: "/icons/parties/alz.jpg",
  ind: "/icons/parties/ind.svg",
};

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

  const logoPath =
    PARTY_LOGOS[party.toLowerCase()] ??
    `/icons/parties/${party.toLowerCase()}.svg`;

  return (
    <div className="flex items-center gap-1.5">
      <img
        src={logoPath}
        alt={party}
        className={`${sizeClasses[size]} object-contain`}
      />
      <span className={`font-medium text-[var(--foreground)] ${textSizeClasses[size]}`}>
        {showFull && partyFull ? partyFull : party}
      </span>
    </div>
  );
}
