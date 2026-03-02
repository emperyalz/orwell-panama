"use client";

import { useState } from "react";
import { useFilters } from "@/hooks/useFilters";
import { SearchBar } from "./SearchBar";
import { FilterBar } from "./FilterBar";
import { PoliticianCard } from "./PoliticianCard";
import { PoliticianListItem } from "./PoliticianListItem";
import type { Politician } from "@/lib/types";
import { Users, LayoutGrid, List } from "lucide-react";

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
  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");

  return (
    <div>
      {/* ─── Black strip — full-width search + filters ─── */}
      <div className="bg-[#111] border-b border-[#222]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-3">
            {/* Left group: search stacked above filters, width = filter bar width */}
            <div className="flex flex-col gap-3">
              <SearchBar
                value={filters.search}
                onChange={(v) => setFilter("search", v)}
                variant="dark"
              />
              <FilterBar
                filters={filters}
                onFilterChange={setFilter}
                onReset={resetFilters}
                hasActiveFilters={hasActiveFilters}
                parties={parties}
                provinces={provinces}
                variant="dark"
              />
            </div>
            {/* View mode toggle — right-aligned */}
            <div className="flex flex-shrink-0 items-center rounded-lg border border-[#333] bg-[#1a1a1a] p-0.5">
              <button
                onClick={() => setViewMode("gallery")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "gallery"
                    ? "bg-white text-black"
                    : "text-[#888] hover:text-white"
                }`}
                title="Vista galería"
                aria-label="Vista galería"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "list"
                    ? "bg-white text-black"
                    : "text-[#888] hover:text-white"
                }`}
                title="Vista lista"
                aria-label="Vista lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Results + grid — constrained ─── */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Users className="h-4 w-4" />
          <span>
            {hasActiveFilters
              ? `Mostrando ${filtered.length} de ${politicians.length} políticos`
              : `${politicians.length} políticos`}
          </span>
        </div>

        {/* Grid / List */}
        {filtered.length > 0 ? (
          viewMode === "gallery" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((politician) => (
                <PoliticianCard key={politician.id} politician={politician} />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((politician) => (
                <PoliticianListItem
                  key={politician.id}
                  politician={politician}
                />
              ))}
            </div>
          )
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
    </div>
  );
}
