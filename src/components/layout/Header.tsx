"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Moon, Sun, User, LogIn, LogOut, ChevronDown } from "lucide-react";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img
            src={
              isDark
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

        {/* Right side: nav + dropdown */}
        <div className="flex items-center gap-1">
          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 mr-3">
            <Link href="/destacados" className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] hover:opacity-60 transition-opacity">
              Destacados
            </Link>
            <Link href="/" className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] hover:opacity-60 transition-opacity">
              Políticos
            </Link>
            <Link href="/noticias" className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] hover:opacity-60 transition-opacity">
              Noticias
            </Link>
            <Link href="/oficinas" className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] hover:opacity-60 transition-opacity">
              Oficinas de Gobierno
            </Link>
          </nav>

          {/* Dropdown trigger */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
              aria-label="Menú de usuario"
            >
              {mounted ? (
                isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Dropdown panel */}
            {open && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden z-50">

                {/* User info (if logged in) */}
                {session?.user && (
                  <>
                    <div className="px-4 py-3 border-b border-[var(--border)]">
                      <p className="text-xs font-semibold text-[var(--foreground)] truncate">
                        {session.user.name ?? "Admin"}
                      </p>
                      {session.user.email && (
                        <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                          {session.user.email}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Profile link */}
                <div className="py-1">
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                  >
                    <User className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    Perfil / Admin
                  </Link>

                  {/* Login / Logout */}
                  {session ? (
                    <button
                      onClick={() => { setOpen(false); signOut(); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      Cerrar sesión
                    </button>
                  ) : (
                    <button
                      onClick={() => { setOpen(false); signIn(); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                    >
                      <LogIn className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      Admin Login
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-[var(--border)]" />

                {/* Theme toggle row */}
                <div className="py-1">
                  <button
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                  >
                    {isDark ? (
                      <Sun className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    ) : (
                      <Moon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    )}
                    {isDark ? "Modo claro" : "Modo oscuro"}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
