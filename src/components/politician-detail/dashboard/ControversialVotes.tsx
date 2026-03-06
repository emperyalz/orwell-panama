"use client";

import type { ControversialVoteRecord } from "@/lib/types";
import { DashboardSection } from "./DashboardSection";

interface ControversialVotesProps {
  votes: ControversialVoteRecord[];
}

function voteBadge(vote: string) {
  const labels: Record<string, string> = {
    a_favor: "A favor",
    en_contra: "En contra",
    abstencion: "Abstención",
  };
  const colors: Record<string, string> = {
    a_favor: "bg-green-500/20 text-green-400",
    en_contra: "bg-red-500/20 text-red-400",
    abstencion: "bg-amber-500/20 text-amber-400",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[vote] ?? "bg-[var(--accent)] text-[var(--foreground)]"}`}>
      {labels[vote] ?? vote}
    </span>
  );
}

export function ControversialVotes({ votes }: ControversialVotesProps) {
  if (votes.length === 0) {
    return (
      <DashboardSection title="Votos Controversiales">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          Sin votos controversiales registrados
        </div>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="Votos Controversiales">
      <div className="space-y-3">
        {votes.slice(0, 5).map((v) => {
          const total = v.totalAFavor + v.totalEnContra;
          const pctFavor = total > 0 ? (v.totalAFavor / total) * 100 : 0;
          const pctContra = total > 0 ? (v.totalEnContra / total) * 100 : 0;

          return (
            <div
              key={v.votingId}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[var(--foreground)] leading-snug line-clamp-2">
                  {v.votingTitle}
                </p>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                    v.passed
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {v.passed ? "Aprobado" : "Rechazado"}
                </span>
              </div>

              <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                {new Date(v.sessionDate).toLocaleDateString("es-PA")} — Su voto: {voteBadge(v.deputyVote)}
              </p>

              {/* Vote split bar */}
              <div className="flex h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${pctFavor}%` }}
                />
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${pctContra}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--muted-foreground)]">
                <span>{v.totalAFavor} a favor</span>
                <span>{v.totalEnContra} en contra</span>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardSection>
  );
}
