"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional heading shown in the modal header alongside an icon. */
  title?: ReactNode;
  /** Optional glyph rendered in the gold header badge. */
  icon?: ReactNode;
  children: ReactNode;
  /** Tailwind max-width class for the panel. Defaults to a small dialog. */
  maxWidth?: string;
  /** Hide the top-right close button (e.g. flows that own their own controls). */
  hideClose?: boolean;
  /** Disable backdrop-click / Escape close (e.g. while an action is in flight). */
  dismissable?: boolean;
  className?: string;
}

/**
 * Shared dialog shell. Mirrors the visual language already established by
 * ConfirmDialog (same backdrop blur, surface-modal panel, rounded-3xl, subtle
 * scale-in entrance) so every modal in the app reads as one family rather than
 * a collection of one-off overlays. Handles backdrop/Escape close and body
 * scroll-lock; the caller owns the body content. Presentational only.
 */
export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  maxWidth = "max-w-sm",
  hideClose = false,
  dismissable = true,
  className = "",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => dismissable && onClose()}
    >
      <div
        className={`gpu-isolate bg-surface-modal border border-border-subtle rounded-3xl p-6 w-full flex flex-col gap-4 shadow-2xl shadow-black/50 text-left animate-in scale-in duration-300 ${maxWidth} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || icon || !hideClose) && (
          <div className="flex items-center gap-3">
            {icon && (
              <div className="h-10 w-10 rounded-2xl border border-accent-gold/20 bg-accent-gold/10 text-accent-gold flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            {title && (
              <h3 className="text-base font-extrabold text-white flex-1 min-w-0">{title}</h3>
            )}
            {!hideClose && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="h-8 w-8 rounded-full flex items-center justify-center text-text-muted hover:text-white hover:bg-white/5 transition cursor-pointer shrink-0"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
