import type { Politician } from "@/lib/types";
import { getPartyLogoPath, normalizePartyCode, PARTY_LABELS } from "@/lib/constants";

interface InfoGridProps {
  politician: Politician;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-[var(--card-foreground)]">
        {value}
      </p>
    </div>
  );
}

export function InfoGrid({ politician }: InfoGridProps) {
  const provinceValue = [politician.province, politician.district]
    .filter(Boolean)
    .join(", ");

  const circuitValue =
    politician.roleCategory === "Deputy" && politician.circuit
      ? politician.circuit
      : "N/A";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <InfoCard label="Provincia / Distrito" value={provinceValue} />
      <InfoCard label="Circuito" value={circuitValue} />
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4">
        <img
          src={getPartyLogoPath(politician.party)}
          alt={politician.partyFull}
          className="h-8 w-8 shrink-0 object-contain"
        />
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Partido
          </p>
          <p className="mt-1 text-base font-bold text-[var(--card-foreground)]">
            {politician.partyFull ?? PARTY_LABELS[normalizePartyCode(politician.party)] ?? politician.party}
          </p>
        </div>
      </div>
    </div>
  );
}
