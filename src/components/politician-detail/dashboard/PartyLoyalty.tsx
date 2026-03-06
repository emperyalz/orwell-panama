"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DeputyAnalyticsData } from "@/lib/types";
import { PARTY_COLORS } from "@/lib/constants";
import { DashboardSection } from "./DashboardSection";

interface PartyLoyaltyProps {
  analytics: DeputyAnalyticsData;
  partyCode: string;
}

const VOTE_LABELS: Record<string, string> = {
  a_favor: "A favor",
  en_contra: "En contra",
  abstencion: "Abstención",
};

function voteBadgeColor(vote: string) {
  if (vote === "a_favor") return "bg-green-500/20 text-green-400";
  if (vote === "en_contra") return "bg-red-500/20 text-red-400";
  return "bg-amber-500/20 text-amber-400";
}

export function PartyLoyalty({ analytics, partyCode }: PartyLoyaltyProps) {
  const [showDissent, setShowDissent] = useState(false);
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";

  return (
    <DashboardSection title="Lealtad Partidaria">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {/* Gauge */}
        <div className="mb-4">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-[var(--foreground)]">
              {analytics.loyaltyScore}%
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {analytics.dissentCount} voto{analytics.dissentCount !== 1 ? "s" : ""} en disidencia
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-[var(--border)]">
            <div
              className="h-3 rounded-full transition-all duration-700"
              style={{
                width: `${analytics.loyaltyScore}%`,
                backgroundColor: partyColor,
              }}
            />
          </div>
        </div>

        {/* Dissent list */}
        {analytics.dissentVotes.length > 0 && (
          <div>
            <button
              onClick={() => setShowDissent(!showDissent)}
              className="flex w-full items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {showDissent ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Votos en disidencia ({analytics.dissentVotes.length})
            </button>

            {showDissent && (
              <div className="mt-3 space-y-2">
                {analytics.dissentVotes.map((dv) => (
                  <div
                    key={dv.votingId}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
                  >
                    <p className="text-sm font-medium text-[var(--foreground)] leading-snug">
                      {dv.votingTitle}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {new Date(dv.sessionDate).toLocaleDateString("es-PA")}
                    </p>
                    <p className="mt-2 text-xs">
                      Votó{" "}
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${voteBadgeColor(dv.deputyVote)}`}>
                        {VOTE_LABELS[dv.deputyVote] ?? dv.deputyVote}
                      </span>{" "}
                      cuando su partido votó{" "}
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${voteBadgeColor(dv.partyMajorityVote)}`}>
                        {VOTE_LABELS[dv.partyMajorityVote] ?? dv.partyMajorityVote}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardSection>
  );
}
