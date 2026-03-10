"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Flag,
  ChevronDown,
  Save,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Instagram,
  Facebook,
  Youtube,
  Globe,
} from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/constants";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { CustomSelect } from "@/components/ui/CustomSelect";

/* Lucide + inline-SVG icons — identical to the Politicians admin page */
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
  linkedin: (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
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
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram", prefix: "https://www.instagram.com/" },
  { value: "x_twitter", label: "X / Twitter", prefix: "https://x.com/" },
  { value: "tiktok", label: "TikTok", prefix: "https://www.tiktok.com/@" },
  { value: "facebook", label: "Facebook", prefix: "https://www.facebook.com/" },
  { value: "youtube", label: "YouTube", prefix: "https://www.youtube.com/" },
  { value: "linkedin", label: "LinkedIn", prefix: "https://www.linkedin.com/company/" },
  { value: "discord", label: "Discord", prefix: "https://discord.gg/" },
  { value: "twitch", label: "Twitch", prefix: "https://www.twitch.tv/" },
] as const;

const WIKIPEDIA_LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
] as const;

/* ------------------------------------------------------------------ */
/*  Uncontrolled colour-picker swatch                                  */
/* ------------------------------------------------------------------ */
function ColorPickerSwatch({
  color,
  onChange,
  title,
}: {
  color: string;
  onChange: (c: string) => void;
  title?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== color) {
      inputRef.current.value = color;
    }
  }, [color]);

  return (
    <div
      className="relative h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--border)] overflow-hidden"
      title={title}
    >
      <div className="absolute inset-0" style={{ backgroundColor: color }} />
      <input
        ref={inputRef}
        type="color"
        defaultValue={color}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Party Accordion Row                                                */
/* ------------------------------------------------------------------ */

type PartyDoc = {
  _id: Id<"parties">;
  code: string;
  name: string;
  fullName: string;
  logo: string;
  logoStorageId?: Id<"_storage">;
  color: string;
  secondaryColor?: string;
  officialWebsite?: string;
  socialAccounts?: { platform: string; url: string }[];
  wikipediaUrls?: { language: string; url: string }[];
  wikidataUrl?: string;
};

function PartyRow({
  party,
  isExpanded,
  onToggle,
}: {
  party: PartyDoc;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const updateParty = useMutation(api.parties.update);
  const storePartyLogo = useMutation(api.storage.storePartyLogo);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [socialAccounts, setSocialAccounts] = useState<
    { platform: string; url: string }[] | null
  >(null);
  const [showAddSocial, setShowAddSocial] = useState(false);
  const [newSocial, setNewSocial] = useState({ platform: "instagram", url: "" });
  const [wikipediaUrls, setWikipediaUrls] = useState<
    { language: string; url: string }[] | null
  >(null);
  const [showAddWiki, setShowAddWiki] = useState(false);
  const [newWiki, setNewWiki] = useState({ language: "es", url: "" });

  // Reset form state when party data changes (after save + re-fetch)
  const currentSocials = socialAccounts ?? party.socialAccounts ?? [];
  const currentWikipediaUrls = wikipediaUrls ?? party.wikipediaUrls ?? [];

  const getFieldValue = (field: string) => {
    if (field in form) return form[field];
    return (party as any)[field] ?? "";
  };

  const setField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  function addSocialAccount() {
    if (!newSocial.platform || !newSocial.url) return;
    const updated = [...currentSocials, { platform: newSocial.platform, url: newSocial.url }];
    setSocialAccounts(updated);
    setShowAddSocial(false);
    setNewSocial({ platform: "instagram", url: "" });
    setSaved(false);
  }

  function removeSocialAccount(index: number) {
    setSocialAccounts(currentSocials.filter((_, i) => i !== index));
    setSaved(false);
  }

  function addWikipediaUrl() {
    if (!newWiki.language || !newWiki.url) return;
    const updated = [...currentWikipediaUrls, { language: newWiki.language, url: newWiki.url }];
    setWikipediaUrls(updated);
    setShowAddWiki(false);
    setNewWiki({ language: "es", url: "" });
    setSaved(false);
  }

  function removeWikipediaUrl(index: number) {
    setWikipediaUrls(currentWikipediaUrls.filter((_, i) => i !== index));
    setSaved(false);
  }

  function getPlatformLabel(value: string) {
    return SOCIAL_PLATFORMS.find((p) => p.value === value)?.label || value;
  }

  function getLanguageLabel(value: string) {
    return WIKIPEDIA_LANGUAGES.find((l) => l.value === value)?.label || value;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const updates: Record<string, any> = {};
      for (const [key, value] of Object.entries(form)) {
        if (value !== (party as any)[key]) {
          updates[key] = value;
        }
      }
      if (socialAccounts !== null) {
        updates.socialAccounts = socialAccounts.filter((s) => s.platform && s.url);
      }
      if (wikipediaUrls !== null) {
        updates.wikipediaUrls = wikipediaUrls.filter((w) => w.language && w.url);
      }
      if (Object.keys(updates).length > 0) {
        await updateParty({ id: party._id, ...updates });
      }
      setForm({});
      setSocialAccounts(null);
      setWikipediaUrls(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error("Save failed:", err);
      setSaveError(err?.message ?? "Failed to save changes");
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  const primaryColor = getFieldValue("color") || "#888888";
  const secondaryColor = getFieldValue("secondaryColor") || primaryColor;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isExpanded
          ? "border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] shadow-sm"
          : "border-[var(--border)]"
      } bg-[var(--background)]`}
    >
      {/* ─── Collapsed Header Row ─── */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-[var(--muted)]/40"
      >
        {/* Logo + Primary color dot */}
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
            <span className="text-sm text-[var(--foreground)]">{party.name}</span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] truncate">
            {party.fullName}
          </p>
        </div>

        {/* Social platform icons (same badges as Politicians admin page) */}
        <div className="hidden items-center gap-1 sm:flex">
          {(party.socialAccounts ?? []).map((a) => (
            <span
              key={a.platform}
              className="rounded bg-[var(--muted)] p-1 text-[var(--muted-foreground)]"
              title={a.platform}
            >
              {platformIcons[a.platform] || (
                <Globe className="h-3.5 w-3.5" />
              )}
            </span>
          ))}
        </div>

        {/* Color dots — Primary + Secondary */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div
            className="h-4 w-4 rounded-full border border-black/10"
            style={{ backgroundColor: party.color }}
            title={`Primary: ${party.color}`}
          />
          <div
            className="h-4 w-4 rounded-full border border-black/10"
            style={{ backgroundColor: party.secondaryColor || party.color }}
            title={`Secondary: ${party.secondaryColor || party.color}`}
          />
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ─── Expanded Panel ─── */}
      <div className={isExpanded ? "" : "hidden"}>
        <div className="border-t border-[var(--border)] px-4 pb-5 pt-4 space-y-5">
          {/* Save error */}
          <div
            className={`rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 ${
              saveError ? "" : "hidden"
            }`}
          >
            <strong>Error:</strong> {saveError}
          </div>

          {/* ── Brand Colors ── */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              <span>🎨</span> Brand Colors
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Primary Color */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <ColorPickerSwatch
                    color={primaryColor}
                    onChange={(c) => setField("color", c)}
                    title="Pick primary color"
                  />
                  <input
                    value={getFieldValue("color")}
                    onChange={(e) => setField("color", e.target.value)}
                    placeholder="#FF0000"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                  Used for avatar background and primary accents
                </p>
              </div>
              {/* Secondary Color */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <ColorPickerSwatch
                    color={secondaryColor}
                    onChange={(c) => setField("secondaryColor", c)}
                    title="Pick secondary color"
                  />
                  <input
                    value={getFieldValue("secondaryColor")}
                    onChange={(e) => setField("secondaryColor", e.target.value)}
                    placeholder="#0000FF"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                  Used for gradients and secondary accents
                </p>
              </div>
            </div>
            {/* Gradient preview bar */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-[var(--muted-foreground)]">Preview</p>
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 shrink-0 rounded-lg"
                  style={{ backgroundColor: primaryColor }}
                />
                <div
                  className="h-9 flex-1 rounded-lg"
                  style={{
                    background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Party Information ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Party Information
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Short Name
                </label>
                <input
                  value={getFieldValue("name")}
                  onChange={(e) => setField("name", e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Full Name
                </label>
                <input
                  value={getFieldValue("fullName")}
                  onChange={(e) => setField("fullName", e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Official Website
                </label>
                <input
                  value={getFieldValue("officialWebsite")}
                  onChange={(e) => setField("officialWebsite", e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  WikiData URL
                </label>
                <input
                  value={getFieldValue("wikidataUrl")}
                  onChange={(e) => setField("wikidataUrl", e.target.value)}
                  placeholder="https://www.wikidata.org/wiki/Q..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── Party Logo ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Party Logo
            </h3>
            <ImageUpload
              currentImageUrl={party.logo}
              label=""
              onUploaded={async (storageId) => {
                await storePartyLogo({
                  partyId: party._id,
                  storageId: storageId as Id<"_storage">,
                });
              }}
            />
          </div>

          {/* ── Wikipedia URLs ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Wikipedia ({currentWikipediaUrls.length})
              </h3>
              <button
                onClick={() => setShowAddWiki(!showAddWiki)}
                className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>

            {/* Add wiki form */}
            <div className={`rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-3 space-y-2.5 ${showAddWiki ? "" : "hidden"}`}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Language</label>
                  <CustomSelect
                    value={newWiki.language}
                    onChange={(v) => setNewWiki({ ...newWiki, language: v })}
                    options={WIKIPEDIA_LANGUAGES.map((l) => ({ value: l.value, label: `${l.label} (${l.value})` }))}
                    size="sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">URL</label>
                  <input
                    value={newWiki.url}
                    onChange={(e) => setNewWiki({ ...newWiki, url: e.target.value })}
                    placeholder={`https://${newWiki.language}.wikipedia.org/wiki/...`}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addWikipediaUrl} disabled={!newWiki.url} className="rounded-md bg-[var(--foreground)] px-2.5 py-1 text-[10px] font-medium text-[var(--background)] disabled:opacity-50">
                  Add Link
                </button>
                <button onClick={() => setShowAddWiki(false)} className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted-foreground)]">
                  Cancel
                </button>
              </div>
            </div>

            {/* Existing wiki links */}
            <p className={`text-[10px] text-[var(--muted-foreground)] italic ${currentWikipediaUrls.length === 0 ? "" : "hidden"}`}>
              No Wikipedia links added yet.
            </p>
            <div className={`space-y-1.5 ${currentWikipediaUrls.length === 0 ? "hidden" : ""}`}>
              {currentWikipediaUrls.map((wiki, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-[8px] font-bold text-[var(--muted-foreground)] uppercase">
                    {wiki.language}
                  </div>
                  <span className="min-w-0 flex-1 text-[10px] text-[var(--muted-foreground)] truncate">{wiki.url}</span>
                  <a href={wiki.url} target="_blank" rel="noopener noreferrer" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button onClick={() => removeWikipediaUrl(index)} className="text-[var(--muted-foreground)] hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Social Accounts ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Social Accounts ({currentSocials.length})
              </h3>
              <button
                onClick={() => setShowAddSocial(!showAddSocial)}
                className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>

            {/* Add social form */}
            <div className={`rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-3 space-y-2.5 ${showAddSocial ? "" : "hidden"}`}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Platform</label>
                  <CustomSelect
                    value={newSocial.platform}
                    onChange={(v) => setNewSocial({ ...newSocial, platform: v })}
                    options={SOCIAL_PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
                    size="sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">URL</label>
                  <input
                    value={newSocial.url}
                    onChange={(e) => setNewSocial({ ...newSocial, url: e.target.value })}
                    placeholder={SOCIAL_PLATFORMS.find((p) => p.value === newSocial.platform)?.prefix || "https://..."}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addSocialAccount} disabled={!newSocial.url} className="rounded-md bg-[var(--foreground)] px-2.5 py-1 text-[10px] font-medium text-[var(--background)] disabled:opacity-50">
                  Add Account
                </button>
                <button onClick={() => setShowAddSocial(false)} className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted-foreground)]">
                  Cancel
                </button>
              </div>
            </div>

            {/* Existing social accounts */}
            <p className={`text-[10px] text-[var(--muted-foreground)] italic ${currentSocials.length === 0 ? "" : "hidden"}`}>
              No social accounts linked yet.
            </p>
            <div className={`space-y-1.5 ${currentSocials.length === 0 ? "hidden" : ""}`}>
              {currentSocials.map((social, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                  <span className="text-[10px] font-medium text-[var(--foreground)]">
                    {getPlatformLabel(social.platform)}
                  </span>
                  <span className="min-w-0 flex-1 text-[10px] text-[var(--muted-foreground)] truncate">{social.url}</span>
                  <a href={social.url} target="_blank" rel="noopener noreferrer" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button onClick={() => removeSocialAccount(index)} className="text-[var(--muted-foreground)] hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Save Button ── */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <span className={`text-xs text-green-600 ${saved ? "" : "hidden"}`}>
              Changes saved!
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Check className={`h-4 w-4 ${saved ? "" : "hidden"}`} />
              <Save className={`h-4 w-4 ${saved ? "hidden" : ""}`} />
              <span className={saving ? "" : "hidden"}>Saving...</span>
              <span className={!saving && saved ? "" : "hidden"}>Saved!</span>
              <span className={!saving && !saved ? "" : "hidden"}>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PartiesPage() {
  const parties = useQuery(api.parties.list);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            ( {parties.length} )
          </span>
        </h1>
      </div>

      <div className="space-y-2">
        {parties.map((party) => (
          <PartyRow
            key={party._id}
            party={party as PartyDoc}
            isExpanded={expandedId === party._id}
            onToggle={() =>
              setExpandedId(expandedId === party._id ? null : party._id)
            }
          />
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
