"use client";

import { RotateCcw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { SortDropdown } from "./SortDropdown";
import { ROLE_CATEGORIES } from "@/lib/constants";
import type { FilterState, RoleCategory, SortOption } from "@/lib/types";

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  parties: string[];
  provinces: string[];
  variant?: "default" | "dark";
}

export function FilterBar({
  filters,
  onFilterChange,
  onReset,
  hasActiveFilters,
  parties,
  provinces,
  variant = "default",
}: FilterBarProps) {
  const isDark = variant === "dark";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filters.role}
        onChange={(v) => onFilterChange("role", v as RoleCategory | "")}
        placeholder="Cargo"
        options={ROLE_CATEGORIES.map((r) => ({ value: r.value, label: r.label }))}
        variant={variant}
        fullWidth={false}
      />
      <Select
        value={filters.province}
        onChange={(v) => onFilterChange("province", v)}
        placeholder="Provincia"
        options={provinces.map((p) => ({ value: p, label: p }))}
        variant={variant}
        fullWidth={false}
      />
      <Select
        value={filters.party}
        onChange={(v) => onFilterChange("party", v)}
        placeholder="Partido"
        options={parties.map((p) => ({ value: p, label: p }))}
        variant={variant}
        fullWidth={false}
      />
      <SortDropdown
        value={filters.sort}
        onChange={(v) => onFilterChange("sort", v as SortOption | "")}
        variant={variant}
      />
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
            isDark
              ? "border-[#333] bg-[#1a1a1a] text-[#888] hover:text-white hover:bg-[#222]"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
          }`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpiar
        </button>
      )}
    </div>
  );
}
