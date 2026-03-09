"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  FileText,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  MinusCircle,
  Zap,
  Search,
} from "lucide-react";

// ─── Status Badge ────────────────────────────────────────────────────────────

type DocStatus = {
  status: string;
  extractedAt?: number;
  error?: string;
};

function StatusBadge({
  status,
  hasData,
  hasUrl,
  onClick,
}: {
  status?: DocStatus;
  hasData: boolean;
  hasUrl: boolean;
  onClick?: () => void;
}) {
  const baseClass =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";

  // If extraction is processing
  if (status?.status === "processing") {
    return (
      <span
        className={`${baseClass} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300`}
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Extracting…
      </span>
    );
  }

  // If we have data (success)
  if (hasData) {
    return (
      <button
        onClick={onClick}
        title={
          status?.extractedAt
            ? `Extracted ${new Date(status.extractedAt).toLocaleDateString()}\nClick to re-extract`
            : "Click to re-extract"
        }
        className={`${baseClass} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 cursor-pointer transition-colors`}
      >
        <CheckCircle className="h-3 w-3" /> Done
      </button>
    );
  }

  // Error
  if (status?.status === "error") {
    return (
      <button
        onClick={onClick}
        title={status.error || "Error — click to retry"}
        className={`${baseClass} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 cursor-pointer cursor-help transition-colors`}
      >
        <AlertCircle className="h-3 w-3" /> Error
      </button>
    );
  }

  // No document URL
  if (!hasUrl) {
    return (
      <span
        className={`${baseClass} bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500`}
      >
        <MinusCircle className="h-3 w-3" /> N/A
      </span>
    );
  }

  // Pending (has URL but no data)
  return (
    <button
      onClick={onClick}
      title="Click to extract"
      className={`${baseClass} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 cursor-pointer transition-colors`}
    >
      <Clock className="h-3 w-3" /> Pending
    </button>
  );
}

// ─── URL Validation (same logic as extraction script) ───────────────────────

