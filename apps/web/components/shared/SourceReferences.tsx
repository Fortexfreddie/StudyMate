import { type ReactNode, Children, isValidElement, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { Source } from "@/lib/types";

// The AI prose cites retrieved chunks as "Source #N", where N is the 1-based
// index into the response's `sources` array. We turn each mention into a chip
// that calls `onCite(N - 1)` so the page can scroll to / highlight that card.
const SOURCE_REF = /(Source #\d+)/g;

/** Replace "Source #N" substrings inside a plain string with clickable chips. */
function linkifyString(
  text: string,
  sourceCount: number,
  onCite: (index: number) => void,
  keyPrefix: string
): ReactNode[] {
  return text.split(SOURCE_REF).map((part, i) => {
    const match = /^Source #(\d+)$/.exec(part);
    if (!match) return part;
    const n = Number(match[1]);
    const idx = n - 1;
    // Only link mentions that actually map to a returned source.
    if (idx < 0 || idx >= sourceCount) return part;
    return (
      <button
        key={`${keyPrefix}-${i}`}
        type="button"
        onClick={() => onCite(idx)}
        className="text-brand-primary font-bold underline decoration-dotted underline-offset-2 hover:text-brand-primary-hover cursor-pointer"
      >
        {part}
      </button>
    );
  });
}

/**
 * Recursively walk React children, linkifying any string leaves. Lets us pass
 * this as a transform to ReactMarkdown leaf components (p, li, strong, …) or
 * apply it directly to plain text.
 */
export function linkifySources(
  children: ReactNode,
  sourceCount: number,
  onCite: (index: number) => void,
  keyPrefix = "src"
): ReactNode {
  if (sourceCount === 0) return children;

  return Children.map(children, (child, i) => {
    if (typeof child === "string") {
      return linkifyString(child, sourceCount, onCite, `${keyPrefix}-${i}`);
    }
    if (isValidElement(child)) {
      const el = child as React.ReactElement<{ children?: ReactNode }>;
      if (el.type === "button" || el.type === "a" || el.type === "code") {
        return child;
      }
      if (el.props?.children) {
        return {
          ...el,
          props: {
            ...el.props,
            children: linkifySources(
              el.props.children,
              sourceCount,
              onCite,
              `${keyPrefix}-${i}`
            ),
          },
        };
      }
    }
    return child;
  });
}

interface SourceCardProps {
  source: Source;
  index: number;
  highlighted: boolean;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
}

/** A single retrieved-chunk card. Highlights briefly when its ref is cited. */
export function SourceCard({ source, index, highlighted, registerRef }: SourceCardProps) {
  return (
    <div
      ref={(el) => registerRef(index, el)}
      className={`bg-card-bg border rounded-xl p-2.5 flex flex-col gap-0.5 scroll-mt-24 transition-colors duration-500 ${
        highlighted ? "border-brand-primary bg-brand-primary/5" : "border-border-subtle"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-white truncate">
          <span className="text-brand-primary">#{index + 1}</span> {source.filename} • p.
          {source.page_number}
        </span>
        <span className="text-[9px] font-bold text-brand-primary shrink-0">
          {Math.round(source.similarity_score * 100)}% match
        </span>
      </div>
      <span className="text-[10px] text-text-muted leading-snug line-clamp-2">
        {source.text_preview}
      </span>
    </div>
  );
}

interface CollapsibleSourcesProps {
  sources: Source[];
  activeIdx: number | null;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
}

/** Wraps a list of source cards in a smooth CSS grid height-collapsible wrapper. */
export function CollapsibleSources({ sources, activeIdx, registerRef }: CollapsibleSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-expand if a source inside this section is actively cited
  useEffect(() => {
    if (activeIdx !== null) {
      setIsOpen(true);
    }
  }, [activeIdx]);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full mt-2.5 select-none">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-white transition w-fit cursor-pointer focus:outline-none"
      >
        <span>Sources ({sources.length})</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-brand-primary" : ""
          }`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 overflow-hidden"
        }`}
      >
        <div className="overflow-hidden flex flex-col gap-2.5 pt-1.5">
          {sources.map((s, idx) => (
            <SourceCard
              key={idx}
              source={s}
              index={idx}
              highlighted={activeIdx === idx}
              registerRef={(i, el) => registerRef(i, el)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
