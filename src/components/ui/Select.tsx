import { ChevronDown } from "lucide-react";

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  variant?: "default" | "dark";
}

export function Select({ value, onChange, placeholder, options, variant = "default" }: SelectProps) {
  const isDark = variant === "dark";

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full appearance-none rounded-lg border px-3 pr-8 text-sm outline-none transition-colors cursor-pointer ${
          isDark
            ? "border-[#333] bg-[#1a1a1a] text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
          isDark ? "text-[#888]" : "text-[var(--muted-foreground)]"
        }`}
      />
    </div>
  );
}