function isValidDocUrl(url?: string): boolean {
  if (!url) return false;
  if (url.endsWith("/1") || url.endsWith("1")) return false;
  if (!url.includes("drive-image/")) return false;
  return true;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExtractionAdminPage() {
  const data = useQuery(api.documentExtractionHelpers.getExtractionStatus);
  const triggerExtractDeputy = useAction(
    api.documentExtraction.triggerExtractDeputy
  );
  const triggerExtractAll = useAction(
    api.documentExtraction.triggerExtractAll
  );

  const [extractingAll, setExtractingAll] = useState(false);
  const [extractingDeputy, setExtractingDeputy] = useState<string | null>(null);
  const [extractingCell, setExtractingCell] = useState<string | null>(null);
  const [extractAllMsg, setExtractAllMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter data by search
  const filtered = data?.filter((d) =>
    d.politicianName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute stats
  const stats = data
    ? {
        total: data.length,
        propuestaDone: data.filter((d) => d.hasExtractedPropuesta).length,
        interesesDone: data.filter((d) => d.hasExtractedIntereses).length,
        patrimonioDone: data.filter((d) => d.hasExtractedPatrimonio).length,
        propuestaUrl: data.filter((d) =>
          isValidDocUrl(
            (d.documents as Record<string, string>)?.propuestaPoliticaUrl
          )
        ).length,
        interesesUrl: data.filter((d) =>
          isValidDocUrl(
            (d.documents as Record<string, string>)?.declaracionInteresesUrl
          )
        ).length,
        patrimonioUrl: data.filter((d) =>
          isValidDocUrl(
            (d.documents as Record<string, string>)?.declaracionPatrimonioUrl
          )
        ).length,
        errors: data.filter(
          (d) =>
            (d.extractionStatus as any)?.propuesta?.status === "error" ||
            (d.extractionStatus as any)?.intereses?.status === "error" ||
            (d.extractionStatus as any)?.patrimonio?.status === "error"
        ).length,
      }
    : null;

  const handleExtractAll = async () => {
    setExtractingAll(true);
    setExtractAllMsg("");
    try {
      const result = await triggerExtractAll({ skipExisting: true });
      setExtractAllMsg(
        `Scheduled ${result.scheduledDeputies} deputies for extraction`
      );
    } catch (e) {
      setExtractAllMsg(`Error: ${e}`);
    } finally {
      setExtractingAll(false);
    }
  };

  const handleExtractDeputy = async (
    politicianId: Id<"politicians">,
    docTypes?: ("propuesta" | "intereses" | "patrimonio")[]
  ) => {
    const key = `${politicianId}${docTypes ? `-${docTypes.join(",")}` : ""}`;
    if (docTypes) {
      setExtractingCell(key);
    } else {
      setExtractingDeputy(politicianId);
    }
    try {
      await triggerExtractDeputy({ politicianId, docTypes });
    } finally {
      if (docTypes) {
        setExtractingCell(null);
      } else {
        setExtractingDeputy(null);
      }
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            PDF Extraction
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Extract structured data from deputy PDF documents using AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          {extractAllMsg && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {extractAllMsg}
            </span>
          )}
          <button
            onClick={handleExtractAll}
            disabled={extractingAll}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {extractingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {extractingAll ? "Scheduling…" : "Extract All (Skip Existing)"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Deputies</p>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Propuestas</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.propuestaDone}
              <span className="text-sm font-normal text-[var(--muted-foreground)]">
                /{stats.propuestaUrl}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Intereses</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.interesesDone}
              <span className="text-sm font-normal text-[var(--muted-foreground)]">
                /{stats.interesesUrl}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Patrimonio</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.patrimonioDone}
              <span className="text-sm font-normal text-[var(--muted-foreground)]">
                /{stats.patrimonioUrl}
              </span>
            </p>
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
        {/* Table header */}
        <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-5 py-3">
          <div className="grid grid-cols-[1fr_80px_100px_100px_100px_80px] gap-2 items-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <span>Deputy</span>
            <span>Party</span>
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
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {searchQuery ? "No deputies match your search" : "No deputies found"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered?.map((deputy) => {
              const docs = deputy.documents as Record<string, string> | undefined;
              const status = deputy.extractionStatus as {
                propuesta?: DocStatus;
                intereses?: DocStatus;
                patrimonio?: DocStatus;
              } | undefined;

              const isExtracting = extractingDeputy === deputy.politicianId;

              return (
                <li
                  key={deputy._id}
                  className="grid grid-cols-[1fr_80px_100px_100px_100px_80px] gap-2 items-center px-5 py-3 hover:bg-[var(--muted)]/30 transition-colors"
                >
                  {/* Name */}
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">
                    {deputy.politicianName}
                  </span>

                  {/* Party */}
                  <span className="text-xs text-[var(--muted-foreground)] truncate">
                    {deputy.partyCode}
                  </span>

                  {/* Propuesta */}
                  <div className="flex justify-center">
                    <StatusBadge
                      status={status?.propuesta}
                      hasData={deputy.hasExtractedPropuesta}
                      hasUrl={isValidDocUrl(docs?.propuestaPoliticaUrl)}
                      onClick={() =>
                        handleExtractDeputy(deputy.politicianId, ["propuesta"])
                      }
                    />
                  </div>

                  {/* Intereses */}
                  <div className="flex justify-center">
                    <StatusBadge
                      status={status?.intereses}
                      hasData={deputy.hasExtractedIntereses}
                      hasUrl={isValidDocUrl(docs?.declaracionInteresesUrl)}
                      onClick={() =>
                        handleExtractDeputy(deputy.politicianId, ["intereses"])
                      }
                    />
                  </div>

                  {/* Patrimonio */}
                  <div className="flex justify-center">
                    <StatusBadge
                      status={status?.patrimonio}
                      hasData={deputy.hasExtractedPatrimonio}
                      hasUrl={isValidDocUrl(docs?.declaracionPatrimonioUrl)}
                      onClick={() =>
                        handleExtractDeputy(deputy.politicianId, [
                          "patrimonio",
                        ])
                      }
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-center">
                    <button
                      onClick={() =>
                        handleExtractDeputy(deputy.politicianId)
                      }
                      disabled={isExtracting}
                      title="Extract all available documents"
                      className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 disabled:opacity-40 transition-colors"
                    >
                      {isExtracting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
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
            Click <strong>Extract All</strong> to process all deputies with
            available PDFs (skips already-extracted ones)
          </li>
          <li>
            Click the <strong>refresh icon</strong> on a row to re-extract all
            documents for that deputy
          </li>
          <li>
            Click any <strong>status badge</strong> to extract or re-extract
            that specific document type
          </li>
          <li>
            Extraction runs server-side — downloads the PDF, extracts text, and
            sends to Claude AI for structured data extraction
          </li>
          <li>
            Large scanned PDFs (&gt;25MB) are automatically split into page
            chunks for processing
          </li>
          <li>
            Results appear on politician detail pages as interactive KPI cards
          </li>
        </ol>
      </div>
    </div>
  );
}
