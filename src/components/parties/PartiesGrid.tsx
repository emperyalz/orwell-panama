"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PartyCard } from "./PartyCard";

// Electoral mechanisms, not parties — always rendered last.
const MECHANISM_CODES = new Set(["IND", "LP"]);

export function PartiesGrid() {
  const parties = useQuery(api.parties.list);

  if (parties === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-pulse text-[var(--muted-foreground)]">
          Cargando partidos…
        </div>
      </div>
    );
  }

  // Real parties first (sorted by name), electoral mechanisms (IND, LP) last.
  const sorted = [...parties].sort((a, b) => {
    const aMech = MECHANISM_CODES.has(a.code);
    const bMech = MECHANISM_CODES.has(b.code);
    if (aMech !== bMech) return aMech ? 1 : -1;
    return a.name.localeCompare(b.name, "es");
  });

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((party) => (
        <PartyCard key={party._id} party={party} />
      ))}
    </div>
  );
}
