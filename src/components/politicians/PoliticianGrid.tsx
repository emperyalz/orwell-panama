"use client";

import { useFilters } from "@/hooks/useFilters";
import { SearchBar } from "./SearchBar";
import { FilterBar } from "./FilterBar";
import { PoliticianCard } from "./PoliticianCard";
import type { Politician } from "@/lib/types";
import { Users } from "lucide-react";

interface PoliticianGridProps {
  politicians: Politician[];
  parties: string[];
  provinces: string[];
}

export function PoliticianGrid({
  politicians,
  parties,
  provinces,
}: PoliticianGridProps) {
  const { filters, setFilter, resetFilters, filtered, hasActiveFilters } =
    useFilters(politicians);

  return (
    <div className="space-y-6">
      {/* Search + Filters */}
      <div className="space-y-4">
        <SearchBar
          value={filters.search}
          onChange={(v) => setFilter("search", v)}
        />
        <FilterBar
          filters={filters}
          onFilterChange={setFilter}
          onReset={resetFilters}
          hasActiveFilters={hasActiveFilters}
          parties={parties}
          provinces={provinces}
        />
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Users className="h-4 w-4" />
        <span>
          {hasActiveFilters
            ? `Mostrando ${filtered.length} de ${politicians.length} políticos`
            : `${politicians.length} políticos`}
        </span>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((politician) => (
            <PoliticianCard key={politician.id} politician={politician} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16">
          <Users className="h-12 w-12 text-[var(--muted-foreground)] opacity-50" />
          <p className="mt-4 text-lg font-medium text-[var(--muted-foreground)]">
            No se encontraron resultados
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Intenta con otros filtros o términos de búsqueda
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
