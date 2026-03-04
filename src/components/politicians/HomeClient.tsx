"use client";

import { useState } from "react";
import { useFilters } from "@/hooks/useFilters";
import { SearchBar } from "./SearchBar";
import { FilterBar } from "./FilterBar";
import { PoliticianCard } from "./PoliticianCard";
import { PoliticianListItem } from "./PoliticianListItem";
import { GovernmentChart } from "./GovernmentChart";
import type { Politician } from "@/lib/types";
import { Users, LayoutGrid, List } from "lucide-react";

interface PartySlice {
  code: string;
  count: number;
  color: string;
}

interface GovTier {
  label: string;
  sublabel: string;
  total: number;
  slices: PartySlice[];
  comingSoon?: boolean;
}

interface HomeClientProps {
  politicians: Politician[];
  parties: string[];
  provinces: string[];
  govTiers: GovTier[];
}

export function HomeClient({
  politicians,
  parties,
  provinces,
  govTiers,
}: HomeClientProps) {
  const { filters, setFilter, resetFilters, filtered, hasActiveFilters } =
    useFilters(politicians);
  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");

  return (
    <div>
      {/* ─── Single combined dark strip: left = title + search + filters | right = chart ─── */}
      <div className="bg-[#111] border-b border-[#222]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12">

            {/* Left column — content pushed to bottom so filters sit at pb-6 (matching original) */}
            <div className="flex flex-col justify-end gap-4 pt-8 pb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  Directorio de Políticos de Panamá
                </h1>
                <p className="mt-2 text-xs text-neutral-400">
                  Inteligencia basada en datos, impulsada por el repositorio más completo de política panameña
                </p>
              </div>

              <SearchBar
                value={filters.search}
                onChange={(v) => setFilter("search", v)}
                variant="dark"
              />

              <div className="flex items-center justify-between gap-3">
                <FilterBar
                  filters={filters}
                  onFilterChange={setFilter}
                  onReset={resetFilters}
                  hasActiveFilters={hasActiveFilters}
                  parties={parties}
                  provinces={provinces}
                  variant="dark"
                />
                {/* View mode toggle */}
                <div className="flex shrink-0 items-center rounded-lg border border-[#333] bg-[#1a1a1a] p-0.5">
                  <button
                    onClick={() => setViewMode("gallery")}
                    className={`rounded-md p-1.5 transition-colors ${
                      viewMode === "gallery" ? "bg-white text-black" : "text-[#888] hover:text-white"
                    }`}
                    title="Vista galería"
                    aria-label="Vista galería"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`rounded-md p-1.5 transition-colors ${
                      viewMode === "list" ? "bg-white text-black" : "text-[#888] hover:text-white"
                    }`}
                    title="Vista lista"
                    aria-label="Vista lista"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Mobile/tablet chart — sits below filters, inside dark strip, hidden on desktop */}
              <div className="lg:hidden pt-2 pb-2">
                <GovernmentChart tiers={govTiers} />
              </div>
            </div>

            {/* Right column — desktop chart, bottom-aligned to match left pb-6 */}
            <div className="hidden lg:flex flex-col justify-end pb-6 pt-4">
              <GovernmentChart tiers={govTiers} />
            </div>

          </div>
        </div>
      </div>

      {/* ─── Results grid ─── */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Users className="h-4 w-4" />
          <span>
            {hasActiveFilters
              ? `Mostrando ${filtered.length} de ${politicians.length} políticos`
              : `${politicians.length} políticos`}
          </span>
        </div>

        {filtered.length > 0 ? (
          viewMode === "gallery" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => (
                <PoliticianCard key={p.id} politician={p} />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((p) => (
                <PoliticianListItem key={p.id} politician={p} />
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
