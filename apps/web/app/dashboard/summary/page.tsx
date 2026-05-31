"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, FileText, Check, ChevronDown, ChevronUp, Download, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { GeneratingState } from "@/components/dashboard/GeneratingState";
import { getMockDocument, getDocumentTitle } from "@/lib/mocks";

const MOCK_SUMMARY_BULLETS = [
  "Linear structures (Arrays, Linked Lists, Stacks, Queues) store elements sequentially, providing O(1) index accesses but O(n) average search limits.",
  "Hierarchical systems (Trees, Graphs, BSTs) manage structured parent-child links, enabling fast O(log n) lookups and balance alignments.",
  "Big O Complexity analysis serves as the core metric to measure runtime algorithms, ensuring space and time efficiency in production scales.",
];

interface ConceptItem {
  id: string;
  title: string;
  desc: string;
}

const MOCK_CONCEPTS: ConceptItem[] = [
  {
    id: "complexity",
    title: "Big O Complexity Analysis",
    desc: "Complexity guarantees resource boundaries. Time complexity maps calculation operations relative to input sizes, while Space complexity restricts memory footprint caps.",
  },
  {
    id: "linear",
    title: "Linear Stacks and Queues",
    desc: "Stacks manage LIFO (Last In, First Out) rules suited for call execution histories. Queues manage FIFO (First In, First Out) paths ideal for print job scheduling.",
  },
  {
    id: "hierarchy",
    title: "Hierarchical Trees",
    desc: "Trees establish recursive branch divisions. Binary search structures constrain items such that left nodes remain lower and right nodes hold higher values.",
  },
];

interface FlashcardItem {
  id: number;
  front: string;
  back: string;
}

const MOCK_FLASHCARDS: FlashcardItem[] = [
  { id: 1, front: "What is LIFO?", back: "Last In, First Out (the core principle of Stack structures)." },
  { id: 2, front: "What is the complexity of Balanced BST?", back: "O(log n) time complexity for search, insertion, and deletion." },
  { id: 3, front: "What defines a Graph vertex?", back: "A connection link or edge linking two distinct node components." },
];

function SummaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc") || "data-structures";
  const doc = getMockDocument(docId);
  const docTitle = getDocumentTitle(doc);

  const [step, setStep] = useState<"setup" | "generating" | "completed">("setup");
  const [summaryStyle, setSummaryStyle] = useState<string>("Bullet Points");
  const [summaryLength, setSummaryLength] = useState<string>("Balanced");
  const [generatingProgress, setGeneratingProgress] = useState(0);
  
  // Custom states for interactive outputs
  const [expandedConcept, setExpandedConcept] = useState<string | null>("complexity");
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  // Simulation timer for Generating Step
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "generating") {
      setGeneratingProgress(0);
      interval = setInterval(() => {
        setGeneratingProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setStep("completed"), 400);
            return 100;
          }
          return prev + 12;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [step]);

  const toggleConcept = (id: string) => {
    setExpandedConcept((prev) => (prev === id ? null : id));
  };

  const handleCardFlip = (id: number) => {
    setFlippedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-[580px] mx-auto w-full justify-start">

        <PageHeader
          title="Summarize Document"
          onBack={() => {
            if (step === "setup") router.push(`/dashboard/document/${docId}`);
            else setStep("setup");
          }}
          className="mb-6"
        />

        {/* STAGE 1: SETUP SCREEN */}
        {step === "setup" && (
          <section className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Subject summary header preview */}
            <div
              style={{ backgroundColor: doc.bgColor }}
              className="w-full rounded-3xl p-5 flex flex-row items-center justify-between shadow-lg shadow-black/25"
            >
              <div className="flex flex-col gap-2 flex-1 pr-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 text-[10px] font-bold" style={{ color: doc.textColor }}>
                  <FileText className="h-3 w-3" />
                  PDF Summary Source
                </span>
                <h2 style={{ color: doc.textColor }} className="text-sm sm:text-base font-extrabold line-clamp-1">
                  {doc.filename}
                </h2>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-black/10 border border-white/10 shrink-0">
                <span style={{ color: doc.textColor }} className="text-[10px] font-extrabold">{doc.page_count} Pages</span>
              </div>
            </div>

            {/* Selection Setup Card */}
            <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-5 shadow-md shadow-black/15">
              
              {/* Option block 1: Expanded 6 Summary Formats Grid */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-text-muted">Summary Format</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    "Bullet Points",
                    "Key Concepts",
                    "Study Guide",
                    "Flashcards",
                    "Cheat Sheet",
                    "Mind Map",
                  ].map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setSummaryStyle(style)}
                      className={`py-3.5 rounded-2xl font-bold text-[10px] sm:text-xs transition border cursor-pointer leading-tight ${
                        summaryStyle === style
                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                          : "bg-surface/40 border-border-subtle text-text-muted hover:text-white"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[1px] w-full bg-border-subtle" />

              {/* Option block 2: Summary Length */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-text-muted">Detail Level</span>
                <div className="grid grid-cols-3 gap-2">
                  {["Concise", "Balanced", "Detailed"].map((length) => (
                    <button
                      key={length}
                      type="button"
                      onClick={() => setSummaryLength(length)}
                      className={`py-3.5 rounded-2xl font-bold text-[10px] sm:text-xs transition border cursor-pointer ${
                        summaryLength === length
                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                          : "bg-surface/40 border-border-subtle text-text-muted hover:text-white"
                      }`}
                    >
                      {length}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch action button */}
            <button
              onClick={() => setStep("generating")}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold py-4.5 rounded-2xl transition cursor-pointer shadow-lg shadow-brand-primary/15"
            >
              <Sparkles className="h-4.5 w-4.5" />
              Generate Summary
            </button>
          </section>
        )}

        {/* STAGE 2: GENERATING LOADING VIEW */}
        {step === "generating" && (
          <GeneratingState
            title={`Structuring ${summaryStyle}...`}
            subtitle="Synthesizing core PDF concepts"
            progress={generatingProgress}
            progressLabel={`${generatingProgress}% Synthesized`}
            accentClass="text-accent-coral"
            accentColor="var(--color-accent-coral)"
          />
        )}

        {/* STAGE 3: SUMMARY COMPLETED OUTPUT VIEW */}
        {step === "completed" && (
          <section className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
            {/* Subject Hero Header badge */}
            <div
              style={{ backgroundColor: doc.bgColor }}
              className="w-full rounded-3xl p-5 flex flex-col gap-2 shadow-lg shadow-black/25"
            >
              <span className="text-[9px] font-black uppercase tracking-widest leading-none opacity-80" style={{ color: doc.textColor }}>
                Completed {summaryStyle} summary
              </span>
              <h2 style={{ color: doc.textColor }} className="text-sm sm:text-base font-black leading-tight">
                {doc.filename}
              </h2>
            </div>

            {/* CONDITIONAL FORMAT 1: FLASHCARDS (3D interactive flip widgets!) */}
            {summaryStyle === "Flashcards" && (
              <div className="flex flex-col gap-4 w-full">
                <span className="text-xs font-bold text-text-muted px-1">
                  Tap card to reveal answer
                </span>
                
                <div className="flex flex-col gap-4">
                  {MOCK_FLASHCARDS.map((card) => {
                    const isFlipped = !!flippedCards[card.id];
                    return (
                      <div
                        key={card.id}
                        onClick={() => handleCardFlip(card.id)}
                        className="relative w-full h-32 cursor-pointer select-none group"
                        style={{ perspective: "1000px" }}
                      >
                        {/* 3D Rotator Container */}
                        <div
                          className="w-full h-full rounded-2xl relative shadow-md border transition-transform duration-500 transform-style-3d"
                          style={{
                            transform: isFlipped ? "rotateY(180deg)" : "none",
                            transformStyle: "preserve-3d",
                            borderColor: isFlipped ? "rgba(239,104,104,0.3)" : "rgba(255,255,255,0.05)",
                          }}
                        >
                          {/* FRONT OF FLASHCARD */}
                          <div
                            className="absolute inset-0 w-full h-full bg-card-bg rounded-2xl p-5 flex items-center justify-between backface-hidden"
                            style={{ backfaceVisibility: "hidden" }}
                          >
                            <div className="flex flex-col gap-1.5 pr-4">
                              <span className="text-[8px] font-black uppercase tracking-widest text-accent-coral/90">
                                Question {card.id}
                              </span>
                              <p className="text-sm font-extrabold text-white leading-snug">
                                {card.front}
                              </p>
                            </div>
                            <RefreshCw className="h-4.5 w-4.5 text-text-muted group-hover:text-white shrink-0 transition" />
                          </div>

                          {/* BACK OF FLASHCARD */}
                          <div
                            className="absolute inset-0 w-full h-full bg-accent-coral/5 rounded-2xl p-5 flex items-center justify-between backface-hidden"
                            style={{
                              backfaceVisibility: "hidden",
                              transform: "rotateY(180deg)",
                            }}
                          >
                            <div className="flex flex-col gap-1 pr-4">
                              <span className="text-[8px] font-black uppercase tracking-widest text-accent-coral">
                                Answer
                              </span>
                              <p className="text-xs sm:text-sm font-semibold text-white leading-normal">
                                {card.back}
                              </p>
                            </div>
                            <RefreshCw className="h-4.5 w-4.5 text-accent-coral shrink-0" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CONDITIONAL FORMAT 2: CHEAT SHEET (Condensed layout) */}
            {summaryStyle === "Cheat Sheet" && (
              <div className="flex flex-col gap-5 w-full">
                
                {/* Formulas box */}
                <div className="w-full bg-card-bg border border-border-subtle rounded-2xl p-4 shadow-sm">
                  <span className="text-[9px] font-black text-accent-coral uppercase tracking-wider leading-none">
                    Core Formulas & Complexities
                  </span>
                  <div className="flex flex-col gap-3 mt-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">Complexity order:</span>
                      <span className="font-mono text-accent-gold">O(1) &lt; O(log n) &lt; O(n) &lt; O(n²)</span>
                    </div>
                    <div className="h-[1px] w-full bg-border-subtle/50" />
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">BST search height:</span>
                      <span className="font-mono text-accent-gold">h = ceil(log₂(n + 1))</span>
                    </div>
                  </div>
                </div>

                {/* Glossary terms card */}
                <div className="w-full bg-card-bg border border-border-subtle rounded-2xl p-4 shadow-sm">
                  <span className="text-[9px] font-black text-accent-coral uppercase tracking-wider leading-none">
                    Key Definitions
                  </span>
                  <div className="flex flex-col gap-4 mt-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-extrabold text-white">LIFO (Last In, First Out)</span>
                      <span className="text-xs text-text-muted">The access principle of Stacks, where new elements insert and exit at the single top vertex.</span>
                    </div>
                    <div className="h-[1px] w-full bg-border-subtle/50" />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-extrabold text-white">FIFO (First In, First Out)</span>
                      <span className="text-xs text-text-muted">The queue processing standard, where insertions occur at the tail and removals occur at the head.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONDITIONAL FORMAT 3: MIND MAP (Visual Node Outlines) */}
            {summaryStyle === "Mind Map" && (
              <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-6 flex flex-col items-center shadow-md">
                <span className="text-[9px] font-black text-accent-coral uppercase tracking-widest mb-6">
                  Visual Branch Map Outline
                </span>

                {/* CENTRAL NODE */}
                <div className="px-4 py-3 rounded-2xl bg-brand-primary border border-brand-primary text-black font-extrabold text-xs text-center shadow-md select-none max-w-[200px]">
                  {docTitle.split(" ")[0]} Core Concepts
                </div>

                {/* Branch line */}
                <div className="w-[2px] bg-brand-primary/30 h-6" />

                {/* Sub branch horizontal split container */}
                <div className="w-full flex items-center justify-around">
                  <div className="w-[40%] h-[1px] bg-brand-primary/30" />
                  <div className="w-[40%] h-[1px] bg-brand-primary/30" />
                </div>

                {/* Two Column details branches */}
                <div className="grid grid-cols-2 gap-4 w-full mt-4">
                  
                  {/* Left Column: Linear Structures */}
                  <div className="flex flex-col items-center">
                    <div className="px-3 py-2 rounded-xl bg-card-bg border border-border-subtle text-white font-extrabold text-[10px] text-center select-none shadow">
                      Linear Structures
                    </div>
                    <div className="w-[1.5px] bg-border-subtle h-4" />
                    <div className="flex flex-col gap-1.5 w-full text-center">
                      <span className="text-[10px] text-text-muted px-2 py-1 bg-surface/30 rounded-lg">Array (O(1) Access)</span>
                      <span className="text-[10px] text-text-muted px-2 py-1 bg-surface/30 rounded-lg">Stack (LIFO logic)</span>
                      <span className="text-[10px] text-text-muted px-2 py-1 bg-surface/30 rounded-lg">Queue (FIFO logic)</span>
                    </div>
                  </div>

                  {/* Right Column: Non-Linear Structures */}
                  <div className="flex flex-col items-center">
                    <div className="px-3 py-2 rounded-xl bg-card-bg border border-border-subtle text-white font-extrabold text-[10px] text-center select-none shadow">
                      Non-Linear Nodes
                    </div>
                    <div className="w-[1.5px] bg-border-subtle h-4" />
                    <div className="flex flex-col gap-1.5 w-full text-center">
                      <span className="text-[10px] text-text-muted px-2 py-1 bg-surface/30 rounded-lg">Trees (Binary BST)</span>
                      <span className="text-[10px] text-text-muted px-2 py-1 bg-surface/30 rounded-lg">Graphs (Edges)</span>
                      <span className="text-[10px] text-text-muted px-2 py-1 bg-surface/30 rounded-lg">Heaps (Priority levels)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONDITIONAL FORMAT 4: BULLET POINTS (Default lists) */}
            {(summaryStyle === "Bullet Points" || summaryStyle === "Study Guide") && (
              <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 shadow-md shadow-black/15">
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent-coral" />
                  Key Takeaways
                </h3>

                <div className="flex flex-col gap-3.5 mt-1">
                  {MOCK_SUMMARY_BULLETS.map((bullet, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <span className="h-5 w-5 rounded-full bg-accent-coral/15 border border-accent-coral/20 flex items-center justify-center text-accent-coral shrink-0 mt-0.5">
                        <Check className="h-3 w-3" />
                      </span>
                      <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                        {bullet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CONDITIONAL FORMAT 5: KEY CONCEPTS (Accordions) */}
            {(summaryStyle === "Key Concepts" || summaryStyle === "Study Guide" || summaryStyle === "Bullet Points") && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight px-1">
                  Core Conceptual Breakdown
                </h3>

                <div className="flex flex-col gap-3">
                  {MOCK_CONCEPTS.map((concept) => {
                    const isOpen = expandedConcept === concept.id;
                    return (
                      <div
                        key={concept.id}
                        className={`w-full bg-card-bg border rounded-2xl overflow-hidden transition shadow-sm ${
                          isOpen ? "border-accent-coral/30 shadow-md" : "border-border-subtle hover:border-white/5"
                        }`}
                      >
                        {/* Header row */}
                        <button
                          onClick={() => toggleConcept(concept.id)}
                          className="w-full p-4 flex items-center justify-between font-bold text-left cursor-pointer focus:outline-none"
                        >
                          <span className="text-xs sm:text-sm font-extrabold text-white">
                            {concept.title}
                          </span>
                          {isOpen ? (
                            <ChevronUp className="h-4.5 w-4.5 text-accent-coral" />
                          ) : (
                            <ChevronDown className="h-4.5 w-4.5 text-text-muted" />
                          )}
                        </button>

                        {/* Expandable content panel */}
                        {isOpen && (
                          <div className="px-4 pb-4 border-t border-border-subtle/50 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                              {concept.desc}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Actions stack */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => alert("Summary download initiated!")}
                className="w-full py-4.5 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition cursor-pointer select-none shadow-lg shadow-brand-primary/10"
              >
                <Download className="h-4.5 w-4.5" />
                Download Summary
              </button>
              <button
                onClick={() => setStep("setup")}
                className="w-full bg-surface/80 hover:bg-input-bg border border-border-subtle rounded-2xl py-4.5 text-xs font-bold text-white transition cursor-pointer select-none"
              >
                Back to Documents
              </button>
            </div>
          </section>
        )}

    </div>
  );
}

export default function SummaryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-main text-white p-8">Loading Summary...</div>}>
      <SummaryContent />
    </Suspense>
  );
}
