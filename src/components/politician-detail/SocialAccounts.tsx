import type { PoliticianAccount } from "@/lib/types";
import { PLATFORM_CONFIG } from "@/lib/constants";

interface SocialAccountsProps {
  accounts: PoliticianAccount[];
}

function VerdictBadge({ verdict }: { verdict: PoliticianAccount["verdict"] }) {
  const isConfirmed = verdict === "CONFIRMED";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isConfirmed
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      }`}
    >
      {isConfirmed ? "Confirmado" : "Probable"}
    </span>
  );
}

export function SocialAccounts({ accounts }: SocialAccountsProps) {
  if (!accounts?.length) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
        Redes Sociales
      </h2>

      <div className="space-y-2">
        {accounts.map((account) => {
          const config = PLATFORM_CONFIG[account.platform];
          if (!config) return null;

          return (
            <a
              key={`${account.platform}-${account.handle}`}
              href={account.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors hover:bg-[var(--accent)]"
            >
              <img
                src={config.icon}
                alt={config.label}
                className="h-6 w-6 shrink-0"
              />

              <span className="flex-1 text-sm font-medium text-[var(--card-foreground)]">
                @{account.handle}
              </span>

              <VerdictBadge verdict={account.verdict} />
            </a>
          );
        })}
      </div>
    </section>
  );
}
