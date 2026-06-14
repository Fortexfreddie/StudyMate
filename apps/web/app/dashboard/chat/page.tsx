"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileText, Send, MessageSquare, AlertTriangle } from "lucide-react";
import { AIAssistantIcon, SleekLightningIcon } from "@/components/shared/Icons";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { CollapsibleSources, RichMarkdown } from "@/components/shared/SourceReferences";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { api, ApiClientError } from "@/lib/api";
import { getActivePerfConfig } from "@/lib/performance";
import { useSourceCite } from "@/lib/useSourceCite";
import type { Source } from "@/lib/types";

interface MessageItem {
  id: string;
  sender: "ai" | "user";
  text: string;
  time: string;
  sources?: Source[];
  contextSufficient?: boolean;
  cached?: boolean;
}

function formatTime(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc") ?? undefined;

  const [docName, setDocName] = useState<string>("Chat");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [topK, setTopK] = useState<number>(10);
  const [maxK, setMaxK] = useState<number>(20);
  const [perfMode, setPerfMode] = useState<string>("high");
  const [isTyping, setIsTyping] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Clickable "Source #N" citations scroll to / highlight the matching card.
  // Keys are namespaced per message (`${msgId}:${index}`) since each AI reply
  // carries its own source list.
  const { registerRef, cite, active } = useSourceCite<string>();

  useEffect(() => {
    const { mode, config } = getActivePerfConfig();
    setTopK(config.default);
    setMaxK(config.max);
    setPerfMode(mode);
  }, []);

  // Load the document name (for the header) and prior chat history for this doc.
  useEffect(() => {
    let active = true;
    async function load() {
      if (docId) {
        try {
          const doc = await api.documents.get(docId);
          if (active) setDocName(doc.filename);
        } catch {
          // Non-fatal: keep the default header.
        }
      }
      try {
        const history = await api.history.chatHistory({
          doc_id: docId,
          limit: 50,
        });
        if (!active) return;
        // History returns newest-first; reverse to chronological and flatten
        // each query/answer row into a user + ai message pair.
        const hydrated: MessageItem[] = [];
        for (const m of [...history.messages].reverse()) {
          hydrated.push({
            id: `${m.id}-q`,
            sender: "user",
            text: m.query,
            time: formatTime(m.created_at),
          });
          hydrated.push({
            id: `${m.id}-a`,
            sender: "ai",
            text: m.answer,
            time: formatTime(m.created_at),
            sources: m.sources,
            contextSufficient: m.context_sufficient,
          });
        }
        setMessages(hydrated);
      } catch {
        // Non-fatal: start with an empty thread.
      } finally {
        if (active) setHistoryLoaded(true);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [docId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputText.trim();
    if (!query || isTyping) return;

    const userMsg: MessageItem = {
      id: `local-${Date.now()}`,
      sender: "user",
      text: query,
      time: formatTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    try {
      const res = await api.chat.send({ query, doc_id: docId, top_k: topK });
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: res.answer,
          time: formatTime(),
          sources: res.sources,
          contextSufficient: res.context_sufficient,
          cached: res.meta?.cached,
        },
      ]);
    } catch (err) {
      const detail =
        err instanceof ApiClientError
          ? err.detail
          : "Something went wrong generating a response.";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          text: detail,
          time: formatTime(),
          contextSufficient: false,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full h-[calc(100dvh-7rem)] md:h-[100dvh] justify-between p-4 sm:p-6 md:p-8">
      <PageHeader
        title={docName}
        onBack={() =>
          router.push(docId ? `/dashboard/document/${docId}` : "/dashboard")
        }
        titleIcon={<FileText className="h-4.5 w-4.5 text-text-muted shrink-0" />}
        className="pb-4 border-b border-border-subtle shrink-0"
      />

      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-5 px-1 scrollbar-none scroll-smooth">
        {/* Greeting / empty state */}
        {historyLoaded && messages.length === 0 && (
          <div className="flex gap-3 max-w-[85%] self-start items-start animate-in fade-in slide-in-from-bottom-2 duration-250">
            <div className="h-7 w-7 rounded-full bg-brand-primary flex items-center justify-center text-accent-gold-fg shrink-0 mt-0.5 shadow">
              <AIAssistantIcon className="h-4.5 w-4.5" />
            </div>
            <div className="p-3.5 px-4 rounded-2xl rounded-tl-sm text-xs sm:text-sm leading-relaxed bg-surface-raised border border-border-subtle text-white shadow-sm">
              Hi! Ask me anything about{" "}
              {docId ? "this document" : "your uploaded documents"} and I&apos;ll answer
              using only what&apos;s in {docId ? "it" : "them"}.
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isAI = msg.sender === "ai";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${
                isAI ? "self-start items-start" : "self-end items-end flex-row-reverse"
              } animate-in fade-in slide-in-from-bottom-2 duration-250`}
            >
              {isAI && (
                <div className="h-7 w-7 rounded-full bg-brand-primary flex items-center justify-center text-accent-gold-fg shrink-0 mt-0.5 shadow">
                  <AIAssistantIcon className="h-4.5 w-4.5" />
                </div>
              )}

              <div className="flex flex-col gap-1.5 min-w-0">
                {/* Context-insufficient banner */}
                {isAI && msg.contextSufficient === false && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent-coral">
                    <AlertTriangle className="h-3 w-3" />
                    Limited context for this question
                  </div>
                )}

                <div
                  className={`p-3.5 px-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm min-w-0 ${
                    isAI
                      ? "bg-surface-raised border border-border-subtle text-white rounded-tl-sm"
                      : "bg-brand-primary text-accent-gold-fg font-bold rounded-tr-sm whitespace-pre-wrap"
                  }`}
                >
                  {isAI ? (
                    <RichMarkdown
                      text={msg.text}
                      sourceCount={msg.sources?.length ?? 0}
                      onCite={(i) => cite(`${msg.id}:${i}`)}
                    />
                  ) : (
                    msg.text
                  )}
                </div>

                {/* Collapsible Sources */}
                {isAI && msg.sources && msg.sources.length > 0 && (
                  <CollapsibleSources
                    sources={msg.sources}
                    activeIdx={
                      active && active.startsWith(`${msg.id}:`)
                        ? Number(active.split(":")[1])
                        : null
                    }
                    registerRef={(idx, el) => registerRef(`${msg.id}:${idx}`, el)}
                  />
                )}

                <div
                  className={`flex items-center gap-1.5 text-[10px] text-text-muted ${
                    isAI ? "justify-start pl-1" : "justify-end pr-1"
                  }`}
                >
                  <span>{msg.time}</span>
                  {isAI && msg.cached && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-brand-primary">
                      <SleekLightningIcon className="h-3 w-3" /> instant
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3 items-center self-start max-w-[80%] pl-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="h-7 w-7 rounded-full bg-brand-primary flex items-center justify-center text-accent-gold-fg shrink-0 shadow animate-pulse">
              <AIAssistantIcon className="h-4.5 w-4.5" />
            </div>
            <div className="bg-surface-raised border border-border-subtle rounded-2xl px-4 py-3 text-xs text-text-muted flex items-center gap-1 shadow-sm">
              <span className="font-semibold">AI is searching your document</span>
              <span className="flex gap-0.5 ml-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-coral animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-accent-coral animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-accent-coral animate-bounce" />
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="w-full shrink-0 pt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between px-3 text-[10px] text-text-muted select-none">
          <div className="flex items-center gap-1.5">
            <span>Context Depth (K):</span>
            <span className="font-extrabold text-brand-primary">{topK} / {maxK} Chunks</span>
            <span className="text-[8px] text-text-muted hidden sm:inline">({perfMode.toUpperCase()} limit)</span>
            <InfoTooltip label="What is Context Depth?">
              <strong className="text-white">Context Depth (K)</strong> is how many excerpts
              (&ldquo;chunks&rdquo;) from your document the AI reads before answering. Higher = more
              thorough but slower; the cap depends on your performance level.
            </InfoTooltip>
          </div>
          <div className="flex items-center gap-2">
            <span className="scale-75 origin-right">
              <input
                type="range"
                min={5}
                max={maxK}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-24 h-1 bg-surface rounded-lg appearance-none cursor-pointer accent-brand-primary transition-all duration-300"
              />
            </span>
          </div>
        </div>
        <div className="w-full bg-surface-raised border border-border-subtle rounded-full p-2 pl-4 flex items-center gap-3 shadow-md transition-all duration-300 focus-within:border-brand-primary/40 focus-within:ring-1 focus-within:ring-brand-primary/20">
          <div className="h-7 w-7 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 select-none">
            <MessageSquare className="h-3.5 w-3.5 fill-current" />
          </div>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask anything about your document"
            disabled={isTyping}
            className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-white placeholder:text-text-muted h-9 focus:ring-0 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 select-none cursor-pointer ${
              inputText.trim() && !isTyping
                ? "bg-brand-primary text-accent-gold-fg hover:bg-brand-primary-hover hover:scale-105 active:scale-95 shadow"
                : "bg-white/5 text-text-muted cursor-not-allowed"
            }`}
          >
            <Send className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-main text-white p-8">Loading Chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}
