"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PartyEditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Party edit page error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-6 py-12 px-4">
      <div className="rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
        <h2 className="text-lg font-bold text-red-700 dark:text-red-400">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error.message}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-red-500 font-mono">
            Digest: {error.digest}
          </p>
        )}
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-red-100 p-3 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
          {error.stack}
        </pre>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/admin/parties"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          Back to Parties
        </Link>
      </div>
    </div>
  );
}
