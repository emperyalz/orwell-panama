"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  variant?: "default" | "dark";
}

export function SearchBar({ value, onChange, variant = "default" }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(newValue), 300);
  };

  const isDark = variant === "dark";

  return (
    <div className="relative">
      <Search
        className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
          isDark ? "text-[#888]" : "text-[var(--muted-foreground)]"
        }`}
      />
      <input
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Buscar por nombre..."
        className={`h-10 w-full rounded-lg border pl-9 pr-9 text-sm outline-none transition-colors ${
          isDark
            ? "border-[#333] bg-[#1a1a1a] text-white placeholder-[#666] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        }`}
      />
      {localValue && (
        <button
          onClick={() => handleChange("")}
          className={`absolute right-3 top-1/2 -translate-y-1/2 ${
            isDark
              ? "text-[#888] hover:text-white"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
