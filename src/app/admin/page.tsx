"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Users,
  Globe,
  Camera,
  BarChart3,
  Instagram,
  Facebook,
  Youtube,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Link2,
} from "lucide-react";
import { ExpandableList } from "@/components/admin/ExpandableList";
import { PARTY_LABELS } from "@/lib/constants";

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  x_twitter: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  tiktok: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.33 6.33 0 0 0-6.33 6.33 6.33 6.33 0 0 0 6.33 6.33 6.33 6.33 0 0 0 6.33-6.33V8.97a8.21 8.21 0 0 0 4.77 1.52V7.04a4.85 4.85 0 0 1-1-.35z" />
    </svg>
  ),
  facebook: <Facebook className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  discord: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
  twitch: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  ),
  linkedin: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
};

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  x_twitter: "X / Twitter",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  discord: "Discord",
  twitch: "Twitch",
  linkedin: "LinkedIn",
};

const roleFilterOptions = [
  { value: "Deputy", label: "Deputy" },
  { value: "Mayor", label: "Mayor" },
  { value: "Governor", label: "Governor" },
  { value: "President", label: "President" },
];

const platformFilterOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "x_twitter", label: "X / Twitter" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "discord", label: "Discord" },
  { value: "twitch", label: "Twitch" },
  { value: "linkedin", label: "LinkedIn" },
];

