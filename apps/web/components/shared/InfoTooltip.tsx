"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
 */
export function InfoTooltip({ children, label = "More info", className = "" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({
    left: "50%",
    transform: "translateX(-50%)",
  });
  // Vertical placement: "top" opens the panel above the trigger (default),
  // "bottom" flips it below when there isn't enough room above (e.g. when the
  // trigger sits in a page header near the top of the viewport). This prevents
  // the panel being clipped above/behind the top bar.
  const [placement, setPlacement] = useState<"top" | "bottom">("top");

  useEffect(() => {
    if (!open) return;

    const adjustPosition = () => {
      if (!panelRef.current || !wrapRef.current) return;
      const padding = 16;

      // Vertical flip: if the panel would extend above the viewport, open below.
      const triggerRect = wrapRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      const spaceAbove = triggerRect.top;
      const needed = panelRect.height + padding;
      setPlacement(spaceAbove < needed ? "bottom" : "top");

      // Horizontal clamp: nudge the panel back into view if it overflows a side.
      let offset = 0;
      if (panelRect.right > window.innerWidth - padding) {
        offset = window.innerWidth - padding - panelRect.right;
      } else if (panelRect.left < padding) {
        offset = padding - panelRect.left;
      }

      setPositionStyle({
        left: "50%",
        transform: `translateX(calc(-50% + ${offset}px))`,
      });
    };

    const rafId = requestAnimationFrame(adjustPosition);

    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      setPositionStyle({ left: "50%", transform: "translateX(-50%)" });
      setPlacement("top");
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
      {open && (
        <span
          ref={panelRef}
          id={panelId}
          role="tooltip"
          style={positionStyle}
          className={`absolute z-50 w-56 max-w-[70vw] rounded-xl bg-surface-raised border border-border-subtle p-2.5 text-[10px] font-medium text-text-muted leading-relaxed shadow-xl shadow-black/40 animate-in fade-in zoom-in-95 duration-150 normal-case tracking-normal text-left ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
