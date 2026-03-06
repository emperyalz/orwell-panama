"use client";

import type { AllyRival } from "@/lib/types";
import { PARTY_COLORS, PARTY_LABELS } from "@/lib/constants";
import { DashboardSection } from "./DashboardSection";

interface VotingAlignmentProps {
  allies: AllyRival[];
  rivals: AllyRival[];
  ownPartyCode: string;
}

function AlignmentBar({
  items,
  ownPartyCode,
}: {
  items: AllyRival[];
  ownPartyCode: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">Sin datos disponibles</p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const partyColor = PARTY_COLORS[item.partyCode] ?? "var(--muted-foreground)";
        const isCrossParty = item.partyCode !== ownPartyCode;

        return (
          <div key={item.deputyId} className="flex items-center gap-2">
            <div className="w-28 shrink-0 truncate text-sm text-[var(--foreground)]">
              {item.deputyName.split(" ").slice(0, 2).join(" ")}
              {isCrossParty && (
                <span className="ml-1 text-amber-400" title="Otro partido">
                  ✦
                </span>
              )}
            </div>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, ${partyColor} 20%, transparent)`,
                color: partyColor,
              }}
            >
              {item.partyCode}
            </span>
            <div className="flex-1">
              <div className="h-2 w-full rounded-full bg-[var(--border)]">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${item.agreementPct}%`,
                    backgroundColor: partyColor,
                  }}
                />
              </div>
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-medium text-[var(--foreground)]">
              {item.agreementPct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function VotingAlignment({ allies, rivals, ownPartyCode }: VotingAlignmentProps) {
  if (allies.length === 0 && rivals.length === 0) {
    return (
      <DashboardSection title="Alineación de Votación">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          Sin datos de alineación disponibles
        </div>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="Alineación de Votación">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-green-400">
            Aliados — Mayor coincidencia
          </h3>
          <AlignmentBar items={allies} ownPartyCode={ownPartyCode} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-red-400">
            Opuestos — Menor coincidencia
          </h3>
          <AlignmentBar items={rivals} ownPartyCode={ownPartyCode} />
        </div>
      </div>
    </DashboardSection>
  );
}
