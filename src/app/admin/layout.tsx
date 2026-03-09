"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, Users, Flag, Newspaper, LogOut, ArrowLeft, PlaySquare, FileText, HardDrive } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/politicians", label: "Politicians", icon: Users },
  { href: "/admin/parties", label: "Parties", icon: Flag },
  { href: "/admin/media", label: "Media", icon: Newspaper },
  { href: "/admin/featured-videos", label: "Videos", icon: PlaySquare },
  { href: "/admin/extraction", label: "Extraction", icon: FileText },
  { href: "/admin/documents", label: "Documents", icon: HardDrive },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] bg-[var(--muted)]/50 md:block">
        <div className="flex h-full flex-col">
          {/* Back to site */}
          <div className="border-b border-[var(--border)] p-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to site
            </Link>
          </div>

          {/* Nav items */}
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User info + sign out */}
          <div className="border-t border-[var(--border)] p-3">
            <div className="mb-2 px-3">
              <p className="text-xs font-medium text-[var(--foreground)] truncate">
                {session?.user?.name}
              </p>
              <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                {session?.user?.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-4 border-b border-[var(--border)] p-4 md:hidden">
          <Link
            href="/"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex gap-2">
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="ml-auto text-xs text-[var(--muted-foreground)]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
