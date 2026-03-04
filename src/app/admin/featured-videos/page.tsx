"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Plus, Trash2, RefreshCw, Play, AlertCircle,
  CheckCircle, Clock, Loader2, ExternalLink,
  Camera, Square, CheckSquare,
} from "lucide-react";

// ─── Platform helpers ──────────────────────────────────────────────────────────

function detectPlatformLabel(url: string): string {
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("x.com") || url.includes("twitter.com")) return "X / Twitter";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("facebook.com")) return "Facebook";
  return "Unknown";
}

function PlatformChip({ url, platform }: { url: string; platform?: string }) {
  const label = platform ?? detectPlatformLabel(url);
  const colors: Record<string, string> = {
    instagram: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    tiktok: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    twitter: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    youtube: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    facebook: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  };
  const color = colors[label.toLowerCase().replace(/ \/ .*/, "")] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status, errorMsg }: { status: string; errorMsg?: string }) {
  if (status === "done") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
      <CheckCircle className="h-3 w-3" /> Done
    </span>
  );
  if (status === "processing") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
      <Loader2 className="h-3 w-3 animate-spin" /> Processing
    </span>
  );
  if (status === "error") return (
    <span title={errorMsg} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300 cursor-help">
      <AlertCircle className="h-3 w-3" /> Error
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

// ─── Avatar upload button ─────────────────────────────────────────────────────

function AvatarUploadButton({ sourceUrl }: { sourceUrl: string }) {
  const generateUploadUrl = useAction(api.featuredVideos.generateAvatarUploadUrl);
  const patchAvatar = useMutation(api.featuredVideos.patchAvatarFromStorageId);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = await res.json();
      await patchAvatar({ sourceUrl, storageId });
    } catch (e) {
      setErr(String(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <span title={err || "Upload avatar image"}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={err ? `Error: ${err}` : "Upload avatar image"}
        className={`rounded-md p-1.5 disabled:opacity-40 ${
          err
            ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </button>
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeaturedVideosAdminPage() {
  const videos = useQuery(api.featuredVideos.list);
  const addVideo = useMutation(api.featuredVideos.addVideo);
  const removeVideo = useMutation(api.featuredVideos.removeVideo);
  const updateVideo = useMutation(api.featuredVideos.updateVideo);
  const processOne = useAction(api.featuredVideos.processOne);
  const resetErrors = useAction(api.featuredVideos.resetErrors);
  const refreshAvatarsAndHandles = useAction(api.featuredVideos.refreshAvatarsAndHandles);

  const [newUrl, setNewUrl] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [requeuing, setRequeuing] = useState<string | null>(null);

  // ─── Multi-select state ───────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!videos) return;
    if (selected.size === videos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(videos.map((v) => v._id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!videos || selected.size === 0) return;
    const count = selected.size;
    if (!confirm(`Delete ${count} video${count !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeletingSelected(true);
    try {
      for (const id of selected) {
        await removeVideo({ id: id as Id<"featuredVideos"> });
      }
      setSelected(new Set());
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleAdd = async () => {
    const url = newUrl.trim();
    if (!url) { setAddError("URL is required."); return; }
    if (!url.startsWith("http")) { setAddError("Please enter a valid URL."); return; }
    setAddError("");
    setAdding(true);
    try {
      await addVideo({
        sourceUrl: url,
        handle: newHandle.trim() || undefined,
        title: newTitle.trim() || undefined,
        isFeatured: false,
      });
      await processOne({ sourceUrl: url, handle: newHandle.trim() || undefined });
      setNewUrl("");
      setNewHandle("");
      setNewTitle("");
    } catch (e) {
      setAddError(String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleRequeue = async (video: { _id: Id<"featuredVideos">; sourceUrl: string; handle?: string }) => {
    setRequeuing(video._id);
    try {
      await updateVideo({ id: video._id, status: "pending" });
      await processOne({ sourceUrl: video.sourceUrl, handle: video.handle });
    } finally {
      setRequeuing(null);
    }
  };

  const handleResetErrors = async () => {
    setResetting(true);
    try { await resetErrors({}); } finally { setResetting(false); }
  };

  const handleRefreshAvatars = async () => {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const result = await refreshAvatarsAndHandles({});
      setRefreshMsg(`Updated ${result.updated} of ${result.checked} records.`);
    } catch (e) {
      setRefreshMsg(String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const errorCount = videos?.filter((v) => v.status === "error").length ?? 0;
  const allSelected = !!videos && videos.length > 0 && selected.size === videos.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Featured Videos</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Manage video links. Adding a URL triggers the download pipeline automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={handleRefreshAvatars}
            disabled={refreshing}
            title="Re-fetch real @handles and profile pictures"
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh Avatars & Handles"}
          </button>
          {refreshMsg && (
            <span className="text-xs text-[var(--muted-foreground)]">{refreshMsg}</span>
          )}
          {errorCount > 0 && (
            <button
              onClick={handleResetErrors}
              disabled={resetting}
              className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              <RefreshCw className={`h-4 w-4 ${resetting ? "animate-spin" : ""}`} />
              Re-queue {errorCount} error{errorCount !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Add new video form */}
      <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Add New Video
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            placeholder="https://www.instagram.com/reel/... or TikTok / X URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <input
            type="text"
            placeholder="@handle (optional)"
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            className="w-40 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newUrl.trim()}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {adding ? "Adding…" : "Add Video"}
          </button>
        </div>
        {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          Supported: Instagram Reels, TikTok, X/Twitter, YouTube
        </p>
      </div>

      {/* Video list */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
        {/* List header */}
        <div className="border-b border-[var(--border)] px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Select all toggle */}
            <button
              onClick={toggleSelectAll}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              title={allSelected ? "Deselect all" : "Select all"}
            >
              {allSelected
                ? <CheckSquare className="h-4 w-4 text-red-600" />
                : <Square className="h-4 w-4" />
              }
            </button>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              {videos?.length ?? 0} video{(videos?.length ?? 0) !== 1 ? "s" : ""}
            </h2>
            <div className="flex gap-3 text-[11px] text-[var(--muted-foreground)]">
              <span>{videos?.filter((v) => v.status === "done").length ?? 0} done</span>
              <span>{videos?.filter((v) => v.status === "processing").length ?? 0} processing</span>
              <span className={errorCount > 0 ? "text-red-500 font-semibold" : ""}>{errorCount} errors</span>
            </div>
          </div>

          {/* Delete selected button — only shown when items are selected */}
          {selected.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deletingSelected
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />
              }
              Delete {selected.size} selected
            </button>
          )}
        </div>

        {!videos ? (
          <div className="flex items-center justify-center py-16 text-[var(--muted-foreground)]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--muted-foreground)]">
            <Play className="h-10 w-10 opacity-30" />
            <p className="text-sm">No videos yet. Add one above to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {videos.map((video) => {
              const isSelected = selected.has(video._id);
              return (
                <li
                  key={video._id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                    isSelected
                      ? "bg-red-50/60 dark:bg-red-900/10"
                      : "hover:bg-[var(--muted)]/30"
                  }`}
                >
                  {/* Row select checkbox */}
                  <button
                    onClick={() => toggleSelect(video._id)}
                    className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    title="Select for deletion"
                  >
                    {isSelected
                      ? <CheckSquare className="h-4 w-4 text-red-600" />
                      : <Square className="h-4 w-4" />
                    }
                  </button>

                  {/* Thumbnail */}
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--muted)]">
                    {video.posterUrl ? (
                      <img src={video.posterUrl} alt="" className="h-full w-full object-cover" />
                    ) : video.mp4Url ? (
                      <video
                        src={video.mp4Url}
                        preload="metadata"
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                        onLoadedMetadata={(e) => { (e.currentTarget as HTMLVideoElement).currentTime = 0.1; }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[var(--muted-foreground)]">
                        <Play className="h-4 w-4 opacity-40" />
                      </div>
                    )}
                  </div>

                  {/* Avatar */}
                  {video.avatarUrl && (
                    <img src={video.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]" />
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <PlatformChip url={video.sourceUrl} platform={video.platform} />
                      <StatusBadge status={video.status} errorMsg={video.errorMsg} />
                      {video.handle && (
                        <span className="text-[11px] font-medium text-[var(--foreground)]">
                          {video.handle.startsWith("@") ? video.handle : `@${video.handle}`}
                        </span>
                      )}
                    </div>
                    <a
                      href={video.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] truncate max-w-sm"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{video.sourceUrl}</span>
                    </a>
                    {video.status === "error" && video.errorMsg && (
                      <p className="mt-1 text-[10px] text-red-500 truncate max-w-sm" title={video.errorMsg}>
                        {video.errorMsg}
                      </p>
                    )}
                  </div>

                  {/* Featured toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="Show in Featured carousel">
                    <input
                      type="checkbox"
                      checked={video.isFeatured ?? false}
                      onChange={(e) => updateVideo({ id: video._id, isFeatured: e.target.checked })}
                      className="h-3.5 w-3.5 accent-red-600"
                    />
                    <span className="text-[11px] text-[var(--muted-foreground)]">Featured</span>
                  </label>

                  {/* Videos section toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="Show in Videos grid section">
                    <input
                      type="checkbox"
                      checked={(video as { showInVideos?: boolean }).showInVideos ?? false}
                      onChange={(e) => updateVideo({ id: video._id, showInVideos: e.target.checked })}
                      className="h-3.5 w-3.5 accent-red-600"
                    />
                    <span className="text-[11px] text-[var(--muted-foreground)]">Videos</span>
                  </label>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Avatar upload */}
                    <AvatarUploadButton sourceUrl={video.sourceUrl} />

                    {(video.status === "error" || video.status === "pending") && (
                      <button
                        onClick={() => handleRequeue(video)}
                        disabled={requeuing === video._id}
                        title="Re-run download pipeline"
                        className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
                      >
                        {requeuing === video._id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RefreshCw className="h-4 w-4" />
                        }
                      </button>
                    )}

                    {/* Single-row delete */}
                    <button
                      onClick={() => {
                        if (confirm("Remove this video?")) removeVideo({ id: video._id });
                      }}
                      title="Delete"
                      className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">How it works</h3>
        <ol className="list-decimal list-inside space-y-1 text-xs text-[var(--muted-foreground)]">
          <li>Paste a social media URL and click <strong>Add Video</strong> — the pipeline downloads the video, thumbnail, and avatar automatically</li>
          <li><strong>Featured</strong> — video appears in the large carousel hero on the Destacados page (does not appear in the Videos grid unless also checked)</li>
          <li><strong>Videos</strong> — video appears in the Videos grid section below the carousel (max 18 videos, 3 rows). Does not appear in the Featured carousel unless also checked</li>
          <li>A video checked as both <strong>Featured</strong> and <strong>Videos</strong> appears in both places</li>
          <li>A video with neither checked is stored but not shown publicly — use the checkboxes on the left to select multiple and delete them at once</li>
          <li>Click the <strong>camera icon</strong> to manually upload a profile avatar (useful for Instagram)</li>
          <li>If a download fails, click the <strong>refresh icon</strong> to retry</li>
        </ol>
      </div>
    </div>
  );
}
