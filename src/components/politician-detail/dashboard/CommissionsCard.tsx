"use client";

import { PARTY_COLORS } from "@/lib/constants";

interface CommissionsCardProps {
  commissions: string[];
  partyCode: string;
}

export function CommissionsCard({
  commissions,
  partyCode,
}: CommissionsCardProps) {
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";

  if (commissions.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
        Comisiones
      </h3>
      <div className="flex flex-wrap gap-2">
        {commissions.map((commission) => (
          <span
            key={commission}
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: `color-mix(in srgb, ${partyColor} 30%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${partyColor} 8%, var(--card))`,
              color: "var(--foreground)",
            }}
          >
            {commission}
          </span>
        ))}
      </div>
    </div>
  );
}
