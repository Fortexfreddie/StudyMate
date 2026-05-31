"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Sparkles,
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { GeneratingState } from "@/components/dashboard/GeneratingState";
import { api, ApiClientError } from "@/lib/api";
import { getDocumentColor, getDocumentTitle } from "@/lib/format";
import type {
  SummaryFormat,
  SummaryResponse,
  CheatSheet,
  Flashcard,
  ConceptItem,
  MindMap,
  StudyGuide,
} from "@/lib/types";

// UI label → backend format key.
const FORMAT_OPTIONS: { label: string; value: SummaryFormat }[] = [
  { label: "Bullet Points", value: "bullets" },
  { label: "Key Concepts", value: "key_concepts" },
  { label: "Study Guide", value: "study_guide" },
  { label: "Flashcards", value: "flashcards" },
  { label: "Cheat Sheet", value: "cheat_sheet" },
  { label: "Mind Map", value: "mind_map" },
];

function SummaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc") ?? undefined;

  const [docName, setDocName] = useState("Document");
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<SummaryFormat>("bullets");
  const [step, setStep] = useState<"setup" | "generating" | "completed">("setup");
  const [result, setResult] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Interactive output state
  const [expandedConcept, setExpandedConcept] = useState<number | null>(0);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  const { bgColor, textColor } = getDocumentColor(docId ?? "default");

  useEffect(() => {
    let active = true;
    if (docId) {
      api.documents
        .get(docId)
        .then((doc) => {
          if (active) setDocName(doc.filename);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [docId]);

  const generate = async () => {
    setError(null);
    setStep("generating");
    try {
      const res = await api.summary.generate({
        topic: topic.trim() || "Overview of this document",
        doc_id: docId,
        format,
      });
      setResult(res);
      setExpandedConcept(0);
      setFlippedCards({});
      setStep("completed");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.detail
          : "Failed to generate the summary. Please try again."
      );
      setStep("setup");
    }
  };

  const activeLabel =
    FORMAT_OPTIONS.find((f) => f.value === format)?.label ?? "Summary";

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-3xl mx-auto w-full justify-start">
      <PageHeader
        title="Summarize Document"
        onBack={() => {
          if (step === "setup")
            router.push(docId ? `/dashboard/document/${docId}` : "/dashboard");
          else setStep("setup");
        }}
        className="mb-6"
      />

      {/* SETUP */}
      {step === "setup" && (
        <section className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          {error && (
            <div className="bg-error-text/10 border border-error-text/20 text-error-text text-xs font-semibold rounded-xl p-3">
              {error}
            </div>
          )}

          <div
            style={{ backgroundColor: bgColor }}
            className="w-full rounded-3xl p-5 flex flex-row items-center justify-between shadow-lg shadow-black/25"
          >
            <div className="flex flex-col gap-2 flex-1 pr-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 text-[10px] font-bold w-fit" style={{ color: textColor }}>
                <FileText className="h-3 w-3" />
                PDF Summary Source
              </span>
              <h2 style={{ color: textColor }} className="text-sm sm:text-base font-extrabold line-clamp-1">
                {docName}
              </h2>
            </div>
          </div>

          <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-5 shadow-md shadow-black/15">
            {/* Topic */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-text-muted">
                Topic <span className="font-normal">(optional)</span>
              </span>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data structures overview"
                className="w-full bg-surface border border-border-subtle rounded-2xl py-3.5 px-4 text-sm font-semibold text-white placeholder:text-text-muted/65 focus:outline-none focus:border-accent-coral/30 transition"
              />
            </div>

            {/* Format */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-text-muted">Summary Format</span>
              <div className="grid grid-cols-3 gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={`py-3.5 rounded-2xl font-bold text-[10px] sm:text-xs transition border cursor-pointer leading-tight ${
                      format === opt.value
                        ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                        : "bg-surface/40 border-border-subtle text-text-muted hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={generate}
            className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold py-4.5 rounded-2xl transition cursor-pointer shadow-lg shadow-brand-primary/15"
          >
            <Sparkles className="h-4.5 w-4.5" />
            Generate Summary
          </button>
        </section>
      )}

      {/* GENERATING */}
      {step === "generating" && (
        <GeneratingState
          title={`Structuring ${activeLabel}…`}
          subtitle="Synthesizing core concepts from your document"
          accentClass="text-accent-coral"
          accentColor="var(--color-accent-coral)"
        />
      )}

      {/* COMPLETED */}
      {step === "completed" && result && (
        <section className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
          <div
            style={{ backgroundColor: bgColor }}
            className="w-full rounded-3xl p-5 flex flex-col gap-2 shadow-lg shadow-black/25"
          >
            <span className="text-[9px] font-black uppercase tracking-widest leading-none opacity-80" style={{ color: textColor }}>
              {activeLabel} summary
            </span>
            <h2 style={{ color: textColor }} className="text-sm sm:text-base font-black leading-tight">
              {getDocumentTitle({ filename: docName })}
            </h2>
          </div>

          {/* Context-insufficient */}
          {!result.context_sufficient && (
            <div className="w-full bg-accent-coral/10 border border-accent-coral/20 rounded-2xl p-4 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-accent-coral shrink-0 mt-0.5" />
              <p className="text-xs text-white leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Structured rendering by format (falls back to plain text) */}
          {result.context_sufficient && (
            <StructuredSummary
              result={result}
              expandedConcept={expandedConcept}
              setExpandedConcept={setExpandedConcept}
              flippedCards={flippedCards}
              setFlippedCards={setFlippedCards}
            />
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep("setup")}
              className="w-full bg-surface/80 hover:bg-input-bg border border-border-subtle rounded-2xl py-4.5 text-xs font-bold text-white transition cursor-pointer select-none"
            >
              Generate Another
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Structured renderers ──────────────────────────────────────────────────────

interface StructuredProps {
  result: SummaryResponse;
  expandedConcept: number | null;
  setExpandedConcept: (v: number | null) => void;
  flippedCards: Record<number, boolean>;
  setFlippedCards: (v: Record<number, boolean>) => void;
}

function StructuredSummary({
  result,
  expandedConcept,
  setExpandedConcept,
  flippedCards,
  setFlippedCards,
}: StructuredProps) {
  const { format, structured, summary } = result;

  // If the model couldn't produce a structured payload, show the plain text.
  if (structured === null) {
    return (
      <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 shadow-md">
        <p className="text-xs sm:text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
          {summary}
        </p>
      </div>
    );
  }

  if (format === "bullets") {
    return <Bullets items={structured as string[]} />;
  }
  if (format === "key_concepts") {
    return (
      <Concepts
        items={structured as ConceptItem[]}
        expanded={expandedConcept}
        setExpanded={setExpandedConcept}
      />
    );
  }
  if (format === "study_guide") {
    const sg = structured as StudyGuide;
    return (
      <>
        <Bullets items={sg.bullets} />
        <Concepts items={sg.concepts} expanded={expandedConcept} setExpanded={setExpandedConcept} />
      </>
    );
  }
  if (format === "flashcards") {
    return (
      <Flashcards
        cards={structured as Flashcard[]}
        flipped={flippedCards}
        setFlipped={setFlippedCards}
      />
    );
  }
  if (format === "cheat_sheet") {
    return <CheatSheetView data={structured as CheatSheet} />;
  }
  if (format === "mind_map") {
    return <MindMapView data={structured as MindMap} />;
  }
  return null;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 shadow-md shadow-black/15">
      <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-accent-coral" />
        Key Takeaways
      </h3>
      <div className="flex flex-col gap-3.5 mt-1">
        {items.map((bullet, idx) => (
          <div key={idx} className="flex gap-3 items-start">
            <span className="h-5 w-5 rounded-full bg-accent-coral/15 border border-accent-coral/20 flex items-center justify-center text-accent-coral shrink-0 mt-0.5">
              <Check className="h-3 w-3" />
            </span>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{bullet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Concepts({
  items,
  expanded,
  setExpanded,
}: {
  items: ConceptItem[];
  expanded: number | null;
  setExpanded: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight px-1">
        Core Conceptual Breakdown
      </h3>
      <div className="flex flex-col gap-3">
        {items.map((concept, idx) => {
          const isOpen = expanded === idx;
          return (
            <div
              key={idx}
              className={`w-full bg-card-bg border rounded-2xl overflow-hidden transition shadow-sm ${
                isOpen ? "border-accent-coral/30 shadow-md" : "border-border-subtle hover:border-white/5"
              }`}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : idx)}
                className="w-full p-4 flex items-center justify-between font-bold text-left cursor-pointer focus:outline-none"
              >
                <span className="text-xs sm:text-sm font-extrabold text-white">{concept.title}</span>
                {isOpen ? (
                  <ChevronUp className="h-4.5 w-4.5 text-accent-coral" />
                ) : (
                  <ChevronDown className="h-4.5 w-4.5 text-text-muted" />
                )}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border-subtle/50 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                    {concept.description}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Flashcards({
  cards,
  flipped,
  setFlipped,
}: {
  cards: Flashcard[];
  flipped: Record<number, boolean>;
  setFlipped: (v: Record<number, boolean>) => void;
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <span className="text-xs font-bold text-text-muted px-1">Tap card to reveal answer</span>
      <div className="flex flex-col gap-4">
        {cards.map((card, idx) => {
          const isFlipped = !!flipped[idx];
          return (
            <div
              key={idx}
              onClick={() => setFlipped({ ...flipped, [idx]: !isFlipped })}
              className="relative w-full h-32 cursor-pointer select-none group"
              style={{ perspective: "1000px" }}
            >
              <div
                className="w-full h-full rounded-2xl relative shadow-md border transition-transform duration-500"
                style={{
                  transform: isFlipped ? "rotateY(180deg)" : "none",
                  transformStyle: "preserve-3d",
                  borderColor: isFlipped ? "rgba(239,104,104,0.3)" : "rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="absolute inset-0 w-full h-full bg-card-bg rounded-2xl p-5 flex items-center justify-between"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="flex flex-col gap-1.5 pr-4">
                    <span className="text-[8px] font-black uppercase tracking-widest text-accent-coral/90">
                      Question {idx + 1}
                    </span>
                    <p className="text-sm font-extrabold text-white leading-snug">{card.front}</p>
                  </div>
                  <RefreshCw className="h-4.5 w-4.5 text-text-muted group-hover:text-white shrink-0 transition" />
                </div>
                <div
                  className="absolute inset-0 w-full h-full bg-accent-coral/5 rounded-2xl p-5 flex items-center justify-between"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
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
  );
}

function CheatSheetView({ data }: { data: CheatSheet }) {
  return (
    <div className="flex flex-col gap-5 w-full">
      {data.formulas.length > 0 && (
        <div className="w-full bg-card-bg border border-border-subtle rounded-2xl p-4 shadow-sm">
          <span className="text-[9px] font-black text-accent-coral uppercase tracking-wider">
            Core Formulas &amp; Facts
          </span>
          <div className="flex flex-col gap-3 mt-3">
            {data.formulas.map((f, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center gap-3 text-xs">
                  <span className="font-bold text-white">{f.label}</span>
                  <span className="font-mono text-accent-gold text-right">{f.value}</span>
                </div>
                {idx < data.formulas.length - 1 && (
                  <div className="h-[1px] w-full bg-border-subtle/50 mt-3" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.definitions.length > 0 && (
        <div className="w-full bg-card-bg border border-border-subtle rounded-2xl p-4 shadow-sm">
          <span className="text-[9px] font-black text-accent-coral uppercase tracking-wider">
            Key Definitions
          </span>
          <div className="flex flex-col gap-4 mt-3">
            {data.definitions.map((d, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <span className="text-xs font-extrabold text-white">{d.term}</span>
                <span className="text-xs text-text-muted">{d.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MindMapView({ data }: { data: MindMap }) {
  return (
    <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-6 flex flex-col items-center shadow-md">
      <span className="text-[9px] font-black text-accent-coral uppercase tracking-widest mb-6">
        Visual Branch Map
      </span>
      <div className="px-4 py-3 rounded-2xl bg-brand-primary border border-brand-primary text-black font-extrabold text-xs text-center shadow-md select-none max-w-[220px]">
        {data.root}
      </div>
      <div className="w-[2px] bg-brand-primary/30 h-6" />
      <div className="grid grid-cols-2 gap-4 w-full mt-1">
        {data.branches.map((branch, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className="px-3 py-2 rounded-xl bg-card-bg border border-border-subtle text-white font-extrabold text-[10px] text-center select-none shadow">
              {branch.label}
            </div>
            <div className="w-[1.5px] bg-border-subtle h-4" />
            <div className="flex flex-col gap-1.5 w-full text-center">
              {branch.children.map((child, cIdx) => (
                <span key={cIdx} className="text-[10px] text-text-muted px-2 py-1 bg-surface/30 rounded-lg">
                  {child}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
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
