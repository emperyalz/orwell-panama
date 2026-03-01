"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  ExternalLink,
  Instagram,
  Facebook,
  Youtube,
  Globe,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-3.5 w-3.5" />,
  x_twitter: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  tiktok: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.33 6.33 0 0 0-6.33 6.33 6.33 6.33 0 0 0 6.33 6.33 6.33 6.33 0 0 0 6.33-6.33V8.97a8.21 8.21 0 0 0 4.77 1.52V7.04a4.85 4.85 0 0 1-1-.35z" />
    </svg>
  ),
  facebook: <Facebook className="h-3.5 w-3.5" />,
  youtube: <Youtube className="h-3.5 w-3.5" />,
  discord: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
  twitch: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  ),
  linkedin: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
};

export default function PoliticiansPage() {
  const politicians = useQuery(api.politicians.list, {});
  const removePolitician = useMutation(api.politicians.remove);
  const removeAccount = useMutation(api.accounts.remove);

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "politician" | "account";
    id: string;
    name: string;
  } | null>(null);

  if (!politicians) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Politicians
          </h1>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]"
          />
        ))}
      </div>
    );
  }

  const filtered = search
    ? politicians.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.party.toLowerCase().includes(search.toLowerCase()) ||
          p.province.toLowerCase().includes(search.toLowerCase()) ||
          p.externalId.toLowerCase().includes(search.toLowerCase())
      )
    : politicians;

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "politician") {
      await removePolitician({
        id: deleteTarget.id as Id<"politicians">,
      });
    } else {
      await removeAccount({ id: deleteTarget.id as Id<"accounts"> });
    }
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Politicians{" "}
          <span className="text-base font-normal text-[var(--muted-foreground)]">
            ({filtered.length})
          </span>
        </h1>
        <Link
          href="/admin/politicians/new"
          className="flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Politician
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          type="text"
          placeholder="Search by name, party, province, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--foreground)] focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map((p) => {
          const isExpanded = expandedId === p._id;
          return (
            <div
              key={p._id}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden"
            >
              {/* Row header */}
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : p._id)
                }
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-[var(--muted)]/50 transition-colors"
              >
                {/* Headshot */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--muted)]">
                  {p.hasHeadshot ? (
                    <img
                      src={p.headshot}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--muted-foreground)]">
                      {p.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {p.party} · {p.role} · {p.province}
                  </p>
                </div>

                {/* Account badges */}
                <div className="hidden items-center gap-1 sm:flex">
                  {p.accounts.map((a) => (
                    <span
                      key={a._id}
                      className="rounded bg-[var(--muted)] p-1 text-[var(--muted-foreground)]"
                      title={`${a.platform}: @${a.handle}`}
                    >
                      {platformIcons[a.platform] || (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                    </span>
                  ))}
                  {p.accounts.length === 0 && (
                    <span className="text-[10px] text-red-500">
                      No accounts
                    </span>
                  )}
                </div>

                {/* ID badge */}
                <span className="hidden text-[10px] font-mono text-[var(--muted-foreground)] lg:block">
                  {p.externalId}
                </span>

                {/* Expand chevron */}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                )}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 p-4 space-y-4">
                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/politicians/${p.externalId}`}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Link>
                    <Link
                      href={`/politician/${p.externalId}`}
                      target="_blank"
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Link>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: "politician",
                          id: p._id,
                          name: p.name,
                        })
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>

                  {/* Details grid */}
                  <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        Party:{" "}
                      </span>
                      <span className="text-[var(--foreground)]">
                        {p.partyFull} ({p.party})
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        Role:{" "}
                      </span>
                      <span className="text-[var(--foreground)]">
                        {p.role} ({p.roleCategory})
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        Province:{" "}
                      </span>
                      <span className="text-[var(--foreground)]">
                        {p.province}
                      </span>
                    </div>
                    {p.district && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">
                          District:{" "}
                        </span>
                        <span className="text-[var(--foreground)]">
                          {p.district}
                        </span>
                      </div>
                    )}
                    {p.circuit && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">
                          Circuit:{" "}
                        </span>
                        <span className="text-[var(--foreground)]">
                          {p.circuit}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Accounts */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                        Social Accounts ({p.accounts.length})
                      </h3>
                      <Link
                        href={`/admin/politicians/${p.externalId}#add-account`}
                        className="text-xs text-[var(--foreground)] hover:underline"
                      >
                        + Add Account
                      </Link>
                    </div>
                    {p.accounts.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)] italic">
                        No social accounts linked yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {p.accounts.map((a) => (
                          <div
                            key={a._id}
                            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                          >
                            <span className="text-[var(--muted-foreground)]">
                              {platformIcons[a.platform] || (
                                <Globe className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <span className="text-xs font-medium text-[var(--foreground)]">
                              @{a.handle}
                            </span>
                            <span
                              className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                a.verdict === "CONFIRMED"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                              }`}
                            >
                              {a.verdict}
                            </span>
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              {a.score}%
                            </span>
                            <a
                              href={a.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  type: "account",
                                  id: a._id,
                                  name: `@${a.handle} (${a.platform})`,
                                })
                              }
                              className="text-[var(--muted-foreground)] hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type === "politician" ? "Politician" : "Account"}`}
          message={`Are you sure you want to delete "${deleteTarget.name}"? ${
            deleteTarget.type === "politician"
              ? "This will also delete all linked social accounts."
              : ""
          } This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
