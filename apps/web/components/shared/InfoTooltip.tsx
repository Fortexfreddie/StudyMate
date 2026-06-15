"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  /** Short plain-language explanation of the adjacent jargon. */
  children: ReactNode;
  /** Accessible label for the trigger (e.g. "What is Context Depth?"). */
  label?: string;
  className?: string;
}

/**
 * A small inline "(i)" affordance for explaining jargon (Context Depth, chunks,
 * performance tiers, …). Tap to toggle (mobile) or hover/focus to reveal
 * (desktop); closes on outside-click or Escape. Pure client, no library.
 *
 * The panel is rendered through a portal into <body> with `position: fixed`. This
 * is deliberate: an in-flow/absolute panel either gets clipped by an `overflow`
 * ancestor (cards, scroll areas) or extends the document width near a viewport
 * edge. Portaling to body sidesteps both — it can't be clipped by ancestors and
 * can't add page width — and we clamp its coordinates to the viewport so it
 * always stays fully on-screen on mobile and desktop alike.
 */
export function InfoTooltip({ children, label = "More info", className = "" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // Viewport coordinates for the fixed panel; null until measured (so it doesn't
  // flash at 0,0 before we've positioned it).
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Portals require the DOM; only render the panel after mount (also keeps SSR happy).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const adjustPosition = () => {
      if (!panelRef.current || !wrapRef.current) return;
      const padding = 12;
      const gap = 6;

      const triggerRect = wrapRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Vertical: prefer above the trigger; flip below if there's no room.
      const fitsAbove = triggerRect.top >= panelRect.height + gap + padding;
      const top = fitsAbove
        ? triggerRect.top - gap - panelRect.height
        : triggerRect.bottom + gap;

      // Horizontal: center over the trigger, then clamp into the viewport.
      const center = triggerRect.left + triggerRect.width / 2;
      let left = center - panelRect.width / 2;
      left = Math.min(left, vw - padding - panelRect.width);
      left = Math.max(left, padding);

      setCoords({
        top: Math.max(padding, Math.min(top, vh - padding - panelRect.height)),
        left,
      });
    };

    const rafId = requestAnimationFrame(adjustPosition);

    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // The panel is fixed to the viewport, so it won't track a scrolling page —
    // close it on scroll/resize rather than let it drift away from its trigger.
    const onScrollResize = () => setOpen(false);

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      setCoords(null);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-text-muted hover:text-brand-primary transition cursor-help focus:outline-none focus-visible:text-brand-primary"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open &&
        mounted &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="tooltip"
            // Plain opacity fade — no transform/keyframe animation, so the panel
            // never appears to "fly in" from where it was first measured. It's
            // positioned purely with top/left and just fades from 0 to 1 once
            // `coords` are computed.
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              opacity: coords ? 1 : 0,
              transition: "opacity 120ms ease-out",
            }}
            className="fixed z-[100] w-56 max-w-[calc(100vw-24px)] rounded-xl bg-surface-raised border border-border-subtle p-2.5 text-[10px] font-medium text-text-muted leading-relaxed shadow-xl shadow-black/40 normal-case tracking-normal text-left"
          >
            {children}
          </div>,
          document.body
        )}
    </span>
  );
}
