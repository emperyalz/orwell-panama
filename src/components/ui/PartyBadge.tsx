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

  return (
    <div className="flex items-center gap-1.5">
      <img
        src={`/icons/parties/${party.toLowerCase()}.svg`}
        alt={party}
        className={sizeClasses[size]}
      />
      <span className={`font-medium text-[var(--foreground)] ${textSizeClasses[size]}`}>
        {showFull && partyFull ? partyFull : party}
      </span>
    </div>
  );
}
