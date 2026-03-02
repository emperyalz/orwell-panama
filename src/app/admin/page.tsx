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
  AlertTriangle,
} from "lucide-react";

const WikipediaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 98.05 98.05" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M98.023,17.465l-19.584-0.056c-0.004,0.711-0.006,1.563-0.017,2.121c1.664,0.039,5.922,0.822,7.257,4.327L66.92,67.155c-0.919-2.149-9.643-21.528-10.639-24.02l9.072-18.818c1.873-2.863,5.455-4.709,8.918-4.843l-0.01-1.968L55.42,17.489c-0.045,0.499,0.001,1.548-0.068,2.069c5.315,0.144,7.215,1.334,5.941,4.508c-2.102,4.776-6.51,13.824-7.372,15.475c-2.696-5.635-4.41-9.972-7.345-16.064c-1.266-2.823,1.529-3.922,4.485-4.004v-1.981l-21.82-0.067c0.016,0.93-0.021,1.451-0.021,2.131c3.041,0.046,6.988,0.371,8.562,3.019c2.087,4.063,9.044,20.194,11.149,24.514c-2.685,5.153-9.207,17.341-11.544,21.913c-3.348-7.43-15.732-36.689-19.232-44.241c-1.304-3.218,3.732-5.077,6.646-5.213l0.019-2.148L0,17.398c0.005,0.646,0.027,1.71,0.029,2.187c4.025-0.037,9.908,6.573,11.588,10.683c7.244,16.811,14.719,33.524,21.928,50.349c0.002,0.029,2.256,0.059,2.281,0.008c4.717-9.653,10.229-19.797,15.206-29.56L63.588,80.64c0.005,0.004,2.082,0.016,2.093,0.007c7.962-18.196,19.892-46.118,23.794-54.933c1.588-3.767,4.245-6.064,8.543-6.194l0.032-1.956L98.023,17.465z"/>
  </svg>
);

const WwwIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 89 88" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="nonzero" d="M88.34375,40.9998 C87.73828,32.3436 84.54685,24.0698 79.18755,17.2498 C77.86335,15.5193 76.39845,13.8982 74.81255,12.406 C68.10945,6.031 59.55055,1.949 50.37455,0.75 C49.49564,0.61719 48.60895,0.53516 47.71835,0.5 C47.6871,0.46875 47.6871,0.46875 47.65585,0.5 C46.6871,0.40625 45.71835,0.375 44.71835,0.375 C43.71835,0.375 42.71835,0.40625 41.71835,0.5 C41.61288,0.484375 41.51132,0.484375 41.40585,0.5 C40.6246,0.5625 39.84335,0.625 39.06205,0.75 C29.87065,1.9453 21.30005,6.0391 14.59305,12.438 C13.00715,13.9302 11.54225,15.5513 10.21805,17.2818 C4.86645,24.0943 1.68685,32.3598 1.09305,41.0008 C0.9993,42.032 0.96805,43.0633 0.96805,44.1258 C0.96805,45.1883 0.9993,46.2196 1.09305,47.2508 C1.69852,55.907 4.88995,64.1808 10.24925,71.0008 C11.57345,72.7313 13.03835,74.3524 14.62425,75.8446 C21.32735,82.2196 29.88625,86.3016 39.06225,87.5006 C39.94116,87.63341 40.82785,87.71544 41.71845,87.7506 C41.7497,87.78185 41.7497,87.78185 41.78095,87.7506 C42.7497,87.84435 43.71845,87.8756 44.71845,87.8756 C45.71845,87.8756 46.71845,87.84435 47.71845,87.7506 C47.84345,87.8756 47.9372,88.0006 48.03095,88.09435 L48.03095,87.7506 C48.8122,87.6881 49.59345,87.6256 50.37475,87.5006 C59.56615,86.3053 68.13675,82.2115 74.84375,75.8126 C76.42965,74.3204 77.89455,72.6993 79.21875,70.9688 C84.57035,64.1563 87.74995,55.8908 88.34375,47.2498 C88.4375,46.2186 88.46875,45.1873 88.46875,44.1248 C88.46875,43.0623 88.4375,42.031 88.34375,40.9998 Z M82.09375,40.9998 L66.53175,40.9998 C66.25441,34.91 65.10595,28.8908 63.12555,23.1248 C66.58645,22.27714 69.98105,21.1795 73.28155,19.8436 C78.37135,25.7928 81.45345,33.1956 82.09405,40.9998 L82.09375,40.9998 Z M56.93775,63.9688 C53.96115,63.45318 50.95725,63.11724 47.93775,62.9688 L47.844,47.2498 L60.25,47.2498 C59.97266,52.9568 58.8555,58.5898 56.9375,63.9688 L56.93775,63.9688 Z M48.00025,80.4998 L47.969,69.2188 C49.7502,69.31255 51.969,69.50005 54.469,69.87505 C52.6526,73.61335 50.4846,77.16805 48.0002,80.50005 L48.00025,80.4998 Z M29.18825,47.2498 L41.59425,47.2498 L41.688,62.9378 C38.5982,63.05108 35.52,63.36358 32.4692,63.8753 C30.5747,58.5237 29.4692,52.9223 29.188,47.2503 L29.18825,47.2498 Z M32.50075,24.2808 C35.47735,24.79642 38.48125,25.13236 41.50075,25.2808 L41.5945,40.9998 L29.1885,40.9998 C29.46584,35.2928 30.583,29.6598 32.501,24.2808 L32.50075,24.2808 Z M41.43825,7.7498 L41.4695,19.0308 C39.6883,18.93705 37.4695,18.74955 34.9695,18.37455 C36.7859,14.63625 38.9539,11.08155 41.4383,7.74955 L41.43825,7.7498 Z M47.68825,7.34355 C50.32885,10.80445 52.61015,14.51935 54.50075,18.43755 C52.25075,18.76177 49.98905,18.9688 47.71955,19.06255 L47.68825,7.34355 Z M41.71945,69.18755 L41.7507,80.90655 C39.1101,77.44565 36.8288,73.73075 34.9382,69.81255 C37.1882,69.48833 39.4499,69.2813 41.7194,69.18755 L41.71945,69.18755 Z M47.84445,40.99955 L47.7507,25.31155 C50.8405,25.19827 53.9187,24.88577 56.9695,24.37405 C58.864,29.72565 59.9695,35.32705 60.2507,40.99905 L47.84445,40.99955 Z M68.37545,15.03055 C65.89885,15.94071 63.35985,16.68285 60.78165,17.24935 C59.40665,14.16345 57.79725,11.18685 55.96915,8.34315 C60.49255,9.76115 64.70355,12.03455 68.37515,15.03065 L68.37545,15.03055 Z M33.46945,8.34305 C31.64525,11.15945 30.04755,14.11645 28.68825,17.18685 C26.12965,16.5931 23.60625,15.86265 21.12575,14.99935 C24.77025,11.99935 28.96165,9.74155 33.46975,8.34315 L33.46945,8.34305 Z M16.15745,19.84305 C19.47775,21.13215 22.88405,22.19465 26.34545,23.03055 C24.35325,28.82745 23.19705,34.87855 22.90795,40.99955 L7.34595,40.99955 C7.98657,33.19485 11.06865,25.79255 16.15845,19.84355 L16.15745,19.84305 Z M7.34495,47.24905 L22.90695,47.24905 C23.18429,53.33885 24.33275,59.35805 26.31315,65.12405 C22.85225,65.97171 19.45765,67.06935 16.15715,68.40525 C11.06735,62.45605 7.98525,55.05325 7.34465,47.24905 L7.34495,47.24905 Z M21.06395,73.21805 C23.54055,72.30789 26.07955,71.56575 28.65775,70.99925 C30.03275,74.08515 31.64215,77.06175 33.47025,79.90545 C28.94685,78.48745 24.73585,76.21405 21.06425,73.21795 L21.06395,73.21805 Z M55.96995,79.90555 C57.79415,77.08915 59.39185,74.13215 60.75115,71.06175 C63.30975,71.6555 65.83315,72.38595 68.31365,73.24925 C64.66915,76.24925 60.47775,78.50705 55.96965,79.90545 L55.96995,79.90555 Z M73.28195,68.40555 C69.96165,67.11645 66.55535,66.05395 63.09395,65.21805 C65.08615,59.42115 66.24235,53.37005 66.53145,47.24905 L82.09345,47.24905 C81.45283,55.05375 78.37075,62.45605 73.28095,68.40505 L73.28195,68.40555 Z"/>
  </svg>
);
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
    expanded === "politicians" || expanded === "wikipedia" || expanded === "website" || expanded?.startsWith("party:") || expanded?.startsWith("role:")
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

  function getWikipediaItems(data: typeof allPoliticians) {
    if (!data) return [];
    return data
      .filter((p) => p.wikipediaUrl)
      .map((p) => ({
        id: p._id,
        label: p.name,
        sublabel: `${p.party} · ${p.role} · ${p.province}`,
        tags: [p.roleCategory, p.party],
      }));
  }

  function getWebsiteItems(data: typeof allPoliticians) {
    if (!data) return [];
    return data
      .filter((p) => p.personalWebsite)
      .map((p) => ({
        id: p._id,
        label: p.name,
        sublabel: `${p.party} · ${p.role} · ${p.province}`,
        tags: [p.roleCategory, p.party],
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
            <div className="mt-2 flex items-center gap-1.5">
              {stats.missingHeadshots > 0 && (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <p className={`text-2xl font-bold ${stats.missingHeadshots > 0 ? "text-red-500" : "text-[var(--foreground)]"}`}>
                {stats.missingHeadshots}
              </p>
            </div>
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

          {/* Wikipedia (expandable) */}
          <div>
            <button
              onClick={() => toggle("wikipedia")}
              className="w-full flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 hover:bg-[var(--muted)]/30 transition-colors"
            >
              <span className="text-[var(--muted-foreground)]">
                <WikipediaIcon className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-[var(--foreground)]">Wikipedia</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {stats.wikipediaCount ?? 0} politicians
                </p>
              </div>
              {expanded === "wikipedia" ? (
                <ChevronUp className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              )}
            </button>
            {expanded === "wikipedia" && (
              <ExpandableList
                items={getWikipediaItems(allPoliticians)}
                onClose={() => setExpanded(null)}
                filterOptions={roleFilterOptions}
                filterLabel="Roles"
              />
            )}
          </div>

          {/* Personal Website (expandable) */}
          <div>
            <button
              onClick={() => toggle("website")}
              className="w-full flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 hover:bg-[var(--muted)]/30 transition-colors"
            >
              <span className="text-[var(--muted-foreground)]">
                <WwwIcon className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-[var(--foreground)]">Personal Website</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {stats.personalWebsiteCount ?? 0} politicians
                </p>
              </div>
              {expanded === "website" ? (
                <ChevronUp className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              )}
            </button>
            {expanded === "website" && (
              <ExpandableList
                items={getWebsiteItems(allPoliticians)}
                onClose={() => setExpanded(null)}
                filterOptions={roleFilterOptions}
                filterLabel="Roles"
              />
            )}
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
