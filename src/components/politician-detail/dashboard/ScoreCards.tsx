"use client";

import type { DeputyVotingProfile, DeputyAnalyticsData, ChamberStats } from "@/lib/types";
import { PARTY_COLORS } from "@/lib/constants";

interface ScoreCardsProps {
  profile: DeputyVotingProfile;
  analytics: DeputyAnalyticsData | null;
  chamberStats: ChamberStats;
}

function getGrade(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

function CircularProgress({
  pct,
  color,
  size = 56,
}: {
  pct: number;
  color: string;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--foreground)"
        fontSize={size * 0.3}
        fontWeight="bold"
      >
        {getGrade(pct)}
      </text>
    </svg>
  );
}

export function ScoreCards({ profile, analytics, chamberStats }: ScoreCardsProps) {
  const partyColor = PARTY_COLORS[profile.partyCode] ?? "var(--foreground)";
  const attendancePct = chamberStats.totalSessions > 0
    ? Math.round((profile.sessionsAttended / chamberStats.totalSessions) * 100)
    : 0;
  const loyaltyScore = analytics?.loyaltyScore ?? 0;
  const swingCount = analytics?.swingVoteCount ?? 0;
  const votesPercentile = analytics?.votesPercentile ?? 0;

  const cards = [
    {
      label: "Asistencia",
      value: (
        <div className="flex items-center gap-3">
          <CircularProgress pct={attendancePct} color={partyColor} />
          <div>
            <span className="text-2xl font-bold">{attendancePct}%</span>
            <p className="text-xs text-[var(--muted-foreground)]">
              {profile.sessionsAttended} de {chamberStats.totalSessions} sesiones
            </p>
          </div>
        </div>
      ),
    },
    {
      label: "Lealtad Partidaria",
      value: (
        <div className="space-y-2">
          <span className="text-2xl font-bold">{loyaltyScore}%</span>
          <div className="h-2 w-full rounded-full bg-[var(--border)]">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${loyaltyScore}%`,
                backgroundColor: partyColor,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      label: "Votos Decisivos",
      value: (
        <div>
          <span className="text-3xl font-bold">{swingCount}</span>
          <p className="text-xs text-[var(--muted-foreground)]">
            proyectos de ley
          </p>
        </div>
      ),
    },
    {
      label: "Votos Totales",
      value: (
        <div>
          <span className="text-3xl font-bold">
            {profile.totalVotes.toLocaleString()}
          </span>
          {votesPercentile > 0 && (
            <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium">
              Top {100 - votesPercentile}%
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            {card.label}
          </p>
          {card.value}
        </div>
      ))}
    </div>
  );
}
