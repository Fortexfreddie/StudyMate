"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface LegalLayoutProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Shared chrome for the static legal pages (Privacy, Terms). */
export function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-bg-main text-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-[720px] flex flex-col gap-6">
        <header className="flex items-center gap-3 w-full pb-4 border-b border-border-subtle">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-card-bg border border-border-subtle hover:bg-white/5 transition cursor-pointer shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">{title}</h1>
            <span className="text-[11px] text-text-muted">Last updated: {updated}</span>
          </div>
        </header>

        <article className="flex flex-col gap-6 text-sm text-text-muted leading-relaxed">
          {children}
        </article>

        <footer className="pt-4 mt-2 border-t border-border-subtle flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted">
          <Link href="/privacy" className="hover:text-brand-primary transition">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-brand-primary transition">
            Terms of Service
          </Link>
          <Link href="/login" className="hover:text-brand-primary transition">
            Back to Login
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** A titled section block used across the legal pages. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm sm:text-base font-extrabold text-white">{heading}</h2>
      {children}
    </section>
  );
}
