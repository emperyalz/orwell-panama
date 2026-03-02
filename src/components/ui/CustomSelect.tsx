"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  variant?: "default" | "dark";
  size?: "default" | "sm";
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  variant = "default",
  size = "default",
  fullWidth = true,
  disabled = false,
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isDark = variant === "dark";

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder ?? "Select…";
  const hasValue = !!value;

  // Size tokens
  const h   = size === "sm" ? "h-8"   : "h-10";
  const txt = size === "sm" ? "text-xs" : "text-sm";
  const px  = size === "sm" ? "px-2.5" : "px-3";
  const opy = size === "sm" ? "py-1.5" : "py-2";

  // Colour tokens — dark uses hardcoded palette; default uses CSS vars (light + dark mode)
  const triggerBase = isDark
    ? `border-[#333] bg-[#1a1a1a] hover:bg-[#222] ${hasValue ? "text-white" : "text-[#777]"}`
    : `border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)]/40 ${hasValue ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`;

  const chevronColor = isDark ? "text-[#555]" : "text-[var(--muted-foreground)]";

  const panelBase = isDark
    ? "border-[#2a2a2a] bg-[#161616]"
    : "border-[var(--border)] bg-[var(--background)]";

  const divider = isDark ? "bg-[#2a2a2a]" : "bg-[var(--border)]";

  function rowClass(active: boolean) {
    if (active) return isDark ? "bg-[#222] text-white" : "bg-[var(--muted)] text-[var(--foreground)]";
    return isDark
      ? "text-[#777] hover:bg-[#1f1f1f] hover:text-white"
      : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]";
  }

  return (
    <div ref={ref} className={`relative ${fullWidth ? "w-full" : "inline-block"} ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${h} ${txt} ${px} ${triggerBase} ${fullWidth ? "w-full" : ""} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""} ${chevronColor}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute left-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border shadow-2xl ${panelBase} ${fullWidth ? "w-full" : "min-w-[160px]"}`}>
          {/* Blank / placeholder option */}
          {placeholder && (
            <>
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className={`flex w-full items-center justify-between ${px} ${opy} ${txt} transition-colors ${rowClass(!value)}`}
              >
                <span>{placeholder}</span>
                {!value && <Check className="h-3 w-3 text-blue-400" />}
              </button>
              <div className={`mx-2.5 h-px ${divider}`} />
            </>
          )}

          {/* Options */}
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`flex w-full items-center justify-between ${px} ${opy} ${txt} transition-colors ${rowClass(value === opt.value)}`}
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check className="h-3 w-3 text-blue-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
