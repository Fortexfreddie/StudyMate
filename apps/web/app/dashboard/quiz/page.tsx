"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { HelpCircle, Sparkles, CheckCircle2, XCircle, Clock } from "lucide-react";
import { ResultsTrophySvg } from "./components/ResultsTrophySvg";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { GeneratingState } from "@/components/dashboard/GeneratingState";
import { getMockDocument, getDocumentTitle } from "@/lib/mocks";

interface QuizQuestion {
  question: string;
  options: { key: string; text: string }[];
  correctKey: string;
}

const MOCK_QUESTIONS: QuizQuestion[] = [
  {
    question: "Which of the following is a non-linear data structure?",
    options: [
      { key: "A", text: "Array" },
      { key: "B", text: "Stack" },
      { key: "C", text: "Queue" },
      { key: "D", text: "Tree" },
    ],
    correctKey: "D",
  },
  {
    question: "What is the time complexity of searching in a Balanced Binary Search Tree?",
    options: [
      { key: "A", text: "O(1)" },
      { key: "B", text: "O(log n)" },
      { key: "C", text: "O(n)" },
      { key: "D", text: "O(n log n)" },
    ],
    correctKey: "B",
  },
  {
    question: "Which data structure uses LIFO (Last In, First Out) principle?",
    options: [
      { key: "A", text: "Queue" },
      { key: "B", text: "Stack" },
      { key: "C", text: "Linked List" },
      { key: "D", text: "Tree" },
    ],
    correctKey: "B",
  },
  {
    question: "What is the worst-case space complexity of a Queue implemented with a simple array?",
    options: [
      { key: "A", text: "O(1)" },
      { key: "B", text: "O(log n)" },
      { key: "C", text: "O(n)" },
      { key: "D", text: "O(n²)" },
    ],
    correctKey: "C",
  },
];

function QuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc") || "data-structures";
  const docTitle = getDocumentTitle(getMockDocument(docId));

  const [step, setStep] = useState<"setup" | "generating" | "quiz" | "results">("setup");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [generatingProgress, setGeneratingProgress] = useState(0);

  const totalQuestions = MOCK_QUESTIONS.length;

  // Active quiz playing states
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [answers, setAnswers] = useState<string[]>([]);

  // Simulation timer for Generating Step
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "generating") {
      setGeneratingProgress(0);
      interval = setInterval(() => {
        setGeneratingProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setStep("quiz"), 400);
            return 100;
          }
          return prev + 10;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [step]);

  const activeQuestion = MOCK_QUESTIONS[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  // Derived results computed from the recorded answers
  const correctCount = answers.reduce(
    (count, key, idx) => count + (key === MOCK_QUESTIONS[idx]?.correctKey ? 1 : 0),
    0
  );
  const incorrectCount = answers.length - correctCount;
  const scorePercentage = answers.length
    ? Math.round((correctCount / answers.length) * 100)
    : 0;

  const startQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedKey("");
    setAnswers([]);
    setStep("generating");
  };

  const handleConfirmAnswer = () => {
    if (!selectedKey) return;
    const nextAnswers = [...answers];
    nextAnswers[currentQuestionIndex] = selectedKey;
    setAnswers(nextAnswers);

    if (isLastQuestion) {
      setStep("results");
      return;
    }
    setCurrentQuestionIndex((prev) => prev + 1);
    setSelectedKey("");
  };

  const handleSubmitQuiz = () => {
    if (selectedKey) {
      const nextAnswers = [...answers];
      nextAnswers[currentQuestionIndex] = selectedKey;
      setAnswers(nextAnswers);
    }
    setStep("results");
  };

  const handleResetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedKey("");
    setAnswers([]);
    setStep("setup");
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-[560px] mx-auto w-full justify-start">

        <PageHeader
          title={`${docTitle} Quiz`}
          onBack={() => {
            if (step === "setup") router.push(`/dashboard/document/${docId}`);
            else if (step === "generating") setStep("setup");
            else if (step === "quiz") setStep("setup");
            else handleResetQuiz();
          }}
          className="mb-6"
        />

        {/* STAGE 0: SETUP SCREEN */}
        {step === "setup" && (
          <section className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 shadow-lg shadow-black/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold text-white">Interactive Assessment</span>
                  <span className="text-[10px] text-text-muted">Generate dynamic quiz cards</span>
                </div>
              </div>
              
              <div className="h-[1px] w-full bg-border-subtle" />

              {/* Select count question pills */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-text-muted">Select Number of Questions</span>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((count) => (
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
              </div>
            </div>

            {/* Solid Launch Primary button */}
            <button
              onClick={startQuiz}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold py-4.5 rounded-2xl transition cursor-pointer shadow-lg shadow-brand-primary/15"
            >
              <Sparkles className="h-4.5 w-4.5" />
              Generate Quiz
            </button>
          </section>
        )}

        {/* STAGE 1: GENERATING LOADING VIEW */}
        {step === "generating" && (
          <GeneratingState
            title="Generating Quiz..."
            subtitle="AI is reading the document contents"
            progress={generatingProgress}
            progressLabel={`${generatingProgress}% Completed`}
          />
        )}

        {/* STAGE 2: ACTIVE INTERACTIVE QUIZ CARD */}
        {step === "quiz" && (
          <section className="flex flex-col gap-5 w-full animate-in fade-in duration-300">
            {/* Question progress header */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-brand-primary">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </span>
                <span className="text-xs font-bold text-brand-primary">
                  {Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100)}%
                </span>
              </div>

              {/* Progress bar container */}
              <div className="w-full bg-surface-raised h-1.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                  className="h-full bg-brand-primary transition-all duration-300"
                />
              </div>
            </div>

            {/* Main Question details card */}
            <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 shadow-lg shadow-black/20">
              <h3 className="text-sm sm:text-base font-extrabold leading-snug text-white">
                {activeQuestion.question}
              </h3>

              {/* Option cards stack */}
              <div className="flex flex-col gap-3 mt-1.5">
                {activeQuestion.options.map((opt) => {
                  const isSelected = selectedKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedKey(opt.key)}
                      className={`w-full text-left rounded-2xl p-4 flex items-center gap-3 transition border cursor-pointer group focus:outline-none ${
                        isSelected
                          ? "bg-brand-primary/5 border-brand-primary shadow-inner shadow-black/10"
                          : "bg-surface/40 border-border-subtle hover:border-white/10"
                      }`}
                    >
                      {/* Option letter badge circle */}
                      <div
                        className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-xs transition duration-200 ${
                          isSelected
                            ? "bg-brand-primary text-accent-gold-fg"
                            : "bg-card-bg border border-border-subtle text-white group-hover:bg-white/5"
                        }`}
                      >
                        {opt.key}
                      </div>
                      <span className={`text-xs sm:text-sm font-semibold transition ${
                        isSelected ? "text-white" : "text-text-muted hover:text-white"
                      }`}>
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Confirm Answer Button */}
            <button
              onClick={handleConfirmAnswer}
              disabled={!selectedKey}
              className={`w-full py-4.5 rounded-2xl font-bold text-sm text-center transition cursor-pointer select-none ${
                selectedKey
                  ? "bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg shadow-lg shadow-brand-primary/10"
                  : "bg-card-bg border border-border-subtle text-text-muted cursor-not-allowed opacity-50"
              }`}
            >
              {isLastQuestion ? "Finish & See Results" : "Confirm Answer"}
            </button>

            {/* Submit early (skips remaining questions) */}
            {!isLastQuestion && (
              <button
                onClick={handleSubmitQuiz}
                type="button"
                className="w-full bg-surface/80 hover:bg-input-bg border border-border-subtle rounded-2xl py-4.5 text-xs font-bold text-white transition cursor-pointer select-none"
              >
                Submit Quiz
              </button>
            )}
          </section>
        )}

        {/* STAGE 3: AFTER-SUBMISSION RESULTS SCORECARD */}
        {step === "results" && (
          <section className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
            
            {/* Confetti & Trophy card */}
            <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col items-center justify-center shadow-lg shadow-black/25">
              
              {/* Radial percentage animated wrapper */}
              <ResultsTrophySvg
                scorePercentage={scorePercentage}
                correct={correctCount}
                total={answers.length}
              />

              <div className="flex flex-col items-center justify-center mt-6 text-center">
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

            {/* Statistics tables block row */}
            <div className="w-full bg-card-bg border border-border-subtle rounded-3xl p-4 flex flex-row items-center justify-around shadow-md shadow-black/15">
              {/* Stat 1: Correct */}
              <div className="flex flex-col items-center text-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 mb-1" />
                <span className="text-sm font-extrabold text-white">{correctCount}</span>
                <span className="text-[10px] text-emerald-400 font-bold mt-0.5">Correct</span>
              </div>

              <div className="h-10 w-[1px] bg-border-subtle" />

              {/* Stat 2: Incorrect */}
              <div className="flex flex-col items-center text-center">
                <XCircle className="h-5 w-5 text-accent-coral mb-1" />
                <span className="text-sm font-extrabold text-white">{incorrectCount}</span>
                <span className="text-[10px] text-accent-coral font-bold mt-0.5">Incorrect</span>
              </div>

              <div className="h-10 w-[1px] bg-border-subtle" />

              {/* Stat 3: Total answered */}
              <div className="flex flex-col items-center text-center">
                <Clock className="h-5 w-5 text-accent-gold mb-1" />
                <span className="text-sm font-extrabold text-white">{answers.length}</span>
                <span className="text-[10px] text-accent-gold font-bold mt-0.5">Answered</span>
              </div>
            </div>

            {/* Action buttons stack */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleResetQuiz}
                className="w-full py-4.5 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold rounded-2xl text-sm transition cursor-pointer select-none shadow-lg shadow-brand-primary/10"
              >
                Retake Quiz
              </button>
              <button
                onClick={() => router.push(`/dashboard/document/${docId}`)}
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
