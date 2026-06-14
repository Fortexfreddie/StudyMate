import { type ReactNode, Children, isValidElement, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Source } from "@/lib/types";

// The AI prose cites retrieved chunks as "Source #N", where N is the 1-based
// index into the response's `sources` array. We turn each mention into a chip
// that calls `onCite(N - 1)` so the page can scroll to / highlight that card.
const SOURCE_REF = /(Source #\d+)/g;

// Older LLM output (and the occasional stray model response) puts literal <br>
// tags inside table cells to separate sub-points. We render markdown WITHOUT
// rehype-raw (so raw HTML is never parsed — avoids an XSS surface from model
// output), which means a literal <br> would otherwise show as text. Normalize
// any <br> / <br/> / <br /> into a "• " separator so cells stay on one readable
// line with clear sub-points instead of a leaked tag.
const BR_TAG = /<br\s*\/?>/gi;
function stripBrTags(text: string): string {
  return text.replace(BR_TAG, " • ");
}

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

/**
 * Renders a short LLM string as inline markdown (bold/italic/code/links) while
 * still turning "Source #N" mentions into clickable citation chips.
 *
 * The summary structured views (bullets, concept descriptions, flashcard backs,
 * cheat-sheet values, mind-map leaves) receive raw markdown from the model. Before
 * this, they were rendered as plain text, so `**bold**` and `` `code` `` leaked
 * through as literal markers. This mirrors the chat page's ReactMarkdown setup but
 * unwraps the top-level <p> so it stays inline inside the existing layout.
 */
export function InlineMarkdown({
  text,
  sourceCount,
  onCite,
}: {
  text: string;
  sourceCount: number;
  onCite: (index: number) => void;
}): ReactNode {
  const link = (children: ReactNode) =>
    linkifySources(children, sourceCount, onCite);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Unwrap block-level <p> so the content flows inline within the card's
        // own <p>/<span> wrapper instead of injecting nested block elements.
        p: ({ children }) => <>{link(children)}</>,
        strong: ({ children }) => (
          <strong className="font-extrabold text-white">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-black/30 rounded px-1 py-0.5 font-mono text-[0.9em] text-brand-primary">
            {children}
          </code>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary underline underline-offset-2"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 flex flex-col gap-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 flex flex-col gap-1">{children}</ol>
        ),
        li: ({ children }) => <li>{link(children)}</li>,
      }}
    >
      {stripBrTags(text)}
    </ReactMarkdown>
  );
}

/**
 * Shared ReactMarkdown component map for full block-level LLM content (chat answers
 * and the tabular summary). `link` wraps text leaves so "Source #N" mentions become
 * clickable chips.
 *
 * Tables are the important part: each table is wrapped in its OWN horizontally
 * scrollable container (`overflow-x-auto` + `max-w-full`). Combined with a
 * `min-w-0` parent, this keeps wide tables scrolling *inside their card* on mobile
 * instead of widening the page and causing the whole screen to scroll left/right.
 */
export function buildMarkdownComponents(link: (children: ReactNode) => ReactNode) {
  return {
    table: ({ children }: { children?: ReactNode }) => (
      <div className="overflow-x-auto max-w-full my-2 rounded-lg border border-border-subtle">
        <table className="w-max min-w-full text-[11px] sm:text-xs border-collapse">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: { children?: ReactNode }) => (
      <thead className="bg-white/5">{children}</thead>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <th className="border border-border-subtle px-2.5 py-1.5 text-left font-extrabold text-white whitespace-nowrap">
        {link(children)}
      </th>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <td className="border border-border-subtle px-2.5 py-1.5 align-top text-text-muted">
        {link(children)}
      </td>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p className="leading-relaxed">{link(children)}</p>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="list-disc pl-5 flex flex-col gap-1">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="list-decimal pl-5 flex flex-col gap-1">{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => <li>{link(children)}</li>,
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-extrabold text-white">{children}</strong>
    ),
    em: ({ children }: { children?: ReactNode }) => (
      <em className="italic">{children}</em>
    ),
    code: ({ children }: { children?: ReactNode }) => (
      <code className="bg-black/30 rounded px-1 py-0.5 font-mono text-[0.9em] text-brand-primary break-words">
        {children}
      </code>
    ),
    a: ({ children, href }: { children?: ReactNode; href?: string }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-primary underline underline-offset-2 break-words"
      >
        {children}
      </a>
    ),
    h1: ({ children }: { children?: ReactNode }) => (
      <h3 className="font-extrabold text-white text-sm mt-1">{children}</h3>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h3 className="font-extrabold text-white text-sm mt-1">{children}</h3>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h4 className="font-bold text-white mt-1">{children}</h4>
    ),
    h4: ({ children }: { children?: ReactNode }) => (
      <h5 className="font-bold text-white/90">{children}</h5>
    ),
  };
}

/**
 * Full block-level markdown renderer (headings, paragraphs, lists, code, and
 * mobile-safe tables) with clickable "Source #N" citations. Used by the chat
 * answers and the tabular summary so both render identically and never overflow
 * the viewport horizontally.
 */
export function RichMarkdown({
  text,
  sourceCount,
  onCite,
  className = "",
}: {
  text: string;
  sourceCount: number;
  onCite: (index: number) => void;
  className?: string;
}): ReactNode {
  const link = (children: ReactNode) =>
    linkifySources(children, sourceCount, onCite);
  return (
    <div className={`markdown-body min-w-0 max-w-full flex flex-col gap-2 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={buildMarkdownComponents(link)}
      >
        {stripBrTags(text)}
      </ReactMarkdown>
    </div>
  );
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
