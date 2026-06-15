"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { SparklesIcon, SleekLightningIcon } from "@/components/shared/Icons";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { GeneratingState } from "@/components/dashboard/GeneratingState";
import {
  CollapsibleSources,
  InlineMarkdown,
  RichMarkdown,
} from "@/components/shared/SourceReferences";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { api, ApiClientError } from "@/lib/api";
import { getActivePerfConfig } from "@/lib/performance";
import { useSourceCite } from "@/lib/useSourceCite";
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
  { label: "Tabular", value: "tabular" },
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
  // When present, restore a previously saved summary instead of starting fresh.
  const summaryId = searchParams.get("summary") ?? undefined;

  const [docName, setDocName] = useState("Document");
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<SummaryFormat>("tabular");
  const [topK, setTopK] = useState<number>(10);
  const [maxK, setMaxK] = useState<number>(20);
  const [perfMode, setPerfMode] = useState<string>("high");
  const [step, setStep] = useState<"setup" | "generating" | "completed">("setup");
  const [result, setResult] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullDoc, setFullDoc] = useState(false);
  // True while fetching a saved summary via ?summary=<id> on first load.
  const [restoring, setRestoring] = useState<boolean>(!!summaryId);

  // Interactive output state
  const [expandedConcept, setExpandedConcept] = useState<number | null>(0);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  // Clickable "Source #N" citations scroll to / highlight the matching card.
  const { registerRef, cite, active } = useSourceCite<number>();

  const { bgColor, textColor } = getDocumentColor(docId ?? "default");

  useEffect(() => {
    const { mode, config } = getActivePerfConfig();
    setTopK(config.default);
    setMaxK(config.max);
    setPerfMode(mode);
  }, []);

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

  // Restore a saved summary when arriving from History (?summary=<id>). Maps the
  // detail payload into the same shape the completed view renders, so a previously
  // generated summary opens directly instead of dropping the user on the form.
  useEffect(() => {
    if (!summaryId) return;
    let active = true;
    setRestoring(true);
    setError(null);
    api.history
      .summaryDetail(summaryId)
      .then((detail) => {
        if (!active) return;
        setFormat(detail.format);
        setTopic(detail.topic);
        setResult({
          summary: detail.summary,
          format: detail.format,
          structured: detail.structured,
          context_sufficient: detail.context_sufficient,
          sources: detail.sources,
        });
        setExpandedConcept(0);
        setFlippedCards({});
        setStep("completed");
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiClientError
            ? err.detail
            : "Couldn't load that summary. It may have been deleted."
        );
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [summaryId]);

  const generate = async () => {
    setError(null);
    setStep("generating");
    try {
      const res = await api.summary.generate({
        topic: fullDoc ? "Full Document Overview" : (topic.trim() || "Overview of this document"),
        doc_id: docId,
        format,
        top_k: topK,
        full_document: fullDoc,
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
          // A restored-from-history summary has no setup form to return to — go back
          // to History instead of dropping the user on an empty generate form.
          if (summaryId && step === "completed") {
            router.push("/dashboard/history");
          } else if (step === "setup") {
            router.push(docId ? `/dashboard/document/${docId}` : "/dashboard");
          } else {
            setStep("setup");
          }
        }}
        className="mb-6"
      />

      {/* RESTORING a saved summary from history */}
      {restoring && step !== "completed" && (
        <GeneratingState
          title="Loading summary…"
          subtitle="Fetching your saved summary"
          accentClass="text-accent-coral"
          accentColor="var(--color-accent-coral)"
        />
      )}

      {error && restoring === false && step === "setup" && summaryId && (
        <div className="bg-error-text/10 border border-error-text/20 text-error-text text-xs font-semibold rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {/* SETUP */}
      {step === "setup" && !restoring && (
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
            {/* Full Document Summary Toggle */}
            {docId && (
              <div className="flex items-center justify-between bg-surface/30 border border-border-subtle/50 rounded-2xl p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-white inline-flex items-center gap-1.5">
                    Full Document Summary
                    <InfoTooltip label="What is Full Document Summary?">
                      Analyze the entire document sequentially instead of searching for a specific topic. Highly recommended for a complete overview.
                    </InfoTooltip>
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Bypasses similarity search to summarize the whole PDF.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFullDoc(!fullDoc)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    fullDoc ? "bg-brand-primary" : "bg-surface-raised"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      fullDoc ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Topic */}
            <div className={`flex flex-col gap-2 transition-opacity duration-200 ${fullDoc ? "opacity-50 pointer-events-none" : ""}`}>
              <span className="text-xs font-bold text-text-muted">
                Topic <span className="font-normal">(optional)</span>
              </span>
              <input
                type="text"
                value={fullDoc ? "Full Document Overview" : topic}
                disabled={fullDoc}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data structures overview"
                className="w-full bg-surface border border-border-subtle rounded-2xl py-3.5 px-4 text-sm font-semibold text-white placeholder:text-text-muted/65 focus:outline-none focus:border-accent-coral/30 transition"
              />
            </div>

            {/* Context Depth (K) */}
            <div className={`flex flex-col gap-2 transition-opacity duration-200 ${fullDoc ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-muted inline-flex items-center gap-1">
                  Context Window Depth (K)
                  <InfoTooltip label="What is Context Window Depth?">
                    How many excerpts (&ldquo;chunks&rdquo;) from your document the AI reads to build
                    the summary. Higher = more detail but slower; the cap depends on your performance
                    level.
                  </InfoTooltip>
                </span>
                <span className="text-xs font-extrabold text-brand-primary">
                  {fullDoc ? "All Chunks" : `${topK} / ${maxK} Chunks`}
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={maxK}
                value={topK}
                disabled={fullDoc}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-full h-1 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
              <span className="text-[10px] text-text-muted leading-tight">
                Adjust the number of document chunks analyzed. Your current performance tier (<span className="text-brand-primary font-bold uppercase">{perfMode}</span>) limits this to a maximum of <span className="text-white font-bold">{maxK}</span>.
              </span>
            </div>

            {/* Format */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-text-muted">Summary Format</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
            <SparklesIcon className="h-4.5 w-4.5" />
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
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest leading-none opacity-80" style={{ color: textColor }}>
                {activeLabel} summary
              </span>
              {result.meta?.cached && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-black/15" style={{ color: textColor }}>
                  <SleekLightningIcon className="h-3 w-3" /> INSTANT
                </span>
              )}
            </div>
            <h2 style={{ color: textColor }} className="text-sm sm:text-base font-black leading-tight">
              {getDocumentTitle({ filename: docName })}
            </h2>
          </div>

          {/* Context-insufficient */}
          {!result.context_sufficient && (
            <div className="w-full bg-accent-coral/10 border border-accent-coral/20 rounded-2xl p-4 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-accent-coral shrink-0 mt-0.5" />
              <div className="markdown-body text-xs text-white leading-relaxed flex flex-col gap-1.5">
                <InlineMarkdown
                  text={result.summary}
                  sourceCount={result.sources.length}
                  onCite={cite}
                />
              </div>
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
              link={(text) => (
                <InlineMarkdown
                  text={text}
                  sourceCount={result.sources.length}
                  onCite={cite}
                />
              )}
              rich={(text) => (
                <RichMarkdown
                  text={text}
                  sourceCount={result.sources.length}
                  onCite={cite}
                />
              )}
            />
          )}

          {/* Sources the summary was grounded in */}
          {result.sources.length > 0 && (
            <CollapsibleSources
              sources={result.sources}
              activeIdx={active}
              registerRef={registerRef}
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

type LinkFn = (text: string) => React.ReactNode;

interface StructuredProps {
  result: SummaryResponse;
  expandedConcept: number | null;
  setExpandedConcept: (v: number | null) => void;
  flippedCards: Record<number, boolean>;
  setFlippedCards: (v: Record<number, boolean>) => void;
  link: LinkFn;
  rich: LinkFn;
}

function StructuredSummary({
  result,
  expandedConcept,
  setExpandedConcept,
  flippedCards,
  setFlippedCards,
  link,
  rich,
}: StructuredProps) {
  const { format, structured, summary } = result;

  // Tabular is rich free-form markdown (tables/headings) — render it fully, and
  // use the same path as a fallback whenever a structured payload is missing.
  if (format === "tabular" || structured === null) {
    return (
      <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-4 sm:p-5 shadow-md overflow-hidden">
        <div className="text-xs sm:text-sm text-text-muted">{rich(summary)}</div>
      </div>
    );
  }

  if (format === "bullets") {
    return <Bullets items={structured as string[]} link={link} />;
  }
  if (format === "key_concepts") {
    return (
      <Concepts
        items={structured as ConceptItem[]}
        expanded={expandedConcept}
        setExpanded={setExpandedConcept}
        link={link}
      />
    );
  }
  if (format === "study_guide") {
    const sg = structured as StudyGuide;
    return (
      <>
        <Bullets items={sg.bullets} link={link} />
        <Concepts items={sg.concepts} expanded={expandedConcept} setExpanded={setExpandedConcept} link={link} />
      </>
    );
  }
  if (format === "flashcards") {
    return (
      <Flashcards
        cards={structured as Flashcard[]}
        flipped={flippedCards}
        setFlipped={setFlippedCards}
        link={link}
      />
    );
  }
  if (format === "cheat_sheet") {
    return <CheatSheetView data={structured as CheatSheet} link={link} />;
  }
  if (format === "mind_map") {
    return <MindMapView data={structured as MindMap} link={link} />;
  }
  return null;
}

function Bullets({ items, link }: { items: string[]; link: LinkFn }) {
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
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{link(bullet)}</p>
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
  link,
}: {
  items: ConceptItem[];
  expanded: number | null;
  setExpanded: (v: number | null) => void;
  link: LinkFn;
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
              className={`w-full bg-card-bg border rounded-2xl overflow-hidden transition-all duration-300 shadow-sm ${
                isOpen ? "border-accent-coral/30 shadow-md" : "border-border-subtle hover:border-white/5"
              }`}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : idx)}
                className="w-full p-4 flex items-center justify-between font-bold text-left cursor-pointer focus:outline-none transition duration-200 hover:bg-white/5"
              >
                <span className="text-xs sm:text-sm font-extrabold text-white">{concept.title}</span>
                <ChevronDown
                  className={`h-4.5 w-4.5 transition-transform duration-350 ease-out ${
                    isOpen ? "text-accent-coral rotate-180" : "text-text-muted"
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border-subtle/50 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                    {link(concept.description)}
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
  link,
}: {
  cards: Flashcard[];
  flipped: Record<number, boolean>;
  setFlipped: (v: Record<number, boolean>) => void;
  link: LinkFn;
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
              className="relative w-full h-40 sm:h-32 cursor-pointer select-none group perspective-1000"
            >
              <div
                className={`w-full h-full rounded-2xl relative border transform-style-3d transition-all duration-500 ease-out hover:scale-[1.01] active:scale-[0.99] ${
                  isFlipped
                    ? "border-accent-coral/30 shadow-[0_12px_24px_rgba(243,124,115,0.12)]"
                    : "border-white/5 shadow-md shadow-black/15 hover:border-white/10 hover:shadow-lg"
                }`}
                style={{
                  transform: isFlipped ? "rotateY(180deg)" : "none",
                }}
              >
                {/* Front card side */}
                <div
                  className="absolute inset-0 w-full h-full bg-card-bg rounded-2xl p-5 flex items-center justify-between backface-hidden"
                >
                  <div className="flex flex-col gap-1.5 pr-4">
                    <span className="text-[8px] font-black uppercase tracking-widest text-accent-coral/90 animate-pulse">
                      Question {idx + 1}
                    </span>
                    <p className="text-sm font-extrabold text-white leading-snug">{card.front}</p>
                  </div>
                  <RefreshCw className="h-4.5 w-4.5 text-text-muted group-hover:text-white group-hover:rotate-180 shrink-0 transition-transform duration-500" />
                </div>
                
                {/* Back card side */}
                <div
                  className="absolute inset-0 w-full h-full bg-accent-coral/5 rounded-2xl p-5 flex items-center justify-between backface-hidden rotate-y-180"
                >
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="text-[8px] font-black uppercase tracking-widest text-accent-coral">
                      Answer
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-white leading-normal">
                      {link(card.back)}
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

function CheatSheetView({ data, link }: { data: CheatSheet; link: LinkFn }) {
  return (
    <div className="flex flex-col gap-5 w-full">
      {data.formulas.length > 0 && (
        <div className="w-full bg-card-bg border border-border-subtle rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="text-[9px] font-black text-accent-coral uppercase tracking-wider">
            Core Formulas &amp; Facts
          </span>
          <div className="flex flex-col gap-3 mt-3">
            {data.formulas.map((f, idx) => (
              <div key={idx}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-3 text-xs">
                  <span className="font-bold text-white">{f.label}</span>
                  <span className="font-mono text-accent-gold text-left sm:text-right">{link(f.value)}</span>
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
        <div className="w-full bg-card-bg border border-border-subtle rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-delay:100ms]">
          <span className="text-[9px] font-black text-accent-coral uppercase tracking-wider">
            Key Definitions
          </span>
          <div className="flex flex-col gap-4 mt-3">
            {data.definitions.map((d, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <span className="text-xs font-extrabold text-white">{d.term}</span>
                <span className="text-xs text-text-muted">{link(d.meaning)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MindMapView({ data, link }: { data: MindMap; link: LinkFn }) {
  return (
    <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-6 flex flex-col items-center shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500">
      <span className="text-[9px] font-black text-accent-coral uppercase tracking-widest mb-6">
        Visual Branch Map
      </span>
      <div className="px-4 py-3 rounded-2xl bg-brand-primary border border-brand-primary text-black font-extrabold text-xs text-center shadow-md select-none max-w-[220px] transition-transform duration-300 hover:scale-105 cursor-default">
        {data.root}
      </div>
      <div className="w-[2px] bg-brand-primary/30 h-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-1">
        {data.branches.map((branch, idx) => (
          <div key={idx} className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${(idx + 1) * 75}ms` }}>
            <div className="px-3 py-2 rounded-xl bg-card-bg border border-border-subtle text-white font-extrabold text-[10px] text-center select-none shadow transition duration-200 hover:border-brand-primary/30 hover:scale-103 cursor-default">
              {branch.label}
            </div>
            <div className="w-[1.5px] bg-border-subtle h-4" />
            <div className="flex flex-col gap-1.5 w-full text-center">
              {branch.children.map((child, cIdx) => (
                <span key={cIdx} className="text-[10px] text-text-muted px-2 py-1 bg-surface/30 rounded-lg transition duration-200 hover:text-white hover:bg-surface/50 cursor-default">
                  {link(child)}
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
