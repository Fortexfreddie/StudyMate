"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { SparklesIcon } from "@/components/shared/Icons";
import { ResultsTrophySvg } from "./components/ResultsTrophySvg";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { GeneratingState } from "@/components/dashboard/GeneratingState";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { api, ApiClientError } from "@/lib/api";
import { getActivePerfConfig } from "@/lib/performance";
import type { QuizQuestion, QuizResult, Source } from "@/lib/types";

// Presets stay within the backend MAX_QUIZ_QUESTIONS (30). The hint warns that
// larger quizzes take longer to generate.
const QUESTION_PRESETS = [5, 10, 15, 20, 30];
const LARGE_QUIZ_THRESHOLD = 20;
const OPTION_KEYS = ["A", "B", "C", "D"];

type Step = "setup" | "generating" | "quiz" | "results";

function QuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc") ?? undefined;
  const topicParam = searchParams.get("topic") ?? "";

  const [step, setStep] = useState<Step>("setup");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [topic, setTopic] = useState<string>(topicParam);
  const [topK, setTopK] = useState<number>(10);
  const [maxK, setMaxK] = useState<number>(20);
  const [perfMode, setPerfMode] = useState<string>("high");
  const [error, setError] = useState<string | null>(null);

  // Generated session
  const [sessionId, setSessionId] = useState<string>("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  // Active play state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // answers[i] = selected option index for question i (or undefined if skipped)
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);

  // Results from the server
  const [results, setResults] = useState<QuizResult[]>([]);
  const [score, setScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalQuestions = questions.length;
  const activeQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === totalQuestions - 1;

  useEffect(() => {
    const { mode, config } = getActivePerfConfig();
    setTopK(config.default);
    setMaxK(config.max);
    setPerfMode(mode);
  }, []);

  const startQuiz = async () => {
    setError(null);
    setStep("generating");
    try {
      const res = await api.quiz.generate({
        topic: topic.trim() || "Key concepts from this document",
        doc_id: docId,
        num_questions: questionCount,
        top_k: topK,
      });
      if (res.questions.length === 0) {
        setError("No questions could be generated from this document.");
        setStep("setup");
        return;
      }
      setSessionId(res.session_id);
      setQuestions(res.questions);
      setSources(res.sources);
      setAnswers(new Array(res.questions.length).fill(undefined));
      setCurrentIndex(0);
      setSelectedIndex(null);
      setStep("quiz");
    } catch (err) {
      const detail =
        err instanceof ApiClientError
          ? err.detail
          : "Failed to generate the quiz. Please try again.";
      setError(detail);
      setStep("setup");
    }
  };

  const recordAnswer = (): (number | undefined)[] => {
    const next = [...answers];
    if (selectedIndex !== null) next[currentIndex] = selectedIndex;
    setAnswers(next);
    return next;
  };

  const submitQuiz = async (finalAnswers: (number | undefined)[]) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = finalAnswers
        .map((selected, idx) =>
          selected === undefined
            ? null
            : { question_index: idx, selected_index: selected }
        )
        .filter((a): a is { question_index: number; selected_index: number } => a !== null);

      const res = await api.quiz.submit(sessionId, { answers: payload });
      setResults(res.results);
      setScore(res.score);
      setStep("results");
    } catch (err) {
      const detail =
        err instanceof ApiClientError
          ? err.detail
          : "Failed to submit the quiz. Please try again.";
      setError(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAnswer = () => {
    const next = recordAnswer();
    if (isLastQuestion) {
      submitQuiz(next);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setSelectedIndex(answers[currentIndex + 1] ?? null);
  };

  const handleSubmitEarly = () => {
    const next = recordAnswer();
    submitQuiz(next);
  };

  const handleResetQuiz = () => {
    setStep("setup");
    setQuestions([]);
    setSources([]);
    setResults([]);
    setAnswers([]);
    setScore(0);
    setCurrentIndex(0);
    setSelectedIndex(null);
    setSessionId("");
    setError(null);
  };

  // Derived results stats
  const answeredCount = results.length;
  const correctCount = results.filter((r) => r.is_correct).length;
  const incorrectCount = answeredCount - correctCount;
  const scorePercentage =
    totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-3xl mx-auto w-full justify-start">
      <PageHeader
        title="Generate Quiz"
        onBack={() => {
          if (step === "setup")
            router.push(docId ? `/dashboard/document/${docId}` : "/dashboard");
          else if (step === "results") handleResetQuiz();
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

          <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold text-white">Interactive Assessment</span>
                <span className="text-[10px] text-text-muted">Generated from your document</span>
              </div>
            </div>

            <div className="h-[1px] w-full bg-border-subtle" />

            {/* Topic (optional) */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-text-muted">
                Topic <span className="font-normal">(optional)</span>
              </span>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Binary search trees"
                className="w-full bg-surface border border-border-subtle rounded-2xl py-3.5 px-4 text-sm font-semibold text-white placeholder:text-text-muted/65 focus:outline-none focus:border-brand-primary/30 transition"
              />
            </div>

            {/* Context Depth (K) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-muted inline-flex items-center gap-1">
                  Context Window Depth (K)
                  <InfoTooltip label="What is Context Window Depth?">
                    How many excerpts (&ldquo;chunks&rdquo;) from your document the AI reads to write
                    questions. Higher = broader coverage but slower; the cap depends on your
                    performance level.
                  </InfoTooltip>
                </span>
                <span className="text-xs font-extrabold text-brand-primary">
                  {topK} / {maxK} Chunks
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={maxK}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-full h-1 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
              <span className="text-[10px] text-text-muted leading-tight">
                Adjust the number of document chunks analyzed. Your current performance tier (<span className="text-brand-primary font-bold uppercase">{perfMode}</span>) limits this to a maximum of <span className="text-white font-bold">{maxK}</span>.
              </span>
            </div>

            {/* Count */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-text-muted">Number of Questions</span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {QUESTION_PRESETS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`py-3.5 rounded-2xl font-bold text-xs transition border cursor-pointer ${
                      questionCount === count
                        ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                        : "bg-card-bg border-border-subtle text-text-muted hover:text-white"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              {questionCount >= LARGE_QUIZ_THRESHOLD && (
                <span className="text-[10px] text-accent-coral flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Larger quizzes take longer to generate.
                </span>
              )}
            </div>
          </div>

          <button
            onClick={startQuiz}
            className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold py-4.5 rounded-2xl transition cursor-pointer shadow-lg shadow-brand-primary/15"
          >
            <SparklesIcon className="h-4.5 w-4.5" />
            Generate Quiz
          </button>
        </section>
      )}

      {/* GENERATING (indeterminate — real RAG call) */}
      {step === "generating" && (
        <GeneratingState
          title="Generating Quiz…"
          subtitle="AI is reading the document and writing questions"
        />
      )}

      {/* QUIZ */}
      {step === "quiz" && activeQuestion && (
        <section className="flex flex-col gap-5 w-full animate-in fade-in duration-300">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-brand-primary">
                Question {currentIndex + 1} of {totalQuestions}
              </span>
              <span className="text-xs font-bold text-brand-primary">
                {Math.round(((currentIndex + 1) / totalQuestions) * 100)}%
              </span>
            </div>
            <div className="w-full bg-surface-raised h-1.5 rounded-full overflow-hidden">
              <div
                style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                className="h-full bg-brand-primary transition-all duration-300"
              />
            </div>
          </div>

          <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 shadow-lg shadow-black/20">
            <h3 className="text-sm sm:text-base font-extrabold leading-snug text-white">
              {activeQuestion.question}
            </h3>

            <div className="flex flex-col gap-3 mt-1.5">
              {activeQuestion.options.map((opt, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full text-left rounded-2xl p-4 flex items-center gap-3 transition-all duration-250 border cursor-pointer group focus:outline-none hover:bg-surface/20 active:scale-[0.99] ${
                      isSelected
                        ? "bg-brand-primary/5 border-brand-primary shadow-inner shadow-black/10"
                        : "bg-surface/40 border-border-subtle hover:border-white/10"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-xs transition duration-200 ${
                        isSelected
                          ? "bg-brand-primary text-accent-gold-fg scale-105 shadow"
                          : "bg-card-bg border border-border-subtle text-white group-hover:bg-white/5"
                      }`}
                    >
                      {OPTION_KEYS[idx]}
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-semibold transition ${
                        isSelected ? "text-white animate-in fade-in" : "text-text-muted group-hover:text-white"
                      }`}
                    >
                      {opt.replace(/^[A-D]\)\s*/, "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-error-text/10 border border-error-text/20 text-error-text text-xs font-semibold rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            onClick={handleConfirmAnswer}
            disabled={selectedIndex === null || isSubmitting}
            className={`w-full py-4.5 rounded-2xl font-bold text-sm text-center transition-all duration-300 cursor-pointer select-none ${
              selectedIndex !== null && !isSubmitting
                ? "bg-brand-primary hover:bg-brand-primary-hover hover:scale-[1.01] active:scale-[0.99] text-accent-gold-fg shadow-lg shadow-brand-primary/10"
                : "bg-card-bg border border-border-subtle text-text-muted cursor-not-allowed opacity-50"
            }`}
          >
            {isSubmitting
              ? "Scoring…"
              : isLastQuestion
              ? "Finish & See Results"
              : "Confirm Answer"}
          </button>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                const next = [...answers];
                if (selectedIndex !== null) {
                  next[currentIndex] = selectedIndex;
                }
                setAnswers(next);
                setCurrentIndex((prev) => prev - 1);
                setSelectedIndex(answers[currentIndex - 1] ?? null);
              }}
              disabled={currentIndex === 0 || isSubmitting}
              className="flex-1 py-3.5 bg-surface/50 hover:bg-surface border border-border-subtle rounded-2xl text-xs font-extrabold text-white transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed text-center select-none"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => {
                const next = [...answers];
                if (selectedIndex !== null) {
                  next[currentIndex] = selectedIndex;
                }
                setAnswers(next);
                setCurrentIndex((prev) => prev + 1);
                setSelectedIndex(answers[currentIndex + 1] ?? null);
              }}
              disabled={isLastQuestion || isSubmitting}
              className="flex-1 py-3.5 bg-surface/50 hover:bg-surface border border-border-subtle rounded-2xl text-xs font-extrabold text-white transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed text-center select-none"
            >
              Skip / Next →
            </button>
          </div>

          {!isLastQuestion && (
            <button
              onClick={handleSubmitEarly}
              type="button"
              disabled={isSubmitting}
              className="w-full bg-surface/80 hover:bg-input-bg border border-border-subtle rounded-2xl py-4.5 text-xs font-bold text-white transition-all duration-250 active:scale-[0.99] cursor-pointer select-none disabled:opacity-50"
            >
              Submit Quiz Now
            </button>
          )}
        </section>
      )}

      {/* RESULTS */}
      {step === "results" && (
        <section className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
          <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col items-center justify-center shadow-lg shadow-black/25 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <ResultsTrophySvg
              scorePercentage={scorePercentage}
              correct={correctCount}
              total={totalQuestions}
            />
            <div className="flex flex-col items-center justify-center mt-6 text-center animate-in fade-in duration-300 [animation-delay:200ms]">
              <div className="flex items-center gap-1">
                <span className="text-base font-normal text-white">You scored</span>
                <span className="text-base font-extrabold text-accent-gold">{scorePercentage}%</span>
              </div>
              <p className="text-[11px] text-text-muted leading-tight mt-1 max-w-[280px]">
                {scorePercentage >= 80
                  ? "You have a strong understanding of this topic."
                  : scorePercentage >= 50
                  ? "Good effort — review the missed questions to improve."
                  : "Keep practicing — revisit the material and try again."}
              </p>
            </div>
          </div>

          <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-4 flex flex-row items-center justify-around shadow-md shadow-black/15">
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mb-1" />
              <span className="text-sm font-extrabold text-white">{correctCount}</span>
              <span className="text-[10px] text-emerald-400 font-bold mt-0.5">Correct</span>
            </div>
            <div className="h-10 w-[1px] bg-border-subtle" />
            <div className="flex flex-col items-center text-center">
              <XCircle className="h-5 w-5 text-accent-coral mb-1" />
              <span className="text-sm font-extrabold text-white">{incorrectCount}</span>
              <span className="text-[10px] text-accent-coral font-bold mt-0.5">Incorrect</span>
            </div>
            <div className="h-10 w-[1px] bg-border-subtle" />
            <div className="flex flex-col items-center text-center">
              <Clock className="h-5 w-5 text-accent-gold mb-1" />
              <span className="text-sm font-extrabold text-white">{totalQuestions}</span>
              <span className="text-[10px] text-accent-gold font-bold mt-0.5">Total</span>
            </div>
          </div>

          {/* Per-question review with explanations */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs sm:text-sm font-extrabold text-white px-1">Review</h3>
            {questions.map((q, idx) => {
              const result = results.find((r) => r.question_index === idx);
              const correct = result?.is_correct ?? false;
              const selected = result?.selected_index;
              const correctIdx = result?.correct_index ?? q.correct_index;
              return (
                <div
                  key={idx}
                  className={`w-full bg-card-bg border rounded-2xl p-4 flex flex-col gap-2 ${
                    correct ? "border-emerald-400/25" : "border-accent-coral/25"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {correct ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-accent-coral shrink-0 mt-0.5" />
                    )}
                    <span className="text-xs font-extrabold text-white leading-snug">
                      {idx + 1}. {q.question}
                    </span>
                  </div>
                  <div className="pl-6 flex flex-col gap-1">
                    {selected === -1 && (
                      <span className="text-[11px] text-accent-coral">Skipped</span>
                    )}
                    {selected !== undefined && selected >= 0 && !correct && (
                      <span className="text-[11px] text-accent-coral">
                        Your answer: {OPTION_KEYS[selected]}. {q.options[selected]?.replace(/^[A-D]\)\s*/, "")}
                      </span>
                    )}
                    <span className="text-[11px] text-emerald-400">
                      Correct: {OPTION_KEYS[correctIdx]}. {q.options[correctIdx]?.replace(/^[A-D]\)\s*/, "")}
                    </span>
                    {(result?.explanation ?? q.explanation) && (
                      <span className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                        {result?.explanation ?? q.explanation}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Source citations the quiz was grounded in */}
          {sources.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-text-muted px-1">
                Grounded in {sources.length} source{sources.length > 1 ? "s" : ""}
              </h3>
              <div className="flex flex-col gap-2">
                {sources.map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-card-bg border border-border-subtle rounded-xl p-3 flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-white truncate">
                        {s.filename} • p.{s.page_number}
                      </span>
                      <span className="text-[9px] font-bold text-brand-primary shrink-0">
                        {Math.round(s.similarity_score * 100)}% match
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted leading-snug line-clamp-2">
                      {s.text_preview}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={handleResetQuiz}
              className="w-full py-4.5 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold rounded-2xl text-sm transition cursor-pointer select-none shadow-lg shadow-brand-primary/10"
            >
              New Quiz
            </button>
            <button
              onClick={() =>
                router.push(docId ? `/dashboard/document/${docId}` : "/dashboard")
              }
              className="w-full bg-surface/80 hover:bg-input-bg border border-border-subtle rounded-2xl py-4.5 text-xs font-bold text-white transition cursor-pointer select-none"
            >
              Back to Document
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-main text-white p-8">Loading Quiz...</div>}>
      <QuizContent />
    </Suspense>
  );
}
