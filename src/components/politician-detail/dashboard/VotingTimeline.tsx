"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { MonthlyVotingStat } from "@/lib/types";
import { PARTY_COLORS } from "@/lib/constants";
import { DashboardSection } from "./DashboardSection";

interface VotingTimelineProps {
  monthlyStats: MonthlyVotingStat[];
  partyCode: string;
}

export function VotingTimeline({ monthlyStats, partyCode }: VotingTimelineProps) {
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";

  // Format month labels: "2024-01" → "Ene 24"
  const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const data = monthlyStats.map((m) => {
    const [year, month] = m.month.split("-");
    return {
      ...m,
      label: `${MONTHS_ES[parseInt(month, 10) - 1]} ${year.slice(2)}`,
    };
  });

  if (data.length === 0) {
    return (
      <DashboardSection title="Tendencia de Votación">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          Sin datos de tendencia disponibles
        </div>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="Tendencia de Votación">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="partyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={partyColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={partyColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
                fontSize: 12,
              }}
              formatter={(value) => [`${typeof value === "number" ? value : 0}%`, "% A favor"]}
              labelFormatter={(label) => label}
            />
            <Area
              type="monotone"
              dataKey="pctAFavor"
              stroke={partyColor}
              strokeWidth={2}
              fill="url(#partyGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashboardSection>
  );
}
