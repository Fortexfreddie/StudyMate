"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Search, Bell, HelpCircle, FileUp, FileText, ChevronRight, Award, BookOpen } from "lucide-react";
import { ProgressRing } from "./components/ProgressRing";
import { DocumentCard } from "./components/DocumentCard";
import { IconButton } from "@/components/shared/IconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { getFirstName } from "@/lib/user";
import { MOCK_DOCUMENTS } from "@/lib/mocks";

export default function DashboardPage() {
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft } = scrollContainerRef.current;
    // w-[220px] card + gap-4 (16px) = 236px
    const cardWidthWithGap = 236;
    const newIndex = Math.round(scrollLeft / cardWidthWithGap);
    setActiveCardIndex(Math.min(Math.max(newIndex, 0), MOCK_DOCUMENTS.length - 1));
  };

  const handleDotClick = (index: number) => {
    if (!scrollContainerRef.current) return;
    const cardWidthWithGap = 236;
    scrollContainerRef.current.scrollTo({
      left: index * cardWidthWithGap,
      behavior: "smooth",
    });
    setActiveCardIndex(index);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">

        {/* Header greeting & buttons */}
        <header className="flex items-center justify-between w-full mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl text-white font-normal leading-tight">
              Hello, <span className="font-extrabold">{getFirstName(user)}</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <IconButton aria-label="Search" icon={<Search className="h-4.5 w-4.5 text-white" />} />
            <IconButton aria-label="Notifications" dot icon={<Bell className="h-4.5 w-4.5 text-white" />} />
          </div>
        </header>

        {/* Progress Dials Gauges Panel */}
        <section className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 sm:p-6 mb-8 flex flex-row flex-wrap items-center justify-around gap-6 shadow-lg shadow-black/20">
          <ProgressRing
            percentage={60}
            label="Quizzes"
            sublabel="Taken"
            strokeColor="#f09e5b"
            icon={<HelpCircle className="h-4.5 w-4.5 text-brand-primary" />}
          />
          
          <div className="hidden sm:block h-12 w-[1px] bg-border-subtle" />

          <ProgressRing
            percentage={78}
            label="Documents"
            sublabel="Uploaded"
            strokeColor="#e58e49"
            icon={<FileUp className="h-4.5 w-4.5 text-[#e58e49]" />}
          />

          <div className="hidden sm:block h-12 w-[1px] bg-border-subtle" />

          <ProgressRing
            percentage={45}
            label="Summaries"
            sublabel="Generated"
            strokeColor="#ef6868"
            icon={<FileText className="h-4.5 w-4.5 text-accent-coral" />}
          />
        </section>

        {/* Recent Documents Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
              Recent Documents
            </h2>
            <Link href="/dashboard/documents" className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline">
              View all
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Documents Grid / Horizontal slider */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 overflow-x-auto md:overflow-x-visible pt-2 pb-6 px-1 no-scrollbar snap-x snap-mandatory"
          >
            {MOCK_DOCUMENTS.map((doc) => (
              <div key={doc.doc_id} className="snap-start shrink-0 w-[215px] sm:w-[220px] md:w-full">
                <DocumentCard
                  id={doc.doc_id}
                  title={doc.filename}
                  bgColor={doc.bgColor}
                  textColor={doc.textColor}
                  type={doc.category}
                />
              </div>
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="flex md:hidden items-center justify-center gap-2 mt-2 w-full">
            {MOCK_DOCUMENTS.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeCardIndex === index ? "w-6 bg-white" : "w-1.5 bg-border-subtle"
                }`}
              />
            ))}
          </div>
        </section>

        {/* Recent Activity Section */}
        <section className="flex flex-col gap-4 mt-8">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
              Recent Activity
            </h2>
            <Link href="/dashboard/history" className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline">
              View all
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 shadow-lg shadow-black/20">
            {/* Item 1 */}
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white leading-tight">
                    Completed Quiz: Data Structures
                  </span>
                  <span className="text-xs text-text-muted leading-tight mt-1">
                    Score: 80% • 2 hours ago
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-full px-2.5 py-1">
                +15 XP
              </span>
            </div>

            <div className="h-[1px] w-full bg-border-subtle" />

            {/* Item 2 */}
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-accent-coral/10 border border-accent-coral/20 flex items-center justify-center text-accent-coral shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white leading-tight">
                    Generated Summary: Anatomy Essentials
                  </span>
                  <span className="text-xs text-text-muted leading-tight mt-1">
                    12 pages summarized • 1 day ago
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-accent-coral bg-accent-coral/10 border border-accent-coral/20 rounded-full px-2.5 py-1">
                Summary
              </span>
            </div>
          </div>
        </section>

    </div>
  );
}
