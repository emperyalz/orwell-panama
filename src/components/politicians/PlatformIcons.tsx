import type { PoliticianAccount } from "@/lib/types";
import { PLATFORM_CONFIG } from "@/lib/constants";

interface PlatformIconsProps {
  accounts: PoliticianAccount[];
  size?: number;
  showLinks?: boolean;
}

export function PlatformIcons({ accounts, size = 20, showLinks = true }: PlatformIconsProps) {
  // Deduplicate by platform
  const uniquePlatforms = new Map<string, PoliticianAccount>();
  for (const account of accounts) {
    if (!uniquePlatforms.has(account.platform)) {
      uniquePlatforms.set(account.platform, account);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {Array.from(uniquePlatforms.values()).map((account) => {
        const config = PLATFORM_CONFIG[account.platform];
        if (!config) return null;

        const icon = (
          <img
            src={config.icon}
            alt={config.label}
            className="opacity-70 hover:opacity-100 transition-opacity dark:brightness-0 dark:invert dark:opacity-50 dark:hover:opacity-80"
            style={{ width: size, height: size }}
          />
        );

        if (showLinks) {
          return (
            <a
              key={account.platform}
              href={account.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`@${account.handle} on ${config.label}`}
              onClick={(e) => e.stopPropagation()}
            >
              {icon}
            </a>
          );
        }

        return <span key={account.platform}>{icon}</span>;
      })}
    </div>
  );
}
