"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Check,
  Pencil,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageUpload } from "@/components/admin/ImageUpload";

type PageProps = { params: Promise<{ id: string }> };

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "x_twitter", label: "X / Twitter" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "discord", label: "Discord" },
  { value: "twitch", label: "Twitch" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

const VERDICTS = ["CONFIRMED", "PROBABLE"] as const;
const TIERS = ["hot", "warm", "cool", "dormant"] as const;
const ROLE_CATEGORIES = ["Deputy", "Mayor", "Governor", "President"] as const;

export default function EditPoliticianPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const politician = useQuery(api.politicians.getByExternalId, {
    externalId: id,
  });
  const updatePolitician = useMutation(api.politicians.update);
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);
  const removeAccount = useMutation(api.accounts.remove);
  const storeHeadshot = useMutation(api.storage.storeHeadshot);
  const storeAvatar = useMutation(api.storage.storeAvatar);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountForm, setEditAccountForm] = useState<Record<string, string>>({});

  // Form state for politician
  const [form, setForm] = useState<Record<string, string>>({});
  const [newAccount, setNewAccount] = useState({
    platform: "instagram" as string,
    handle: "",
    profileUrl: "",
    avatar: "",
    verdict: "PROBABLE" as string,
    score: "75",
    pollingTier: "warm" as string,
  });

  if (!politician) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]" />
      </div>
    );
  }

  // Initialize form from politician data (only on first render)
  const getFieldValue = (field: string) => {
    if (field in form) return form[field];
    return (politician as any)[field] ?? "";
  };

  const setField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      for (const [key, value] of Object.entries(form)) {
        if (value !== (politician as any)[key]) {
          updates[key] = value;
        }
      }
      if (Object.keys(updates).length > 0) {
        await updatePolitician({
          id: politician!._id as Id<"politicians">,
          ...updates,
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAccount() {
    await createAccount({
      politicianId: politician!._id as Id<"politicians">,
      platform: newAccount.platform as any,
      handle: newAccount.handle,
      profileUrl: newAccount.profileUrl,
      avatar: newAccount.avatar || "",
      verdict: newAccount.verdict as any,
      score: parseInt(newAccount.score) || 75,
      pollingTier: newAccount.pollingTier as any,
    });
    setShowAddAccount(false);
    setNewAccount({
      platform: "instagram",
      handle: "",
      profileUrl: "",
      avatar: "",
      verdict: "PROBABLE",
      score: "75",
      pollingTier: "warm",
    });
  }

  async function handleDeleteAccount() {
    if (!deleteAccountTarget) return;
    await removeAccount({
      id: deleteAccountTarget.id as Id<"accounts">,
    });
    setDeleteAccountTarget(null);
  }

  function startEditAccount(account: any) {
    setEditingAccountId(account._id);
    setEditAccountForm({
      handle: account.handle,
      profileUrl: account.profileUrl,
      verdict: account.verdict,
      score: String(account.score),
      pollingTier: account.pollingTier,
    });
  }

  function cancelEditAccount() {
    setEditingAccountId(null);
    setEditAccountForm({});
  }

  async function handleSaveAccount() {
    if (!editingAccountId) return;
    await updateAccount({
      id: editingAccountId as Id<"accounts">,
      handle: editAccountForm.handle,
      profileUrl: editAccountForm.profileUrl,
      verdict: editAccountForm.verdict as any,
      score: parseInt(editAccountForm.score) || 75,
      pollingTier: editAccountForm.pollingTier as any,
    });
    setEditingAccountId(null);
    setEditAccountForm({});
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/politicians"
          className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {politician.name}
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {politician.externalId} · {politician.party} · {politician.province}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Headshot upload */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
        <ImageUpload
          currentImageUrl={politician.headshot}
          label="Headshot Photo"
          onUploaded={async (storageId) => {
            await storeHeadshot({
              politicianId: politician!._id as Id<"politicians">,
              storageId: storageId as Id<"_storage">,
            });
          }}
        />
      </div>

      {/* Politician form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Basic Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Name
            </label>
            <input
              value={getFieldValue("name")}
              onChange={(e) => setField("name", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Slug
            </label>
            <input
              value={getFieldValue("slug")}
              onChange={(e) => setField("slug", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Party Code
            </label>
            <input
              value={getFieldValue("party")}
              onChange={(e) => setField("party", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Party Full Name
            </label>
            <input
              value={getFieldValue("partyFull")}
              onChange={(e) => setField("partyFull", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Role
            </label>
            <input
              value={getFieldValue("role")}
              onChange={(e) => setField("role", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Role Category
            </label>
            <select
              value={getFieldValue("roleCategory")}
              onChange={(e) => setField("roleCategory", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            >
              {ROLE_CATEGORIES.map((rc) => (
                <option key={rc} value={rc}>
                  {rc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Province
            </label>
            <input
              value={getFieldValue("province")}
              onChange={(e) => setField("province", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              District
            </label>
            <input
              value={getFieldValue("district")}
              onChange={(e) => setField("district", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Circuit
            </label>
            <input
              value={getFieldValue("circuit")}
              onChange={(e) => setField("circuit", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Official Gov URL
            </label>
            <input
              value={getFieldValue("officialGovUrl")}
              onChange={(e) => setField("officialGovUrl", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Wikipedia URL
            </label>
            <input
              value={getFieldValue("wikipediaUrl")}
              onChange={(e) => setField("wikipediaUrl", e.target.value)}
              placeholder="https://es.wikipedia.org/wiki/..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Personal Website
            </label>
            <input
              value={getFieldValue("personalWebsite")}
              onChange={(e) => setField("personalWebsite", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Social Accounts */}
      <div
        className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4"
        id="add-account"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Social Accounts ({politician.accounts.length})
          </h2>
          <button
            onClick={() => setShowAddAccount(!showAddAccount)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Account
          </button>
        </div>

        {/* Add account form */}
        {showAddAccount && (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--foreground)]">
              New Account
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Platform
                </label>
                <select
                  value={newAccount.platform}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, platform: e.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Handle (without @)
                </label>
                <input
                  value={newAccount.handle}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, handle: e.target.value })
                  }
                  placeholder="username"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Profile URL
                </label>
                <input
                  value={newAccount.profileUrl}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, profileUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Verdict
                </label>
                <select
                  value={newAccount.verdict}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, verdict: e.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                >
                  {VERDICTS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newAccount.score}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, score: e.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                  Polling Tier
                </label>
                <select
                  value={newAccount.pollingTier}
                  onChange={(e) =>
                    setNewAccount({
                      ...newAccount,
                      pollingTier: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddAccount}
                disabled={!newAccount.handle || !newAccount.profileUrl}
                className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-50"
              >
                Add Account
              </button>
              <button
                onClick={() => setShowAddAccount(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Existing accounts */}
        <div className="space-y-2">
          {politician.accounts.map((a) =>
            editingAccountId === a._id ? (
              /* ── Inline edit mode ── */
              <div
                key={a._id}
                className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[var(--foreground)]">
                    Editing: {a.platform === "x_twitter" ? "X / Twitter" : a.platform} · @{a.handle}
                  </h3>
                  <button
                    onClick={cancelEditAccount}
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                      Handle (without @)
                    </label>
                    <input
                      value={editAccountForm.handle || ""}
                      onChange={(e) =>
                        setEditAccountForm({ ...editAccountForm, handle: e.target.value })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                      Verdict
                    </label>
                    <select
                      value={editAccountForm.verdict || "PROBABLE"}
                      onChange={(e) =>
                        setEditAccountForm({ ...editAccountForm, verdict: e.target.value })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                    >
                      {VERDICTS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                      Profile URL
                    </label>
                    <input
                      value={editAccountForm.profileUrl || ""}
                      onChange={(e) =>
                        setEditAccountForm({ ...editAccountForm, profileUrl: e.target.value })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                      Score (0-100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editAccountForm.score || "75"}
                      onChange={(e) =>
                        setEditAccountForm({ ...editAccountForm, score: e.target.value })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                      Polling Tier
                    </label>
                    <select
                      value={editAccountForm.pollingTier || "warm"}
                      onChange={(e) =>
                        setEditAccountForm({ ...editAccountForm, pollingTier: e.target.value })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSaveAccount}
                    className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)]"
                  >
                    Save Account
                  </button>
                  <button
                    onClick={cancelEditAccount}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── Display mode ── */
              <div
                key={a._id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
              >
                {a.avatar ? (
                  <img
                    src={a.avatar}
                    alt={a.handle}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-[10px] font-bold text-[var(--muted-foreground)] uppercase">
                    {a.platform.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    {a.platform === "x_twitter" ? "X / Twitter" : a.platform} ·
                    @{a.handle}
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {a.verdict} · Score: {a.score} · Tier: {a.pollingTier}
                  </p>
                </div>
                <button
                  onClick={() => startEditAccount(a)}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Edit account"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <a
                  href={a.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() =>
                    setDeleteAccountTarget({
                      id: a._id,
                      name: `@${a.handle} (${a.platform})`,
                    })
                  }
                  className="text-[var(--muted-foreground)] hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Delete account confirm */}
      {deleteAccountTarget && (
        <ConfirmDialog
          title="Delete Account"
          message={`Are you sure you want to remove "${deleteAccountTarget.name}" from ${politician.name}?`}
          onConfirm={handleDeleteAccount}
          onCancel={() => setDeleteAccountTarget(null)}
        />
      )}
    </div>
  );
}
