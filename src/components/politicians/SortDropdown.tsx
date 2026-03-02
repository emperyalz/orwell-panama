"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import type { SortOption } from "@/lib/types";

const SORT_FIELDS = [
  { key: "firstName", label: "Nombre" },
  { key: "lastName", label: "Apellido" },
  { key: "role",      label: "Cargo" },
  { key: "province",  label: "Provincia" },
  { key: "party",     label: "Partido" },
] as const;

type SortFieldKey = (typeof SORT_FIELDS)[number]["key"];

interface SortDropdownProps {
  value: SortOption | "";
  onChange: (value: SortOption | "") => void;
  variant?: "default" | "dark";
}

function parse(value: SortOption | ""): { field: SortFieldKey | null; dir: "asc" | "desc" | null } {
  if (!value || value === "rank") return { field: null, dir: null };
  const asc = value.endsWith("_asc");
  const field = value.replace(/_asc$|_desc$/, "") as SortFieldKey;
  return { field, dir: asc ? "asc" : "desc" };
}

export function SortDropdown({ value, onChange, variant = "default" }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isDark = variant === "dark";

  const { field: activeField, dir: activeDir } = parse(value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleFieldClick(key: SortFieldKey) {
    if (activeField === key) {
      // asc → desc → reset
      onChange(activeDir === "asc" ? (`${key}_desc` as SortOption) : "rank");
    } else {
      onChange(`${key}_asc` as SortOption);
    }
  }

  const triggerLabel =
    activeField
      ? `${SORT_FIELDS.find((f) => f.key === activeField)?.label} ${activeDir === "asc" ? "↑" : "↓"}`
      : "Ordenar";

  const isCustomSort = !!activeField;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
          isDark
            ? `border-[#333] bg-[#1a1a1a] ${isCustomSort ? "text-blue-400 border-blue-500/40" : "text-[#888] hover:text-white hover:bg-[#222]"}`
            : `border-[var(--border)] bg-[var(--card)] ${isCustomSort ? "text-blue-500 border-blue-500/40" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`
        }`}
      >
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">{triggerLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 min-w-[160px] overflow-hidden rounded-xl border shadow-2xl ${
            isDark ? "border-[#2a2a2a] bg-[#161616]" : "border-[var(--border)] bg-[var(--card)]"
          }`}
        >
          {/* Rango (default) */}
          <button
            onClick={() => { onChange("rank"); setOpen(false); }}
            className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${
              !isCustomSort
                ? isDark ? "bg-[#222] text-white" : "bg-[var(--accent)] text-[var(--foreground)]"
                : isDark ? "text-[#777] hover:bg-[#1f1f1f] hover:text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            }`}
          >
            <span>Rango</span>
            {!isCustomSort && <span className="text-xs text-blue-400">✓</span>}
          </button>

          <div className={`mx-3 h-px ${isDark ? "bg-[#2a2a2a]" : "bg-[var(--border)]"}`} />

          {SORT_FIELDS.map(({ key, label }) => {
            const isActive = activeField === key;
            return (
              <button
                key={key}
                onClick={() => handleFieldClick(key)}
                className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? isDark ? "bg-[#222] text-white" : "bg-[var(--accent)] text-[var(--foreground)]"
                    : isDark ? "text-[#777] hover:bg-[#1f1f1f] hover:text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                <span>{label}</span>
                <span className="flex gap-0.5 font-mono text-xs">
                  <span className={isActive && activeDir === "asc" ? "text-blue-400" : isDark ? "text-[#3a3a3a]" : "text-[var(--border)]"}>↑</span>
                  <span className={isActive && activeDir === "desc" ? "text-blue-400" : isDark ? "text-[#3a3a3a]" : "text-[var(--border)]"}>↓</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
