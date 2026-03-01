"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { Flag, Pencil, ExternalLink, Globe } from "lucide-react";

export default function PartiesPage() {
  const parties = useQuery(api.parties.list);

  if (!parties) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Parties</h1>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Parties{" "}
          <span className="text-base font-normal text-[var(--muted-foreground)]">
            ({parties.length})
          </span>
        </h1>
      </div>

      <div className="space-y-2">
        {parties.map((party) => (
          <div
            key={party._id}
            className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"
          >
            {/* Logo + Color swatch */}
            <div className="relative h-10 w-10 shrink-0">
              <img
                src={party.logo}
                alt={party.code}
                className="h-10 w-10 rounded-lg object-contain"
              />
              <div
                className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[var(--background)]"
                style={{ backgroundColor: party.color }}
              />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--foreground)]">
                  {party.code}
                </span>
                <span className="text-sm text-[var(--foreground)]">
                  {party.name}
                </span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] truncate">
                {party.fullName}
              </p>
            </div>

            {/* Social count */}
            {party.socialAccounts && party.socialAccounts.length > 0 && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                <Globe className="h-3 w-3" />
                {party.socialAccounts.length}
              </span>
            )}

            {/* Website link */}
            {party.officialWebsite && (
              <a
                href={party.officialWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            {/* Edit link */}
            <Link
              href={`/admin/parties/${party.code}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Link>
          </div>
        ))}

        {parties.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-12">
            <Flag className="h-10 w-10 text-[var(--muted-foreground)] opacity-50" />
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              No parties found. Run the seed script to populate.
            </p>
            <code className="mt-2 rounded bg-[var(--muted)] px-3 py-1 text-xs text-[var(--foreground)]">
              node scripts/seed-parties.mjs
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
