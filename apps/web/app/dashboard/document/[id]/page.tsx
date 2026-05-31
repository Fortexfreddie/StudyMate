"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, FileText, ChevronRight, HelpCircle, Sparkles, MessageSquare } from "lucide-react";
import { DocumentDetailIllustration } from "./components/DocumentDetailIllustration";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getMockDocument, formatUploadedAtWithTime } from "@/lib/mocks";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params.id as string) || "data-structures";

  const doc = getMockDocument(id);
  const uploadDate = formatUploadedAtWithTime(doc.uploaded_at);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-[800px] mx-auto w-full">

        <PageHeader
          title={doc.filename}
          onBack={() => router.push("/dashboard")}
          className="mb-6"
        />

        {/* Dynamic Golden Hero card banner */}
        <section
          style={{ backgroundColor: doc.bgColor }}
          className="relative w-full rounded-3xl p-6 mb-6 flex flex-row items-center justify-between overflow-hidden shadow-xl shadow-black/30 min-h-[190px]"
        >
          {/* Card Left details metadata */}
          <div className="flex flex-col flex-1 gap-4 z-10 pr-2">
            <div className="flex flex-col gap-2">
              <h2
                style={{ color: doc.textColor }}
                className="text-lg sm:text-xl font-extrabold leading-tight tracking-tight line-clamp-2 max-w-[280px]"
              >
                {doc.filename}
              </h2>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 border border-white/10 text-xs font-bold leading-none" style={{ color: doc.textColor }}>
                  <FileText className="h-3 w-3" />
                  PDF Document
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 opacity-80" style={{ color: doc.textColor }}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold">{doc.page_count} Pages</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs font-semibold leading-tight">
                  Uploaded on <br className="sm:hidden" /> {uploadDate}
                </span>
              </div>
            </div>
          </div>

          {/* Premium Custom SVG Side-Illustration */}
          <div className="flex flex-1 items-center justify-end z-0 select-none max-w-[125px] sm:max-w-[200px] shrink-0">
            <DocumentDetailIllustration style={{ color: doc.textColor }} />
          </div>
        </section>

        {/* Action Panel items stacked */}
        <section className="flex flex-col gap-4">
          
          {/* Option 1: Generate Quiz */}
          <Link href={`/dashboard/quiz?doc=${id}`}>
            <div className="w-full bg-card-bg border border-border-subtle hover:border-brand-primary/20 rounded-3xl p-4 sm:p-5 flex items-center justify-between transition-all duration-200 cursor-pointer shadow-lg shadow-black/20 group">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary group-hover:scale-105 transition duration-200">
                  <HelpCircle className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-extrabold text-white leading-snug">
                    Generate Quiz
                  </span>
                  <span className="text-xs text-text-muted leading-tight mt-0.5 max-w-[200px] sm:max-w-md">
                    Create a quiz from this document to test your knowledge.
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-text-muted group-hover:translate-x-1 transition duration-200" />
            </div>
          </Link>

          {/* Option 2: Summarize Document */}
          <Link href={`/dashboard/summary?doc=${id}`}>
            <div className="w-full bg-card-bg border border-border-subtle hover:border-accent-coral/20 rounded-3xl p-4 sm:p-5 flex items-center justify-between transition-all duration-200 cursor-pointer shadow-lg shadow-black/20 group">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-accent-coral/10 border border-accent-coral/20 flex items-center justify-center text-accent-coral group-hover:scale-105 transition duration-200">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-extrabold text-white leading-snug">
                    Summarize Document
                  </span>
                  <span className="text-xs text-text-muted leading-tight mt-0.5 max-w-[200px] sm:max-w-md">
                    Get an AI-powered summary of this document in seconds.
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-text-muted group-hover:translate-x-1 transition duration-200" />
            </div>
          </Link>

          {/* Option 3: Ask a Question (Gold Highlight Callout) */}
          <Link href={`/dashboard/chat?doc=${id}`}>
            <div className="w-full bg-brand-primary hover:bg-brand-primary-hover rounded-3xl p-4 sm:p-5 flex items-center justify-between transition-all duration-200 cursor-pointer shadow-lg shadow-brand-primary/10 group">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-bg-main flex items-center justify-center text-brand-primary group-hover:scale-105 transition duration-200">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-extrabold text-accent-gold-fg leading-snug">
                    Ask a Question
                  </span>
                  <span className="text-xs text-[#52331c]/80 font-semibold leading-tight mt-0.5 max-w-[200px] sm:max-w-md">
                    Chat with AI about this document and get instant answers.
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-accent-gold-fg group-hover:translate-x-1 transition duration-200" />
            </div>
          </Link>

        </section>

    </div>
  );
}
