"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Home, Upload, History, User, Trophy, ArrowRight, type LucideProps } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { OnboardingIllustration } from "@/app/components/OnboardingIllustration";
import { SleekLightningIcon, AIAssistantIcon } from "@/components/shared/Icons";

const ONBOARDED_KEY = "studymate_onboarded";

export function hasOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDED_KEY) === "1";
}

export function markOnboarded(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDED_KEY, "1");
}

export function resetOnboarding(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ONBOARDED_KEY);
}

interface Step {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    icon: null, // first step shows the full illustration instead of a badge
    title: "Welcome to StudyMate",
    body: (
      <>
        Turn any PDF into an active study session. Upload a document, then{" "}
        <span className="text-white font-bold">summarize</span> it,{" "}
        <span className="text-white font-bold">quiz</span> yourself, or{" "}
        <span className="text-white font-bold">chat</span> with it — every answer
        grounded in your own material.
      </>
    ),
  },
  {
    icon: <SleekLightningIcon className="h-5 w-5" />,
    title: "Tune speed vs. depth",
    body: (
      <>
        <span className="text-white font-bold">Performance Level</span> controls how hard
        the AI thinks. Lower levels are fast and cheap; higher levels are deeper but use
        more of your daily token budget. You have a token allowance that{" "}
        <span className="text-white font-bold">resets every day at midnight UTC</span> —
        change the level any time in Profile.
      </>
    ),
  },
  {
    icon: <AIAssistantIcon className="h-5 w-5" />,
    title: "You're all set",
    body: (
      <>
        Start by uploading your first PDF. We&apos;ll point out where each part of the app
        lives — you can skip the pointers whenever you like.
      </>
    ),
  },
];

/** A coachmark step: which element to spotlight + what to say about it. The
 *  icon mirrors that destination's real nav glyph so the tip ties visually to
 *  the bar it's pointing at — no generic placeholder icons. */
interface Coachmark {
  selector: string;
  icon: ComponentType<LucideProps>;
  title: string;
  body: string;
}

const COACHMARKS: Coachmark[] = [
  {
    selector: "[data-tour='home']",
    icon: Home,
    title: "Home base",
    body: "Your dashboard: study progress, recent documents, and quick links back into anything you've started.",
  },
  {
    selector: "[data-tour='history']",
    icon: History,
    title: "Pick up where you left off",
    body: "Every summary, quiz, and chat you generate is saved in History so you can revisit it any time.",
  },
  {
    selector: "[data-tour='leaderboard']",
    icon: Trophy,
    title: "Leaderboard & achievements",
    body: "See how your study streaks and engagement rank against other students, and unlock badges for your efforts.",
  },
  {
    selector: "[data-tour='profile']",
    icon: User,
    title: "Settings & usage",
    body: "Profile holds Performance Level, themes, and your daily token & upload usage.",
  },
  // Ends on Upload — the first action we want a new user to take.
  {
    selector: "[data-tour='upload']",
    icon: Upload,
    title: "Upload your first PDF",
    body: "This is where it all starts. Drop a document in and summaries, quizzes, and chat open up around it.",
  },
];

type Phase = "modal" | "coach" | "done";

