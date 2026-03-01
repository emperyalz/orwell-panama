"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Delete",
  danger = true,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-full p-2 ${
              danger
                ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
                : "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              {title}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
