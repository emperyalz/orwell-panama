"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { DeputyVotingProfile } from "@/lib/types";
import { DashboardSection } from "./DashboardSection";

interface VotingBreakdownProps {
  profile: DeputyVotingProfile;
}

const VOTE_COLORS = {
  aFavor: "#22c55e",
  enContra: "#ef4444",
  abstencion: "#f59e0b",
};

export function VotingBreakdown({ profile }: VotingBreakdownProps) {
  const data = [
    { name: "A favor", value: profile.totalAFavor, color: VOTE_COLORS.aFavor },
    { name: "En contra", value: profile.totalEnContra, color: VOTE_COLORS.enContra },
    { name: "Abstención", value: profile.totalAbstencion, color: VOTE_COLORS.abstencion },
  ].filter((d) => d.value > 0);

  const total = profile.totalVotes;

  return (
    <DashboardSection title="Desglose de Votación">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="relative mx-auto h-52 w-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : 0;
                  return [`${v.toLocaleString()} (${Math.round((v / total) * 100)}%)`, name];
                }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--foreground)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {total.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">votos</p>
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="mt-3 flex justify-center gap-4 text-sm">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-[var(--muted-foreground)]">
                {d.name}{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardSection>
  );
}
