"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  HardDrive,
  Loader2,
  CheckCircle,
  Clock,
  MinusCircle,
  Zap,
  Search,
  Download,
} from "lucide-react";

// ─── Migration Status Badge ─────────────────────────────────────────────────

function MigrationBadge({
  hasExternal,
  hasMigrated,
  onClick,
}: {
  hasExternal: boolean;
  hasMigrated: boolean;
  onClick?: () => void;
}) {
  const baseClass =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";

  if (hasMigrated) {
    return (
      <span
        className={`${baseClass} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300`}
      >
        <CheckCircle className="h-3 w-3" /> Stored
      </span>
    );
  }

  if (!hasExternal) {
    return (
      <span
        className={`${baseClass} bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500`}
      >
        <MinusCircle className="h-3 w-3" /> N/A
      </span>
    );
  }

  // Has external URL but not yet migrated
  return (
    <button
      onClick={onClick}
      title="Click to migrate to Convex storage"
      className={`${baseClass} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 cursor-pointer transition-colors`}
    >
      <Clock className="h-3 w-3" /> Pending
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DocumentsAdminPage() {
  const data = useQuery(api.documentStorageHelpers.getMigrationStatus);
  const migrateDeputy = useAction(api.documentStorage.migrateDeputyDocuments);
  const migrateAll = useAction(api.documentStorage.migrateAllDocuments);

  const [migratingAll, setMigratingAll] = useState(false);
  const [migratingDeputy, setMigratingDeputy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = data?.deputies.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMigrateAll = async () => {
    setMigratingAll(true);
    setMessage("");
    try {
      const result = await migrateAll({});
      setMessage(
        `Scheduled ${result.scheduled} documents across ${result.deputies} deputies`
      );
    } catch (e) {
      setMessage(`Error: ${e}`);
    } finally {
      setMigratingAll(false);
    }
  };

  const handleMigrateDeputy = async (
    transparencyId: Id<"deputyTransparency">
  ) => {
    setMigratingDeputy(transparencyId);
    try {
      const result = await migrateDeputy({ transparencyId });
      if (result.scheduled === 0) {
        setMessage(result.message || "Nothing to migrate");
      }
    } finally {
      setMigratingDeputy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Document Storage
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Migrate public documents from espaciocivico.org to self-hosted Convex
            storage
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {message}
            </span>
          )}
          <button
            onClick={handleMigrateAll}
            disabled={migratingAll || data?.pendingDocs === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {migratingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {migratingAll ? "Scheduling..." : "Migrate All Pending"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Total Documents
            </p>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {data.totalDocs}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Self-Hosted
            </p>
            <p className="text-2xl font-bold text-green-600">
              {data.migratedDocs}
              <span className="text-sm font-normal text-[var(--muted-foreground)]">
                /{data.totalDocs}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Pending</p>
            <p className="text-2xl font-bold text-amber-600">
              {data.pendingDocs}
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {data && data.totalDocs > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[var(--muted-foreground)]">
              Migration Progress
            </span>
            <span className="text-xs font-medium text-[var(--foreground)]">
              {Math.round((data.migratedDocs / data.totalDocs) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--muted)]">
            <div
              className="h-2 rounded-full bg-green-500 transition-all duration-500"
              style={{
                width: `${(data.migratedDocs / data.totalDocs) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search deputies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-5 py-3">
          <div className="grid grid-cols-[1fr_90px_90px_90px_90px_70px] gap-2 items-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <span>Deputy</span>
            <span className="text-center">CV</span>
            <span className="text-center">Propuesta</span>
            <span className="text-center">Intereses</span>
            <span className="text-center">Patrimonio</span>
            <span className="text-center">Actions</span>
          </div>
        </div>

        {!data ? (
          <div className="flex items-center justify-center py-16 text-[var(--muted-foreground)]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--muted-foreground)]">
            <HardDrive className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {searchQuery
                ? "No deputies match your search"
                : "No deputies found"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered?.map((deputy) => {
              const isMigrating =
                migratingDeputy === deputy.transparencyId;

              return (
                <li
                  key={deputy.transparencyId}
                  className="grid grid-cols-[1fr_90px_90px_90px_90px_70px] gap-2 items-center px-5 py-3 hover:bg-[var(--muted)]/30 transition-colors"
                >
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">
                    {deputy.name}
                  </span>

                  {/* CV */}
                  <div className="flex justify-center">
                    <MigrationBadge
                      hasExternal={deputy.status.cv.hasExternal}
                      hasMigrated={deputy.status.cv.hasMigrated}
                      onClick={() =>
                        handleMigrateDeputy(
                          deputy.transparencyId as Id<"deputyTransparency">
                        )
                      }
                    />
                  </div>

                  {/* Propuesta */}
                  <div className="flex justify-center">
                    <MigrationBadge
                      hasExternal={deputy.status.propuesta.hasExternal}
                      hasMigrated={deputy.status.propuesta.hasMigrated}
                      onClick={() =>
                        handleMigrateDeputy(
                          deputy.transparencyId as Id<"deputyTransparency">
                        )
                      }
                    />
                  </div>

                  {/* Intereses */}
                  <div className="flex justify-center">
                    <MigrationBadge
                      hasExternal={deputy.status.intereses.hasExternal}
                      hasMigrated={deputy.status.intereses.hasMigrated}
                      onClick={() =>
                        handleMigrateDeputy(
                          deputy.transparencyId as Id<"deputyTransparency">
                        )
                      }
                    />
                  </div>

                  {/* Patrimonio */}
                  <div className="flex justify-center">
                    <MigrationBadge
                      hasExternal={deputy.status.patrimonio.hasExternal}
                      hasMigrated={deputy.status.patrimonio.hasMigrated}
                      onClick={() =>
                        handleMigrateDeputy(
                          deputy.transparencyId as Id<"deputyTransparency">
                        )
                      }
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-center">
                    <button
                      onClick={() =>
                        handleMigrateDeputy(
                          deputy.transparencyId as Id<"deputyTransparency">
                        )
                      }
                      disabled={isMigrating}
                      title="Migrate all documents for this deputy"
                      className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 disabled:opacity-40 transition-colors"
                    >
                      {isMigrating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
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
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          How it works
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-xs text-[var(--muted-foreground)]">
          <li>
            Click <strong>Migrate All Pending</strong> to download all external
            PDFs and store them in Convex
          </li>
          <li>
            Click the <strong>download icon</strong> on a row to migrate all
            documents for that deputy
          </li>
          <li>
            Documents are downloaded from espaciocivico.org and stored in Convex
            file storage
          </li>
          <li>
            Once migrated, the public-facing document links will serve from your
            own Convex storage instead of espaciocivico.org
          </li>
          <li>
            External URLs are preserved as fallback — if migration fails, the
            original links still work
          </li>
        </ol>
      </div>
    </div>
  );
}
