"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Search, Bell, HelpCircle, FileUp, FileText, ChevronRight, Plus } from "lucide-react";
import { ProgressRing } from "./components/ProgressRing";
import { DocumentCard } from "./components/DocumentCard";
import { IconButton } from "@/components/shared/IconButton";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/components/providers/AuthProvider";
import { getFirstName } from "@/lib/user";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { getDocumentColor, getDocumentCategory } from "@/lib/format";

// Soft caps used only to turn raw counts into a ring percentage (visual scale).
const RING_SCALE = { quizzes: 20, documents: 15, summaries: 15 };

function pct(value: number, scale: number): number {
  return Math.min(100, Math.round((value / scale) * 100));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const { data: docData, isLoading: docsLoading } = useApi(
    () => api.documents.list(),
    []
  );
  const { data: stats } = useApi(() => api.stats.get(), []);

  const documents = docData?.documents ?? [];
  const recentDocs = documents.slice(0, 4);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const cardWidthWithGap = 236;
    const newIndex = Math.round(scrollContainerRef.current.scrollLeft / cardWidthWithGap);
    setActiveCardIndex(Math.min(Math.max(newIndex, 0), Math.max(recentDocs.length - 1, 0)));
  };

  const handleDotClick = (index: number) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({ left: index * 236, behavior: "smooth" });
    setActiveCardIndex(index);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
      <header className="flex items-center justify-between w-full mb-8">
        <h2 className="text-xl sm:text-2xl text-white font-normal leading-tight">
          Hello, <span className="font-extrabold">{getFirstName(user)}</span>
        </h2>
        <div className="flex items-center gap-3">
          <IconButton aria-label="Search" icon={<Search className="h-4.5 w-4.5 text-white" />} />
          <IconButton aria-label="Notifications" dot icon={<Bell className="h-4.5 w-4.5 text-white" />} />
        </div>
      </header>

      {/* Progress rings — real counts */}
      <section className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 sm:p-6 mb-8 flex flex-row flex-wrap items-center justify-around gap-6 shadow-lg shadow-black/20">
        <ProgressRing
          percentage={pct(stats?.quizzes_taken ?? 0, RING_SCALE.quizzes)}
          label="Quizzes"
          sublabel={`${stats?.quizzes_taken ?? 0} Taken`}
          strokeColor="#f09e5b"
          icon={<HelpCircle className="h-4.5 w-4.5 text-brand-primary" />}
        />
        <div className="hidden sm:block h-12 w-[1px] bg-border-subtle" />
        <ProgressRing
          percentage={pct(stats?.documents_uploaded ?? 0, RING_SCALE.documents)}
          label="Documents"
          sublabel={`${stats?.documents_uploaded ?? 0} Uploaded`}
          strokeColor="#e58e49"
          icon={<FileUp className="h-4.5 w-4.5 text-[#e58e49]" />}
        />
        <div className="hidden sm:block h-12 w-[1px] bg-border-subtle" />
        <ProgressRing
          percentage={pct(stats?.summaries_generated ?? 0, RING_SCALE.summaries)}
          label="Summaries"
          sublabel={`${stats?.summaries_generated ?? 0} Generated`}
          strokeColor="#ef6868"
          icon={<FileText className="h-4.5 w-4.5 text-accent-coral" />}
        />
      </section>

      {/* Recent Documents */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">Recent Documents</h2>
          <Link href="/dashboard/documents" className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline">
            View all
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {docsLoading ? (
          <LoadingState className="py-10" label="Loading documents…" />
        ) : recentDocs.length === 0 ? (
          <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-8 flex flex-col items-center text-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-surface-raised flex items-center justify-center text-text-muted">
              <FileText className="h-6 w-6" />
            </span>
            <p className="text-sm font-bold text-white">No documents yet</p>
            <p className="text-xs text-text-muted max-w-[260px]">
              Upload your first PDF to start studying with AI.
            </p>
            <Link
              href="/dashboard/upload"
              className="mt-1 py-2.5 px-4 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold rounded-full text-xs flex items-center gap-1.5 transition"
            >
              <Plus className="h-4 w-4 stroke-[3px]" />
              Upload Document
            </Link>
          </div>
        ) : (
          <>
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 overflow-x-auto md:overflow-x-visible pt-2 pb-6 px-1 no-scrollbar snap-x snap-mandatory"
            >
              {recentDocs.map((doc) => {
                const { bgColor, textColor } = getDocumentColor(doc.doc_id);
                return (
                  <div key={doc.doc_id} className="snap-start shrink-0 w-[215px] sm:w-[220px] md:w-full">
                    <DocumentCard
                      id={doc.doc_id}
                      title={doc.filename}
                      bgColor={bgColor}
                      textColor={textColor}
                      type={getDocumentCategory(doc.filename)}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex md:hidden items-center justify-center gap-2 mt-2 w-full">
              {recentDocs.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeCardIndex === index ? "w-6 bg-white" : "w-1.5 bg-border-subtle"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Quick CTA to history */}
      <section className="flex flex-col gap-4 mt-8">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">Keep Studying</h2>
          <Link href="/dashboard/history" className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline">
            View history
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex items-center justify-between gap-4 shadow-lg shadow-black/20">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-white">
              {stats?.current_streak ? `🔥 ${stats.current_streak}-day streak` : "Start your streak today"}
            </span>
            <span className="text-xs text-text-muted">
              {stats
                ? `${stats.chats_count} chats • ${stats.quizzes_taken} quizzes • ${stats.summaries_generated} summaries`
                : "Upload a document and dive in."}
            </span>
          </div>
          <Link
            href="/dashboard/upload"
            className="py-2.5 px-4 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold rounded-full text-xs flex items-center gap-1.5 transition shrink-0"
          >
            <Plus className="h-4 w-4 stroke-[3px]" />
            New
          </Link>
        </div>
      </section>
    </div>
  );
}
