"use client";

import { RotateCcw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { ROLE_CATEGORIES } from "@/lib/constants";
import type { FilterState, RoleCategory } from "@/lib/types";

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  parties: string[];
  provinces: string[];
}

export function FilterBar({
  filters,
  onFilterChange,
  onReset,
  hasActiveFilters,
  parties,
  provinces,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filters.role}
        onChange={(v) => onFilterChange("role", v as RoleCategory | "")}
        placeholder="Cargo"
        options={ROLE_CATEGORIES.map((r) => ({ value: r.value, label: r.label }))}
      />
      <Select
        value={filters.province}
        onChange={(v) => onFilterChange("province", v)}
        placeholder="Provincia"
        options={provinces.map((p) => ({ value: p, label: p }))}
      />
      <Select
        value={filters.party}
        onChange={(v) => onFilterChange("party", v)}
        placeholder="Partido"
        options={parties.map((p) => ({ value: p, label: p }))}
      />
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpiar
        </button>
      )}
    </div>
  );
}
