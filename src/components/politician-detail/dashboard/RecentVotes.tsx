"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { VoteRecord } from "@/lib/types";
import { DashboardSection } from "./DashboardSection";

interface RecentVotesProps {
  votes: VoteRecord[];
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
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
        colors[vote] ?? "bg-[var(--accent)] text-[var(--foreground)]"
      }`}
    >
      {labels[vote] ?? vote}
    </span>
  );
}

export function RecentVotes({ votes }: RecentVotesProps) {
  const [search, setSearch] = useState("");
  const [showCount, setShowCount] = useState(10);

  const filtered = useMemo(() => {
    if (!search) return votes;
    const term = search.toLowerCase();
    return votes.filter(
      (v) =>
        v.votingTitle.toLowerCase().includes(term) ||
        v.questionText.toLowerCase().includes(term)
    );
  }, [votes, search]);

  const visible = filtered.slice(0, showCount);

  if (votes.length === 0) {
    return (
      <DashboardSection title="Votos Recientes">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          Sin votos registrados
        </div>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="Votos Recientes">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowCount(10);
            }}
            placeholder="Buscar por título o contenido..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-blue-500"
          />
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                <th className="pb-2 text-left font-medium">Fecha</th>
                <th className="pb-2 text-left font-medium">Proyecto</th>
                <th className="pb-2 text-center font-medium">Voto</th>
                <th className="pb-2 text-center font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((v, i) => (
                <tr
                  key={`${v.votingId}-${v.questionId}-${i}`}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="py-2 pr-2 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                    {new Date(v.sessionDate).toLocaleDateString("es-PA", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-2 text-[var(--foreground)]">
                    <span className="line-clamp-1">{v.votingTitle}</span>
                  </td>
                  <td className="py-2 text-center">{voteBadge(v.vote)}</td>
                  <td className="py-2 text-center">
                    <span
                      className={`text-xs font-medium ${
                        v.questionPassed ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {v.questionPassed ? "Aprobado" : "Rechazado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-2 sm:hidden">
          {visible.map((v, i) => (
            <div
              key={`${v.votingId}-${v.questionId}-${i}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
            >
              <p className="text-sm font-medium text-[var(--foreground)] line-clamp-2">
                {v.votingTitle}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {new Date(v.sessionDate).toLocaleDateString("es-PA")}
                </span>
                <div className="flex items-center gap-2">
                  {voteBadge(v.vote)}
                  <span
                    className={`text-xs font-medium ${
                      v.questionPassed ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {v.questionPassed ? "Aprobado" : "Rechazado"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load more */}
        {showCount < filtered.length && (
          <button
            onClick={() => setShowCount((c) => c + 10)}
            className="mt-3 w-full rounded-lg border border-[var(--border)] py-2 text-center text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            Cargar más ({filtered.length - showCount} restantes)
          </button>
        )}
      </div>
    </DashboardSection>
  );
}
