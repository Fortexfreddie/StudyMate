import Link from "next/link";
import { Home } from "lucide-react";
import { NotFoundIllustration } from "@/components/shared/ErrorIllustrations";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-main p-6 text-center">
      <div className="flex flex-col items-center gap-6 max-w-[420px] animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Beautiful premium custom illustration */}
        <div className="relative flex items-center justify-center w-full">
          <NotFoundIllustration />
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold tracking-widest uppercase text-brand-primary/80">
            Error 404
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Lost in Outer Space?
          </h1>
          <p className="text-sm text-text-muted leading-relaxed max-w-[340px] mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved to another coordinate.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 rounded-2xl py-3.5 px-7 bg-brand-primary text-black hover:bg-brand-primary-hover font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-primary/5 hover:shadow-brand-primary/15 cursor-pointer"
        >
          <Home className="h-4 w-4" strokeWidth={2.2} />
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}

