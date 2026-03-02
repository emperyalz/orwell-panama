"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ExternalLink,
  Check,
  X,
  Newspaper,
  Tv,
  Mic,
  Radio,
  Globe,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Headphones,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CustomSelect } from "@/components/ui/CustomSelect";

const CATEGORIES = [
  { value: "Digital News", label: "Digital News", icon: Globe },
  { value: "Newspaper", label: "Newspaper", icon: Newspaper },
  { value: "TV Network", label: "TV Network", icon: Tv },
  { value: "Political Blog", label: "Political Blog", icon: BookOpen },
  { value: "Reporter", label: "Reporter", icon: Pencil },
  { value: "Podcaster", label: "Podcaster", icon: Mic },
  { value: "Radio", label: "Radio", icon: Radio },
] as const;

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "x_twitter", label: "X / Twitter" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "discord", label: "Discord" },
  { value: "twitch", label: "Twitch" },
] as const;

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function MediaPage() {
  const mediaSources = useQuery(api.mediaSources.list, {});
  const createMedia = useMutation(api.mediaSources.create);
  const updateMedia = useMutation(api.mediaSources.update);
  const removeMedia = useMutation(api.mediaSources.remove);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Edit mode social accounts
  const [editSocials, setEditSocials] = useState<
    { platform: string; handle: string; url: string }[]
  >([]);
  const [editNewSocial, setEditNewSocial] = useState({
    platform: "instagram",
    handle: "",
    url: "",
  });

  // Edit mode podcast urls
  const [editPodcasts, setEditPodcasts] = useState<
    { title: string; url: string }[]
  >([]);
  const [editNewPodcast, setEditNewPodcast] = useState({ title: "", url: "" });

  // New source form
  const [newSource, setNewSource] = useState({
    name: "",
    category: "Digital News" as string,
    description: "",
    websiteUrl: "",
    contactEmail: "",
    isActive: true,
    notes: "",
    socialAccounts: [] as { platform: string; handle: string; url: string }[],
    podcastUrls: [] as { title: string; url: string }[],
  });
  const [newSocial, setNewSocial] = useState({
    platform: "instagram",
    handle: "",
    url: "",
  });
  const [newPodcast, setNewPodcast] = useState({ title: "", url: "" });

  if (!mediaSources) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Media Sources
          </h1>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]"
          />
        ))}
      </div>
    );
  }

  const filtered = mediaSources.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || s.category === filterCategory;
    return matchSearch && matchCategory;
  });

  // Category counts
  const categoryCounts: Record<string, number> = {};
  for (const s of mediaSources) {
    categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
  }

  async function handleCreate() {
    await createMedia({
      name: newSource.name,
      slug: slugify(newSource.name),
      category: newSource.category as any,
      description: newSource.description || undefined,
      websiteUrl: newSource.websiteUrl || undefined,
      contactEmail: newSource.contactEmail || undefined,
      isActive: newSource.isActive,
      notes: newSource.notes || undefined,
      socialAccounts:
        newSource.socialAccounts.length > 0
          ? newSource.socialAccounts
          : undefined,
      podcastUrls:
        newSource.podcastUrls.length > 0 ? newSource.podcastUrls : undefined,
    });
    setShowAddForm(false);
    setNewSource({
      name: "",
      category: "Digital News",
      description: "",
      websiteUrl: "",
      contactEmail: "",
      isActive: true,
      notes: "",
      socialAccounts: [],
      podcastUrls: [],
    });
  }

  function startEdit(source: any) {
    setEditingId(source._id);
    setEditForm({
      name: source.name,
      category: source.category,
      description: source.description || "",
      websiteUrl: source.websiteUrl || "",
      contactEmail: source.contactEmail || "",
      isActive: source.isActive,
      notes: source.notes || "",
    });
    setEditSocials(source.socialAccounts ? [...source.socialAccounts] : []);
    setEditPodcasts(source.podcastUrls ? [...source.podcastUrls] : []);
    setEditNewSocial({ platform: "instagram", handle: "", url: "" });
    setEditNewPodcast({ title: "", url: "" });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    await updateMedia({
      id: editingId as Id<"mediaSources">,
      name: editForm.name,
      category: editForm.category as any,
      description: editForm.description || undefined,
      websiteUrl: editForm.websiteUrl || undefined,
      contactEmail: editForm.contactEmail || undefined,
      isActive: editForm.isActive,
      notes: editForm.notes || undefined,
      socialAccounts:
        editSocials.length > 0 ? editSocials : undefined,
      podcastUrls:
        editPodcasts.length > 0 ? editPodcasts : undefined,
    });
    setEditingId(null);
    setEditForm({});
    setEditSocials([]);
    setEditPodcasts([]);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await removeMedia({ id: deleteTarget.id as Id<"mediaSources"> });
    setDeleteTarget(null);
  }

  function addNewSocialToSource() {
    if (!newSocial.handle) return;
    setNewSource({
      ...newSource,
      socialAccounts: [...newSource.socialAccounts, { ...newSocial }],
    });
    setNewSocial({ platform: "instagram", handle: "", url: "" });
  }

  function addNewPodcastToSource() {
    if (!newPodcast.title || !newPodcast.url) return;
    setNewSource({
      ...newSource,
      podcastUrls: [...newSource.podcastUrls, { ...newPodcast }],
    });
    setNewPodcast({ title: "", url: "" });
  }

  function addEditSocial() {
    if (!editNewSocial.handle) return;
    setEditSocials([...editSocials, { ...editNewSocial }]);
    setEditNewSocial({ platform: "instagram", handle: "", url: "" });
  }

  function removeEditSocial(index: number) {
    setEditSocials(editSocials.filter((_, i) => i !== index));
  }

  function addEditPodcast() {
    if (!editNewPodcast.title || !editNewPodcast.url) return;
    setEditPodcasts([...editPodcasts, { ...editNewPodcast }]);
    setEditNewPodcast({ title: "", url: "" });
  }

  function removeEditPodcast(index: number) {
    setEditPodcasts(editPodcasts.filter((_, i) => i !== index));
  }

  function getCategoryIcon(category: string) {
    const cat = CATEGORIES.find((c) => c.value === category);
    if (!cat) return <Globe className="h-4 w-4" />;
    const Icon = cat.icon;
    return <Icon className="h-4 w-4" />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Media Sources{" "}
          <span className="text-base font-normal text-[var(--muted-foreground)]">
            ({filtered.length})
          </span>
        </h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Source
        </button>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !filterCategory
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          All ({mediaSources.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.value] || 0;
          return (
            <button
              key={cat.value}
              onClick={() =>
                setFilterCategory(
                  filterCategory === cat.value ? "" : cat.value
                )
              }
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterCategory === cat.value
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          type="text"
          placeholder="Search media sources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--foreground)] focus:outline-none"
        />
      </div>

      {/* Add source form */}
      {showAddForm && (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            New Media Source
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Name *
              </label>
              <input
                value={newSource.name}
                onChange={(e) =>
                  setNewSource({ ...newSource, name: e.target.value })
                }
                placeholder="e.g. La Prensa"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Category *
              </label>
              <CustomSelect
                value={newSource.category}
                onChange={(v) =>
                  setNewSource({ ...newSource, category: v })
                }
                options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                size="default"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Description
              </label>
              <textarea
                value={newSource.description}
                onChange={(e) =>
                  setNewSource({ ...newSource, description: e.target.value })
                }
                placeholder="Brief description..."
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Website URL
              </label>
              <input
                value={newSource.websiteUrl}
                onChange={(e) =>
                  setNewSource({ ...newSource, websiteUrl: e.target.value })
                }
                placeholder="https://..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Contact Email
              </label>
              <input
                value={newSource.contactEmail}
                onChange={(e) =>
                  setNewSource({ ...newSource, contactEmail: e.target.value })
                }
                placeholder="editor@..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Notes
              </label>
              <textarea
                value={newSource.notes}
                onChange={(e) =>
                  setNewSource({ ...newSource, notes: e.target.value })
                }
                placeholder="Internal notes..."
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newSource.isActive}
                onChange={(e) =>
                  setNewSource({ ...newSource, isActive: e.target.checked })
                }
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <label className="text-xs text-[var(--foreground)]">Active</label>
            </div>
          </div>

          {/* Social accounts for new source */}
          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-[var(--muted-foreground)]">
              Social Accounts
            </label>
            {newSource.socialAccounts.map((sa, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-medium">
                  {SOCIAL_PLATFORMS.find((p) => p.value === sa.platform)
                    ?.label || sa.platform}
                </span>
                <span className="text-[var(--muted-foreground)]">
                  @{sa.handle}
                </span>
                <button
                  onClick={() => {
                    const updated = newSource.socialAccounts.filter(
                      (_, idx) => idx !== i
                    );
                    setNewSource({ ...newSource, socialAccounts: updated });
                  }}
                  className="text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <CustomSelect
                value={newSocial.platform}
                onChange={(v) =>
                  setNewSocial({ ...newSocial, platform: v })
                }
                options={SOCIAL_PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
                size="sm"
                fullWidth={false}
              />
              <input
                value={newSocial.handle}
                onChange={(e) =>
                  setNewSocial({ ...newSocial, handle: e.target.value })
                }
                placeholder="@handle"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
              />
              <input
                value={newSocial.url}
                onChange={(e) =>
                  setNewSocial({ ...newSocial, url: e.target.value })
                }
                placeholder="Profile URL"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
              />
              <button
                onClick={addNewSocialToSource}
                disabled={!newSocial.handle}
                className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Podcast URLs for new source */}
          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-[var(--muted-foreground)]">
              Podcasts
            </label>
            {newSource.podcastUrls.map((pc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Headphones className="h-3 w-3 text-[var(--muted-foreground)]" />
                <span className="font-medium">{pc.title}</span>
                <span className="text-[var(--muted-foreground)] truncate">
                  {pc.url}
                </span>
                <button
                  onClick={() => {
                    const updated = newSource.podcastUrls.filter(
                      (_, idx) => idx !== i
                    );
                    setNewSource({ ...newSource, podcastUrls: updated });
                  }}
                  className="text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newPodcast.title}
                onChange={(e) =>
                  setNewPodcast({ ...newPodcast, title: e.target.value })
                }
                placeholder="Podcast name"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
              />
              <input
                value={newPodcast.url}
                onChange={(e) =>
                  setNewPodcast({ ...newPodcast, url: e.target.value })
                }
                placeholder="https://open.spotify.com/... or RSS"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
              />
              <button
                onClick={addNewPodcastToSource}
                disabled={!newPodcast.title || !newPodcast.url}
                className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!newSource.name}
              className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-xs font-medium text-[var(--background)] disabled:opacity-50"
            >
              Create Source
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sources list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <Newspaper className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" />
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {mediaSources.length === 0
                ? "No media sources yet. Add your first source above."
                : "No sources match your search."}
            </p>
          </div>
        ) : (
          filtered.map((source) => {
            const isExpanded = expandedId === source._id;
            const isEditing = editingId === source._id;

            return (
              <div
                key={source._id}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden"
              >
                {/* Row header */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : source._id)
                  }
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-[var(--muted)]/50 transition-colors"
                >
                  <span className="text-[var(--muted-foreground)]">
                    {getCategoryIcon(source.category)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {source.name}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {source.category}
                      {source.websiteUrl && " · "}
                      {source.websiteUrl && (
                        <span className="text-blue-500">
                          {new URL(source.websiteUrl).hostname}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      source.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    }`}
                  >
                    {source.isActive ? "Active" : "Inactive"}
                  </span>
                  {source.socialAccounts &&
                    source.socialAccounts.length > 0 && (
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {source.socialAccounts.length} social
                      </span>
                    )}
                  {source.podcastUrls &&
                    source.podcastUrls.length > 0 && (
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {source.podcastUrls.length} podcast{source.podcastUrls.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 p-4 space-y-4">
                    {isEditing ? (
                      /* ─── Edit mode ─── */
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                              Name
                            </label>
                            <input
                              value={editForm.name || ""}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  name: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                              Category
                            </label>
                            <CustomSelect
                              value={editForm.category || "Digital News"}
                              onChange={(v) =>
                                setEditForm({
                                  ...editForm,
                                  category: v,
                                })
                              }
                              options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                              size="sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                              Description
                            </label>
                            <textarea
                              value={editForm.description || ""}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  description: e.target.value,
                                })
                              }
                              rows={2}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                              Website URL
                            </label>
                            <input
                              value={editForm.websiteUrl || ""}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  websiteUrl: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                              Contact Email
                            </label>
                            <input
                              value={editForm.contactEmail || ""}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  contactEmail: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                              Notes
                            </label>
                            <textarea
                              value={editForm.notes || ""}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  notes: e.target.value,
                                })
                              }
                              rows={2}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none resize-none"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editForm.isActive ?? true}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  isActive: e.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-[var(--border)]"
                            />
                            <label className="text-xs text-[var(--foreground)]">
                              Active
                            </label>
                          </div>
                        </div>

                        {/* Social Accounts — edit mode */}
                        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                          <h3 className="text-xs font-semibold text-[var(--foreground)]">
                            Social Accounts ({editSocials.length})
                          </h3>
                          {editSocials.map((sa, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className="font-medium text-[var(--foreground)]">
                                {SOCIAL_PLATFORMS.find(
                                  (p) => p.value === sa.platform
                                )?.label || sa.platform}
                              </span>
                              <span className="text-[var(--muted-foreground)]">
                                @{sa.handle}
                              </span>
                              {sa.url && (
                                <a
                                  href={sa.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline truncate"
                                >
                                  {sa.url}
                                </a>
                              )}
                              <button
                                onClick={() => removeEditSocial(i)}
                                className="ml-auto shrink-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <CustomSelect
                              value={editNewSocial.platform}
                              onChange={(v) =>
                                setEditNewSocial({
                                  ...editNewSocial,
                                  platform: v,
                                })
                              }
                              options={SOCIAL_PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
                              size="sm"
                              fullWidth={false}
                            />
                            <input
                              value={editNewSocial.handle}
                              onChange={(e) =>
                                setEditNewSocial({
                                  ...editNewSocial,
                                  handle: e.target.value,
                                })
                              }
                              placeholder="@handle"
                              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
                            />
                            <input
                              value={editNewSocial.url}
                              onChange={(e) =>
                                setEditNewSocial({
                                  ...editNewSocial,
                                  url: e.target.value,
                                })
                              }
                              placeholder="Profile URL"
                              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
                            />
                            <button
                              onClick={addEditSocial}
                              disabled={!editNewSocial.handle}
                              className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Podcast URLs — edit mode */}
                        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                          <h3 className="text-xs font-semibold text-[var(--foreground)]">
                            Podcasts ({editPodcasts.length})
                          </h3>
                          {editPodcasts.map((pc, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs"
                            >
                              <Headphones className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
                              <span className="font-medium text-[var(--foreground)]">
                                {pc.title}
                              </span>
                              <a
                                href={pc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline truncate"
                              >
                                {pc.url}
                              </a>
                              <button
                                onClick={() => removeEditPodcast(i)}
                                className="ml-auto shrink-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <input
                              value={editNewPodcast.title}
                              onChange={(e) =>
                                setEditNewPodcast({
                                  ...editNewPodcast,
                                  title: e.target.value,
                                })
                              }
                              placeholder="Podcast name"
                              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
                            />
                            <input
                              value={editNewPodcast.url}
                              onChange={(e) =>
                                setEditNewPodcast({
                                  ...editNewPodcast,
                                  url: e.target.value,
                                })
                              }
                              placeholder="https://open.spotify.com/... or RSS"
                              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none"
                            />
                            <button
                              onClick={addEditPodcast}
                              disabled={
                                !editNewPodcast.title || !editNewPodcast.url
                              }
                              className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)]"
                          >
                            <Check className="h-3 w-3" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditForm({});
                              setEditSocials([]);
                              setEditPodcasts([]);
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ─── View mode ─── */
                      <>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(source)}
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          {source.websiteUrl && (
                            <a
                              href={source.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Website
                            </a>
                          )}
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                id: source._id,
                                name: source.name,
                              })
                            }
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>

                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                          {source.description && (
                            <div className="sm:col-span-2">
                              <span className="text-[var(--muted-foreground)]">
                                Description:{" "}
                              </span>
                              <span className="text-[var(--foreground)]">
                                {source.description}
                              </span>
                            </div>
                          )}
                          {source.contactEmail && (
                            <div>
                              <span className="text-[var(--muted-foreground)]">
                                Email:{" "}
                              </span>
                              <span className="text-[var(--foreground)]">
                                {source.contactEmail}
                              </span>
                            </div>
                          )}
                          {source.notes && (
                            <div className="sm:col-span-2">
                              <span className="text-[var(--muted-foreground)]">
                                Notes:{" "}
                              </span>
                              <span className="text-[var(--foreground)] italic">
                                {source.notes}
                              </span>
                            </div>
                          )}
                        </div>

                        {source.socialAccounts &&
                          source.socialAccounts.length > 0 && (
                            <div>
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                                Social Accounts (
                                {source.socialAccounts.length})
                              </h3>
                              <div className="space-y-1.5">
                                {source.socialAccounts.map((sa, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs"
                                  >
                                    <span className="font-medium text-[var(--foreground)]">
                                      {SOCIAL_PLATFORMS.find(
                                        (p) => p.value === sa.platform
                                      )?.label || sa.platform}
                                    </span>
                                    <span className="text-[var(--muted-foreground)]">
                                      @{sa.handle}
                                    </span>
                                    {sa.url && (
                                      <a
                                        href={sa.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {source.podcastUrls &&
                          source.podcastUrls.length > 0 && (
                            <div>
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                                Podcasts ({source.podcastUrls.length})
                              </h3>
                              <div className="space-y-1.5">
                                {source.podcastUrls.map((pc, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs"
                                  >
                                    <Headphones className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
                                    <span className="font-medium text-[var(--foreground)]">
                                      {pc.title}
                                    </span>
                                    <a
                                      href={pc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Media Source"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
