"use client";

import { Zap } from "lucide-react";
import type { SwingVoteRecord } from "@/lib/types";
import { DashboardSection } from "./DashboardSection";

interface SwingVotesProps {
  votes: SwingVoteRecord[];
}

export function SwingVotes({ votes }: SwingVotesProps) {
  if (votes.length === 0) {
    return (
      <DashboardSection title="Votos Decisivos">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          Sin votos decisivos registrados
        </div>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="Votos Decisivos">
      <div className="space-y-3">
        {votes.slice(0, 5).map((v) => (
          <div
            key={v.votingId}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <p className="text-sm font-medium text-[var(--foreground)] leading-snug line-clamp-2">
              {v.votingTitle}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {new Date(v.sessionDate).toLocaleDateString("es-PA")}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                Aprobado por {v.totalAFavor} votos — umbral: 36
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <Zap size={12} />
              Su voto fue decisivo
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
