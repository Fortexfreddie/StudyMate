"use client";

import { useEffect } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";

export interface ToastState {
  message: string;
  variant: "success" | "error";
}

interface AdminToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
  // Auto-dismiss delay in ms.
  duration?: number;
}

// Floating status pill, lifted from the profile page pattern. Success is gold
// (matching the rest of the app); error is the shared error-text token.
export function AdminToast({ toast, onDismiss, duration = 3000 }: AdminToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast, duration, onDismiss]);

  if (!toast) return null;

  const isError = toast.variant === "error";
  const Icon = isError ? AlertCircle : CheckCircle;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-6 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-md border px-5 py-3 rounded-2xl flex items-center gap-2.5 z-[10000] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ${
        isError ? "border-error-text/20" : "border-accent-gold/20"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isError ? "text-error-text" : "text-accent-gold"}`} />
      <span className="text-xs font-extrabold text-white tracking-wide">{toast.message}</span>
    </div>
  );
}
