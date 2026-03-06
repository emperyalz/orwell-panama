"use client";

import type { PoliticianAccount } from "@/lib/types";
import { PLATFORM_CONFIG } from "@/lib/constants";
import { DashboardSection } from "./DashboardSection";

interface SocialPresenceProps {
  accounts: PoliticianAccount[];
}

const TOTAL_PLATFORMS = 8;

const TIER_BADGES: Record<string, { emoji: string; label: string }> = {
  hot: { emoji: "\uD83D\uDD25", label: "Muy activo" },
  warm: { emoji: "\uD83C\uDF21\uFE0F", label: "Activo" },
  cool: { emoji: "\u2744\uFE0F", label: "Poco activo" },
  dormant: { emoji: "\uD83D\uDCA4", label: "Inactivo" },
};

export function SocialPresence({ accounts }: SocialPresenceProps) {
  const confirmed = accounts.filter((a) => a.verdict === "CONFIRMED").length;
  const total = accounts.length;
  const score = Math.round((total / TOTAL_PLATFORMS) * 100);

  // Get highest activity tier
  const tierOrder = ["hot", "warm", "cool", "dormant"];
  const bestTier = accounts.reduce((best, a) => {
    const currentIdx = tierOrder.indexOf(a.pollingTier);
    const bestIdx = tierOrder.indexOf(best);
    return currentIdx < bestIdx ? a.pollingTier : best;
  }, "dormant" as string);

  const badge = TIER_BADGES[bestTier] ?? TIER_BADGES.dormant;

  return (
    <DashboardSection title="Presencia Digital">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {/* Score header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Score ring */}
            <svg width={44} height={44}>
              <circle
                cx={22}
                cy={22}
                r={18}
                fill="none"
                stroke="var(--border)"
                strokeWidth={4}
              />
              <circle
                cx={22}
                cy={22}
                r={18}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={4}
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={2 * Math.PI * 18 * (1 - score / 100)}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
              />
              <text
                x={22}
                y={22}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--foreground)"
                fontSize={12}
                fontWeight="bold"
              >
                {total}
              </text>
            </svg>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {total} de {TOTAL_PLATFORMS} plataformas
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {confirmed} confirmadas
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs">
            {badge.emoji} {badge.label}
          </span>
        </div>

        {/* Platform list */}
        {accounts.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {accounts.map((a) => {
              const config = PLATFORM_CONFIG[a.platform];
              return (
                <a
                  key={`${a.platform}-${a.handle}`}
                  href={a.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 transition-colors hover:bg-[var(--accent)]"
                >
                  {config?.icon && (
                    <img
                      src={config.icon}
                      alt={config.label}
                      className="h-4 w-4"
                    />
                  )}
                  <span className="truncate text-sm text-[var(--foreground)]">
                    @{a.handle}
                  </span>
                  <span
                    className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      a.verdict === "CONFIRMED"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {a.verdict === "CONFIRMED" ? "Confirmado" : "Probable"}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </DashboardSection>
  );
}