export function OnboardingFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("modal");
  const [stepIndex, setStepIndex] = useState(0);
  const [coachIndex, setCoachIndex] = useState(0);

  const finish = () => {
    markOnboarded();
    setPhase("done");
  };

  // ---- Welcome modal -------------------------------------------------------
  const isLastStep = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];

  const handleNext = () => {
    if (isLastStep) {
      setPhase("coach");
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  if (phase === "done") return null;

  if (phase === "modal") {
    return (
      <Modal
        open
        onClose={finish}
        hideClose
        dismissable={false}
        maxWidth="max-w-md"
        className="items-stretch"
      >
        {/* Visual-first: illustration on welcome, a gold badge on later steps. */}
        {stepIndex === 0 ? (
          <div className="flex items-center justify-center -mt-1">
            <OnboardingIllustration />
          </div>
        ) : (
          <div className="h-12 w-12 rounded-2xl border border-accent-gold/20 bg-accent-gold/10 text-accent-gold flex items-center justify-center">
            {step.icon}
          </div>
        )}

        <h2 className="text-lg font-black text-white tracking-tight">{step.title}</h2>
        <p className="text-xs text-text-muted leading-relaxed">{step.body}</p>

        {/* Progress dots — same language as the dashboard document carousel. */}
        <div className="flex items-center gap-2 mt-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex ? "w-6 bg-accent-gold" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-bold text-text-muted hover:text-white transition cursor-pointer px-2 py-2.5"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 px-4 font-bold text-sm bg-brand-primary text-black hover:bg-brand-primary-hover transition cursor-pointer"
          >
            {isLastStep ? "Show me around" : "Next"}
            <ArrowRight className="h-4 w-4 stroke-[2.5px]" />
          </button>
        </div>
      </Modal>
    );
  }

  // ---- Coachmarks ----------------------------------------------------------
  return (
    <Coachmarks
      marks={COACHMARKS}
      index={coachIndex}
      onAdvance={() => {
        if (coachIndex === COACHMARKS.length - 1) {
          finish();
          router.push("/dashboard/upload");
        } else {
          setCoachIndex((i) => i + 1);
        }
      }}
      onSkip={finish}
    />
  );
}

/**
 * Spotlight overlay that points at a real element in the live UI. It reads the
 * target's on-screen rect and cuts a soft highlight around it, then floats a
 * small tip card next to it. Falls back gracefully (centred tip) if the target
 * isn't on screen — e.g. the nav target is hidden behind a breakpoint.
 */
function Coachmarks({
  marks,
  index,
  onAdvance,
  onSkip,
}: {
  marks: Coachmark[];
  index: number;
  onAdvance: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const mark = marks[index];

  useLayoutEffect(() => {
    const measure = () => {
      // The nav target exists twice (mobile bar + desktop sidebar); only one is
      // visible per breakpoint. Pick the first match that's actually rendered.
      const els = Array.from(document.querySelectorAll(mark.selector));
      const visible = els
        .map((el) => el.getBoundingClientRect())
        .find((r) => r.width > 0 && r.height > 0);
      setRect(visible ?? null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [mark.selector]);

  // Escape skips the tour, matching the modal's dismiss affordances.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const isLast = index === marks.length - 1;
  const MarkIcon = mark.icon;

  const GUTTER = 12;
  const CARD_W = 260;
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const cardW = Math.min(CARD_W, vw - GUTTER * 2);

  // Resolved card position. Computed in a layout effect from the card's *real*
  // height (estimating it caused the card to clip below the floating mobile nav
  // bar). null until measured so we don't paint it in the wrong spot first.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!tipRef.current) return;
    const vh = window.innerHeight;
    const cardH = tipRef.current.offsetHeight;

    if (!rect) {
      // No target on screen (e.g. hidden behind a breakpoint): centre the card.
      setPos({
        left: (vw - cardW) / 2,
        top: Math.max(GUTTER, (vh - cardH) / 2),
      });
      return;
    }

    // Vertical: prefer below the target; flip above if the *measured* card would
    // run past the bottom. Then clamp into the gutters either way.
    const belowTop = rect.bottom + 12;
    const aboveTop = rect.top - 12 - cardH;
    let top = belowTop + cardH + GUTTER > vh ? aboveTop : belowTop;
    top = Math.min(Math.max(top, GUTTER), vh - cardH - GUTTER);

    // Horizontal: aim the card's centre at the target, clamp the whole card in.
    const desiredLeft = rect.left + rect.width / 2 - cardW / 2;
    const left = Math.min(Math.max(desiredLeft, GUTTER), vw - GUTTER - cardW);

    setPos({ left, top });
    // mark.body changes the card height, so re-measure when the step changes.
  }, [rect, cardW, vw, mark.body]);

  return (
    <div className="fixed inset-0 z-[9998] animate-in fade-in duration-200" onClick={onAdvance}>
      {/* Dimmed backdrop with a soft cut-out spotlight ring around the target. */}
      <div className="absolute inset-0 bg-black/70" />
      {rect && (
        <div
          className="absolute rounded-2xl ring-2 ring-accent-gold/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none transition-all duration-300"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      )}

      <div
        ref={tipRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          left: pos?.left ?? 0,
          top: pos?.top ?? 0,
          width: cardW,
          visibility: pos ? "visible" : "hidden",
        }}
        className="absolute gpu-isolate bg-surface-modal border border-border-subtle rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col gap-2 animate-in scale-in duration-300"
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-accent-gold/10 border border-accent-gold/20 text-accent-gold flex items-center justify-center shrink-0">
            <MarkIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-extrabold text-white">{mark.title}</span>
        </div>
        <p className="text-[11px] text-text-muted leading-relaxed">{mark.body}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-bold text-text-muted">
            {index + 1} of {marks.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-[11px] font-bold text-text-muted hover:text-white transition cursor-pointer"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onAdvance}
              className="text-[11px] font-black text-black bg-accent-gold hover:brightness-110 rounded-full px-3 py-1.5 transition cursor-pointer"
            >
              {isLast ? "Start uploading" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
