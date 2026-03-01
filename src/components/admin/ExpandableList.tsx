"use client";

import { useState, useMemo } from "react";
import { X, Search } from "lucide-react";

interface ListItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  tags?: string[]; // For filtering (e.g. role, platform)
}

interface FilterOption {
  value: string;
  label: string;
}

interface ExpandableListProps {
  items: ListItem[];
  maxHeight?: number;
  onClose: () => void;
  searchable?: boolean;
  filterOptions?: FilterOption[];
  filterLabel?: string;
}

export function ExpandableList({
  items,
  maxHeight = 320,
  onClose,
  searchable = true,
  filterOptions,
  filterLabel = "Filter",
}: ExpandableListProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.label.toLowerCase().includes(term) ||
          item.sublabel?.toLowerCase().includes(term)
      );
    }
    if (activeFilter) {
      result = result.filter((item) =>
        item.tags?.some((t) => t === activeFilter)
      );
    }
    return result;
  }, [items, search, activeFilter]);

  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 overflow-hidden">
      {/* Header with count + close */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {filtered.length === items.length
            ? `${items.length} items`
            : `${filtered.length} of ${items.length}`}
        </span>
        <button
          onClick={onClose}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search + filter bar */}
      {(searchable || filterOptions) && (
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] py-1 pl-7 pr-2 text-[10px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
          {filterOptions && filterOptions.length > 0 && (
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[10px] text-[var(--foreground)] focus:outline-none"
            >
              <option value="">All {filterLabel}</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Scrollable list */}
      <div
        className="overflow-y-auto divide-y divide-[var(--border)]"
        style={{ maxHeight }}
      >
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--muted)]/50 transition-colors"
            >
              {item.icon && (
                <span className="text-[var(--muted-foreground)] shrink-0">
                  {item.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--foreground)] truncate">
                  {item.label}
                </p>
                {item.sublabel && (
                  <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                    {item.sublabel}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="px-3 py-4 text-center text-[10px] text-[var(--muted-foreground)]">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
