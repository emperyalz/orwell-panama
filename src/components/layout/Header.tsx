"use client";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

export function Header() {
  const { theme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img
            src={
              mounted && theme === "dark"
                ? "/icons/branding/orwell-white.svg"
                : "/icons/branding/orwell-black.svg"
            }
            alt="ORWELL"
            className="h-6 sm:h-7"
          />
          <span className="text-lg font-light tracking-[0.2em] text-[var(--muted-foreground)] select-none">
            |
          </span>
          <span className="text-sm font-semibold tracking-[0.15em] uppercase text-[var(--foreground)]">
            Política
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {session && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <Settings className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
