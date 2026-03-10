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
  Globe,
} from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/constants";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { CustomSelect } from "@/components/ui/CustomSelect";

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

        {/* Social / Web icons */}
        <div className="hidden sm:flex items-center gap-1.5">
          {party.officialWebsite && (
            <a
              href={party.officialWebsite}
              target="_blank"
              rel="noopener noreferrer"
              title="Official Website"
              onClick={(e) => e.stopPropagation()}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <Globe className="h-[18px] w-[18px] text-[var(--foreground)]" />
            </a>
          )}
          {(party.socialAccounts ?? []).map((account) => {
            const config = PLATFORM_CONFIG[account.platform];
            if (!config) return null;
            return (
              <a
                key={account.platform}
                href={account.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${config.label}`}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={config.icon}
                  alt={config.label}
                  className="opacity-60 hover:opacity-100 transition-opacity dark:brightness-0 dark:invert dark:opacity-50 dark:hover:opacity-80"
                  style={{ width: 18, height: 18 }}
                />
              </a>
            );
          })}
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
