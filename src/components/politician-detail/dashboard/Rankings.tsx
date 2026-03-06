"use client";

import type { DeputyAnalyticsData, ChamberStats } from "@/lib/types";
import { PARTY_COLORS } from "@/lib/constants";
import { DashboardSection } from "./DashboardSection";

interface RankingsProps {
  analytics: DeputyAnalyticsData;
  chamberStats: ChamberStats;
  partyCode: string;
}

function PercentileBar({
  label,
  percentile,
  color,
}: {
  label: string;
  percentile: number;
  color: string;
}) {
  const topPct = Math.max(1, 100 - percentile);
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm text-[var(--muted-foreground)]">
        {label}
      </span>
      <div className="flex-1">
        <div className="h-3 w-full rounded-full bg-[var(--border)]">
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{
              width: `${percentile}%`,
              background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 60%, white))`,
            }}
          />
        </div>
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-semibold text-[var(--foreground)]">
        Top {topPct}%
      </span>
    </div>
  );
}

export function Rankings({ analytics, chamberStats, partyCode }: RankingsProps) {
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";

  const items = [
    { label: "Asistencia", percentile: analytics.attendancePercentile },
    { label: "Lealtad", percentile: analytics.loyaltyPercentile },
    { label: "Votos Emitidos", percentile: analytics.votesPercentile },
  ];

  return (
    <DashboardSection title="Rankings">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="space-y-3">
          {items.map((item) => (
            <PercentileBar
              key={item.label}
              label={item.label}
              percentile={item.percentile}
              color={partyColor}
            />
          ))}
          {analytics.provinceAttendanceRank != null &&
            analytics.provinceTotalDeputies != null && (
              <div className="mt-2 border-t border-[var(--border)] pt-3">
                <div className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-[var(--muted-foreground)]">
                    Circuito
                  </span>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    Puesto #{analytics.provinceAttendanceRank} de{" "}
                    {analytics.provinceTotalDeputies} diputados
                  </span>
                </div>
              </div>
            )}
        </div>
        <p className="mt-3 text-[10px] text-[var(--muted-foreground)]">
          Comparado con {chamberStats.totalDeputies} diputados en la Asamblea Nacional
        </p>
      </div>
    </DashboardSection>
  );
}
