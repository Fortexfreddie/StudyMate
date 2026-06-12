"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  loadingLabel = "Deleting...",
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="bg-surface-modal border border-border-subtle rounded-3xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-2xl animate-scale-in text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-extrabold text-white">{title}</h3>
        </div>

        <div className="text-xs text-text-muted leading-relaxed">{message}</div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <button
            disabled={loading}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full border border-border-subtle hover:bg-input-bg text-xs font-bold text-white transition cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
