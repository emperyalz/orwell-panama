"use client";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img
            src="/icons/official/coat-of-arms.svg"
            alt="Escudo de Panamá"
            className="h-10 w-10"
          />
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--foreground)]">
              Orwell Panamá
            </h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              Directorio de Políticos
            </p>
          </div>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