export default function AdminDashboard() {
  const stats = useQuery(api.politicians.getStats);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Conditional queries — only fetch when expanded
  const allPoliticians = useQuery(
    api.politicians.list,
    expanded === "politicians" || expanded?.startsWith("party:") || expanded?.startsWith("role:")
      ? (() => {
          if (expanded!.startsWith("party:")) return { party: expanded!.replace("party:", "") };
          if (expanded!.startsWith("role:")) return { roleCategory: expanded!.replace("role:", "") };
          return {};
        })()
      : "skip"
  );

  const allAccounts = useQuery(
    api.accounts.listAll,
    expanded === "accounts" ? {} : "skip"
  );

  const platformAccounts = useQuery(
    api.accounts.listByPlatform,
    expanded?.startsWith("platform:")
      ? { platform: expanded.replace("platform:", "") as any }
      : "skip"
  );

  const missingHeadshots = useQuery(
    api.politicians.listMissingHeadshots,
    expanded === "headshots" ? {} : "skip"
  );

  const toggle = (key: string) => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  if (!stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Dashboard
        </h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]"
            />
          ))}
        </div>
      </div>
    );
  }

  // Build list items from query results
  function getPoliticianItems(data: typeof allPoliticians) {
    if (!data) return [];
    return data.map((p) => ({
      id: p._id,
      label: p.name,
      sublabel: `${p.party} · ${p.role} · ${p.province}`,
      tags: [p.roleCategory, p.party],
    }));
  }

  function getAccountItems(data: typeof allAccounts | typeof platformAccounts) {
    if (!data) return [];
    return data.map((a) => ({
      id: a._id,
      label: `@${a.handle}`,
      sublabel: `${a.politicianName} · ${platformLabels[a.platform] || a.platform}`,
      icon: platformIcons[a.platform] || <Globe className="h-3.5 w-3.5" />,
      tags: [a.platform],
    }));
  }

  function getMissingHeadshotItems(data: typeof missingHeadshots) {
    if (!data) return [];
    return data.map((p) => ({
      id: p._id,
      label: p.name,
      sublabel: `${p.party} · ${p.role} · ${p.province}`,
      tags: [p.roleCategory, p.party],
    }));
  }

  // Platform coverage data — include LinkedIn
  const platformOrder = ["instagram", "x_twitter", "tiktok", "facebook", "youtube", "linkedin", "discord", "twitch"];
  const coveragePlatforms = platformOrder.filter(
    (p) => (stats.platformCounts[p] || 0) > 0 || ["instagram", "x_twitter", "tiktok", "facebook", "youtube", "linkedin"].includes(p)
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>

      {/* Top-level stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Politicians card */}
        <div>
          <button
            onClick={() => toggle("politicians")}
            className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 hover:bg-[var(--muted)]/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Politicians
              </span>
              <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                <Users className="h-5 w-5" />
                {expanded === "politicians" ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              {stats.totalPoliticians}
            </p>
          </button>
          {expanded === "politicians" && (
            <ExpandableList
              items={getPoliticianItems(allPoliticians)}
              onClose={() => setExpanded(null)}
              filterOptions={roleFilterOptions}
              filterLabel="Roles"
            />
          )}
        </div>

        {/* Social Accounts card */}
        <div>
          <button
            onClick={() => toggle("accounts")}
            className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 hover:bg-[var(--muted)]/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Social Accounts
              </span>
              <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                <Globe className="h-5 w-5" />
                {expanded === "accounts" ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              {stats.totalAccounts}
            </p>
          </button>
          {expanded === "accounts" && (
            <ExpandableList
              items={getAccountItems(allAccounts)}
              onClose={() => setExpanded(null)}
              filterOptions={platformFilterOptions}
              filterLabel="Platforms"
            />
          )}
        </div>

        {/* Missing Headshots card */}
        <div>
          <button
            onClick={() => toggle("headshots")}
            className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 hover:bg-[var(--muted)]/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Missing Headshots
              </span>
              <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                <Camera className="h-5 w-5" />
                {expanded === "headshots" ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </span>
            </div>
            <p
              className={`mt-2 text-2xl font-bold ${
                stats.missingHeadshots > 0
                  ? "text-amber-500"
                  : "text-[var(--foreground)]"
              }`}
            >
              {stats.missingHeadshots}
            </p>
          </button>
          {expanded === "headshots" && (
            <ExpandableList
              items={getMissingHeadshotItems(missingHeadshots)}
              onClose={() => setExpanded(null)}
              filterOptions={roleFilterOptions}
              filterLabel="Roles"
            />
          )}
        </div>

        {/* Platform Coverage card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Platform Coverage
            </span>
            <span className="text-[var(--muted-foreground)]">
              <BarChart3 className="h-5 w-5" />
            </span>
          </div>
          <div className="space-y-2">
            {coveragePlatforms.map((platform) => {
              const count = stats.platformCounts[platform] || 0;
              const pct = stats.totalPoliticians > 0
                ? Math.round((count / stats.totalPoliticians) * 100)
                : 0;
              return (
                <div key={platform} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--muted-foreground)]">
                        {platformIcons[platform] || <Globe className="h-3 w-3" />}
                      </span>
                      <span className="text-[10px] font-medium text-[var(--foreground)]">
                        {platformLabels[platform] || platform}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)]">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Platform breakdown — includes Wikipedia, Personal Website, LinkedIn */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          Accounts by Platform
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Social platform accounts */}
          {Object.entries(stats.platformCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([platform, count]) => {
              const key = `platform:${platform}`;
              const isExpanded = expanded === key;
              return (
                <div key={platform}>
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 hover:bg-[var(--muted)]/30 transition-colors"
                  >
                    <span className="text-[var(--muted-foreground)]">
                      {platformIcons[platform] || (
                        <Globe className="h-4 w-4" />
                      )}
                    </span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {platformLabels[platform] || platform}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {count} accounts
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    )}
                  </button>
                  {isExpanded && (
                    <ExpandableList
                      items={getAccountItems(platformAccounts)}
                      onClose={() => setExpanded(null)}
                      filterOptions={platformFilterOptions}
                      filterLabel="Platforms"
                    />
                  )}
                </div>
              );
            })}

          {/* Wikipedia (non-expandable info card) */}
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <span className="text-[var(--muted-foreground)]">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Wikipedia
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {stats.wikipediaCount ?? 0} politicians
              </p>
            </div>
          </div>

          {/* Personal Website (non-expandable info card) */}
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <span className="text-[var(--muted-foreground)]">
              <Link2 className="h-4 w-4" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Personal Website
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {stats.personalWebsiteCount ?? 0} politicians
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Party breakdown — with logos and full names */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          By Party
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(stats.partyCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([party, count]) => {
              const key = `party:${party}`;
              const isExpanded = expanded === key;
              const details = stats.partyDetails?.[party];
              const fullName = details?.fullName || PARTY_LABELS[party] || party;
              const logo = details?.logo;
              const color = details?.color;
              return (
                <div key={party}>
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 hover:bg-[var(--muted)]/30 transition-colors"
                  >
                    {/* Party logo or color swatch */}
                    {logo ? (
                      <img
                        src={logo}
                        alt={party}
                        className="h-8 w-8 shrink-0 rounded object-contain"
                      />
                    ) : color ? (
                      <div
                        className="h-8 w-8 shrink-0 rounded"
                        style={{ backgroundColor: color }}
                      />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded bg-[var(--muted)] flex items-center justify-center text-[10px] font-bold text-[var(--muted-foreground)]">
                        {party}
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {party} — {fullName}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {count} {count === 1 ? "politician" : "politicians"}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                    )}
                  </button>
                  {isExpanded && (
                    <ExpandableList
                      items={getPoliticianItems(allPoliticians)}
                      onClose={() => setExpanded(null)}
                      filterOptions={roleFilterOptions}
                      filterLabel="Roles"
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Role breakdown */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          By Role
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(stats.roleCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([role, count]) => {
              const key = `role:${role}`;
              const isExpanded = expanded === key;
              return (
                <div key={role}>
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 hover:bg-[var(--muted)]/30 transition-colors"
                  >
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {role}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm text-[var(--muted-foreground)]">
                        {count}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      )}
                    </span>
                  </button>
                  {isExpanded && (
                    <ExpandableList
                      items={getPoliticianItems(allPoliticians)}
                      onClose={() => setExpanded(null)}
                      filterOptions={roleFilterOptions}
                      filterLabel="Roles"
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
