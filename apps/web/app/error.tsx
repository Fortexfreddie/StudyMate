"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCw } from "lucide-react";
import { ErrorIllustration } from "@/components/shared/ErrorIllustrations";

// Route-level error boundary. Catches render/runtime errors in any page below the
// root layout and shows a branded recovery screen instead of Next.js's default.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for debugging; replace with a real logger if added later.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-main p-6 text-center">
      <div className="flex flex-col items-center gap-6 max-w-[420px] animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Beautiful premium custom illustration */}
        <div className="relative flex items-center justify-center w-full">
          <ErrorIllustration />
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold tracking-widest uppercase text-error-text/80">
            System Error
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-text-muted leading-relaxed max-w-[340px] mx-auto">
            An unexpected glitch occurred while loading this page. Let&apos;s try to refresh it, or you can head back to safety.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 px-6 bg-brand-primary text-black hover:bg-brand-primary-hover font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-primary/5 hover:shadow-brand-primary/15 w-full cursor-pointer"
          >
            <RotateCw className="h-4 w-4" strokeWidth={2.2} />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 px-6 bg-transparent border border-border-subtle text-white hover:bg-white/5 font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] w-full"
          >
            <Home className="h-4 w-4" strokeWidth={2.2} />
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

