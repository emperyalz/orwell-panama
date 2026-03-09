"use client";

import { use, useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { ArrowLeft, Save, Check, Plus, Trash2, ExternalLink } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { CustomSelect } from "@/components/ui/CustomSelect";

type PageProps = { params: Promise<{ code: string }> };

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
  { value: "es", label: "Espanol" },
  { value: "en", label: "English" },
  { value: "fr", label: "Francais" },
  { value: "pt", label: "Portugues" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
] as const;

/* ------------------------------------------------------------------ */
/*  Uncontrolled colour-picker swatch                                  */
/*  The native <input type="color"> is hidden behind a coloured div.   */
/*  React never reconciles its `value` prop, so the browser's native   */
/*  widget cannot interfere with React's DOM operations.               */
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

  // Sync the displayed colour imperatively (bypasses React reconciliation)
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
      {/* Visual preview — React only updates the inline style */}
      <div className="absolute inset-0" style={{ backgroundColor: color }} />
      {/* Hidden native picker — uncontrolled so React never reconciles it */}
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

export default function EditPartyPage({ params }: PageProps) {
  const { code } = use(params);

  const party = useQuery(api.parties.getByCode, { code });
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

  // Wikipedia multi-language state
  const [wikipediaUrls, setWikipediaUrls] = useState<
    { language: string; url: string }[] | null
  >(null);
  const [showAddWiki, setShowAddWiki] = useState(false);
  const [newWiki, setNewWiki] = useState({ language: "es", url: "" });

  if (!party) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]" />
      </div>
    );
  }

  // Initialize from party data on first render
  const currentSocials =
    socialAccounts ?? party.socialAccounts ?? [];
  const currentWikipediaUrls =
    wikipediaUrls ?? party.wikipediaUrls ?? [];

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
    const updated = currentSocials.filter((_, i) => i !== index);
    setSocialAccounts(updated);
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
    const updated = currentWikipediaUrls.filter((_, i) => i !== index);
    setWikipediaUrls(updated);
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
        updates.socialAccounts = socialAccounts.filter(
          (s) => s.platform && s.url
        );
      }
      if (wikipediaUrls !== null) {
        updates.wikipediaUrls = wikipediaUrls.filter(
          (w) => w.language && w.url
        );
      }
      if (Object.keys(updates).length > 0) {
        await updateParty({
          id: party!._id as Id<"parties">,
          ...updates,
        });
      }
      // Clear local overrides so Convex reactive query is authoritative
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

  /* ---------------------------------------------------------------- */
  /*  IMPORTANT: Every section below uses CSS visibility toggling      */
  /*  (hidden class) instead of conditional React rendering.           */
  /*  This prevents React from calling insertBefore() to add/remove    */
  /*  DOM nodes, which fails when browser extensions have modified      */
  /*  the DOM tree outside of React's control.                         */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/parties"
          className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {party.code} — {party.name}
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {party.fullName}
          </p>
        </div>
        {/* Save button — all states always rendered, toggled via CSS */}
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

      {/* Error banner — always rendered, hidden when no error */}
      <div
        className={`rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 ${saveError ? "" : "hidden"}`}
      >
        <strong>Error:</strong> {saveError}
      </div>

      {/* Logo upload */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
        <ImageUpload
          currentImageUrl={party.logo}
          label="Party Logo"
          onUploaded={async (storageId) => {
            await storePartyLogo({
              partyId: party!._id as Id<"parties">,
              storageId: storageId as Id<"_storage">,
            });
          }}
        />
      </div>

      {/* Party form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Party Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Code (read-only)
            </label>
            <input
              value={party.code}
              disabled
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)] cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Short Name
            </label>
            <input
              value={getFieldValue("name")}
              onChange={(e) => setField("name", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Full Name
            </label>
            <input
              value={getFieldValue("fullName")}
              onChange={(e) => setField("fullName", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
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
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Party Color
            </label>
            <div className="flex gap-2">
              <input
                value={getFieldValue("color")}
                onChange={(e) => setField("color", e.target.value)}
                placeholder="#FF0000"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
              />
              <ColorPickerSwatch
                color={getFieldValue("color") || "#888888"}
                onChange={(c) => setField("color", c)}
                title="Pick a color"
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
              Type a hex value or use the color picker
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Secondary Color
            </label>
            <div className="flex gap-2">
              <input
                value={getFieldValue("secondaryColor")}
                onChange={(e) => setField("secondaryColor", e.target.value)}
                placeholder="#FF0000"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
              />
              <ColorPickerSwatch
                color={getFieldValue("secondaryColor") || getFieldValue("color") || "#888888"}
                onChange={(c) => setField("secondaryColor", c)}
                title="Pick secondary color"
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
              Used alongside primary color for gradients and accents
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
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

      {/* Wikipedia URLs — multi-language */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Wikipedia ({currentWikipediaUrls.length})
          </h2>
          <button
            onClick={() => setShowAddWiki(!showAddWiki)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Language
          </button>
        </div>

        {/* Add Wikipedia URL form — always rendered, toggled via CSS */}
        <div className={`rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4 space-y-3 ${showAddWiki ? "" : "hidden"}`}>
          <h3 className="text-xs font-semibold text-[var(--foreground)]">
            New Wikipedia Link
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Language
              </label>
              <CustomSelect
                value={newWiki.language}
                onChange={(v) =>
                  setNewWiki({ ...newWiki, language: v })
                }
                options={WIKIPEDIA_LANGUAGES.map((l) => ({
                  value: l.value,
                  label: `${l.label} (${l.value})`,
                }))}
                size="sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                URL
              </label>
              <input
                value={newWiki.url}
                onChange={(e) =>
                  setNewWiki({ ...newWiki, url: e.target.value })
                }
                placeholder={`https://${newWiki.language}.wikipedia.org/wiki/...`}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={addWikipediaUrl}
              disabled={!newWiki.url}
              className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-50"
            >
              Add Wikipedia Link
            </button>
            <button
              onClick={() => setShowAddWiki(false)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Existing Wikipedia URLs — both states always rendered, toggled via CSS */}
        <p className={`text-xs text-[var(--muted-foreground)] italic ${currentWikipediaUrls.length === 0 ? "" : "hidden"}`}>
          No Wikipedia links added yet.
        </p>
        <div className={`space-y-2 ${currentWikipediaUrls.length === 0 ? "hidden" : ""}`}>
          {currentWikipediaUrls.map((wiki, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-[10px] font-bold text-[var(--muted-foreground)] uppercase">
                {wiki.language}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--foreground)]">
                  Wikipedia ({getLanguageLabel(wiki.language)})
                </p>
                <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                  {wiki.url}
                </p>
              </div>
              <a
                href={wiki.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => removeWikipediaUrl(index)}
                className="text-[var(--muted-foreground)] hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Social accounts */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Social Accounts ({currentSocials.length})
          </h2>
          <button
            onClick={() => setShowAddSocial(!showAddSocial)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Account
          </button>
        </div>

        {/* Add social account form — always rendered, toggled via CSS */}
        <div className={`rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4 space-y-3 ${showAddSocial ? "" : "hidden"}`}>
          <h3 className="text-xs font-semibold text-[var(--foreground)]">
            New Social Account
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Platform
              </label>
              <CustomSelect
                value={newSocial.platform}
                onChange={(v) =>
                  setNewSocial({ ...newSocial, platform: v })
                }
                options={SOCIAL_PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
                size="sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                URL
              </label>
              <input
                value={newSocial.url}
                onChange={(e) =>
                  setNewSocial({ ...newSocial, url: e.target.value })
                }
                placeholder={
                  SOCIAL_PLATFORMS.find((p) => p.value === newSocial.platform)?.prefix || "https://..."
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={addSocialAccount}
              disabled={!newSocial.url}
              className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-50"
            >
              Add Account
            </button>
            <button
              onClick={() => setShowAddSocial(false)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Existing social accounts — both states always rendered, toggled via CSS */}
        <p className={`text-xs text-[var(--muted-foreground)] italic ${currentSocials.length === 0 ? "" : "hidden"}`}>
          No social accounts linked yet.
        </p>
        <div className={`space-y-2 ${currentSocials.length === 0 ? "hidden" : ""}`}>
          {currentSocials.map((social, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--foreground)]">
                  {getPlatformLabel(social.platform)}
                </p>
                <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                  {social.url}
                </p>
              </div>
              <a
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => removeSocialAccount(index)}
                className="text-[var(--muted-foreground)] hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
