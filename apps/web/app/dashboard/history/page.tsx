"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  FileText,
  HelpCircle,
  MessageSquare,
  Layers,
  ExternalLink,
  Plus,
} from "lucide-react";
import { IconButton } from "@/components/shared/IconButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";

type ActivityType = "quiz" | "summary" | "chat";
type TabType = "All" | "Quizzes" | "Summaries" | "Chats";

interface TimelineItem {
  key: string;
  title: string;
  type: ActivityType;
  status: string;
  statusColor: string;
  timestamp: number;
  dateLabel: string;
  timeLabel: string;
  href: string;
}

const SUMMARY_PREFIX = "Summary request:";

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    timestamp: d.getTime(),
    dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    timeLabel: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const { data: chatData, isLoading: chatLoading, error: chatError, refetch: refetchChat } =
    useApi(() => api.history.chatHistory({ limit: 100 }), []);
  const { data: quizData, isLoading: quizLoading, error: quizError, refetch: refetchQuiz } =
    useApi(() => api.history.quizHistory({ limit: 100 }), []);

  const isLoading = chatLoading || quizLoading;
  const error = chatError || quizError;

  // Merge chat (split into chat vs summary by prefix) + quiz into one timeline.
  const items = useMemo<TimelineItem[]>(() => {
    const merged: TimelineItem[] = [];

    for (const m of chatData?.messages ?? []) {
      const t = formatDate(m.created_at);
      const isSummary = m.query.startsWith(SUMMARY_PREFIX);
      if (isSummary) {
        const topic = m.query
          .replace(SUMMARY_PREFIX, "")
          .replace(/\s*\[format=[^\]]*\]\s*$/, "")
          .trim();
        merged.push({
          key: `sum-${m.id}`,
          title: topic || "Document summary",
          type: "summary",
          status: "Summary Generated",
          statusColor: "bg-[#d6b2d1]/10 text-[#d6b2d1] border-[#d6b2d1]/10",
          ...t,
          href: m.doc_id ? `/dashboard/summary?doc=${m.doc_id}` : "/dashboard/summary",
        });
      } else {
        merged.push({
          key: `chat-${m.id}`,
          title: m.query,
          type: "chat",
          status: "Chat Session",
          statusColor: "bg-sky-400/10 text-sky-400 border-sky-400/10",
          ...t,
          href: m.doc_id ? `/dashboard/chat?doc=${m.doc_id}` : "/dashboard/chat",
        });
      }
    }

    for (const s of quizData?.sessions ?? []) {
      const t = formatDate(s.created_at);
      merged.push({
        key: `quiz-${s.id}`,
        title: `${s.topic} — ${s.score}/${s.total_questions}`,
        type: "quiz",
        status: "Quiz Completed",
        statusColor: "bg-emerald-400/10 text-emerald-400 border-emerald-400/10",
        ...t,
        href: s.doc_id ? `/dashboard/quiz?doc=${s.doc_id}` : "/dashboard/quiz",
      });
    }

    return merged;
  }, [chatData, quizData]);

  const filtered = useMemo(() => {
    const matchesTab = (i: TimelineItem) =>
      activeTab === "All" ||
      (activeTab === "Quizzes" && i.type === "quiz") ||
      (activeTab === "Summaries" && i.type === "summary") ||
      (activeTab === "Chats" && i.type === "chat");

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = (i: TimelineItem) =>
      !q || i.title.toLowerCase().includes(q) || i.status.toLowerCase().includes(q);

    return items
      .filter(matchesTab)
      .filter(matchesSearch)
      .sort((a, b) =>
        sortBy === "newest" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
      );
  }, [items, activeTab, searchQuery, sortBy]);

  const isFiltering = searchQuery.trim() !== "" || activeTab !== "All";

  const getIcon = (type: ActivityType) => {
    if (type === "quiz") return <HelpCircle className="h-4.5 w-4.5" />;
    if (type === "summary") return <Layers className="h-4.5 w-4.5" />;
    return <MessageSquare className="h-4.5 w-4.5" />;
  };

  const getBadge = (type: ActivityType) => {
    if (type === "quiz") return "bg-emerald-400/10 text-emerald-400 border-emerald-400/20";
    if (type === "summary") return "bg-purple-400/10 text-purple-400 border-purple-400/20";
    return "bg-sky-400/10 text-sky-400 border-sky-400/20";
  };

  const tabs: TabType[] = ["All", "Quizzes", "Summaries", "Chats"];

  return (
    <div className="flex-1 flex flex-col max-w-[760px] mx-auto w-full p-4 sm:p-6 md:py-8 justify-start gap-5">
      <header className="flex items-center justify-between w-full select-none">
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Study History</h1>
        <IconButton aria-label="Notifications" icon={<Bell className="h-4.5 w-4.5 text-white" />} />
      </header>

      {/* Search */}
      <section className="w-full">
        <div className="w-full bg-surface border border-white/5 rounded-2xl p-3 px-4 flex items-center gap-3 shadow shadow-black/10">
          <Search className="h-4.5 w-4.5 text-text-muted shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your study history..."
            className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-white placeholder:text-text-muted focus:ring-0 focus:outline-none"
          />
        </div>
      </section>

      {/* Tabs */}
      <section className="w-full overflow-x-auto scrollbar-none flex items-center gap-2 pb-1 shrink-0 select-none">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === tab
                ? "border border-accent-gold text-accent-gold bg-transparent"
                : "bg-surface border border-white/5 text-text-muted hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </section>

      {/* Sort */}
      <section className="flex items-center justify-between w-full select-none mt-1 shrink-0">
        <span className="text-xs sm:text-sm font-extrabold text-white">Recent Activity</span>
        <button
          onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
          className="text-xs font-bold text-text-muted flex items-center gap-1 hover:text-white transition"
        >
          {sortBy === "newest" ? "Newest First" : "Oldest First"}
        </button>
      </section>

      {/* Body */}
      {isLoading ? (
        <LoadingState className="mt-12" label="Loading your history…" />
      ) : error ? (
        <ErrorState
          className="mt-12"
          title="Couldn't load history"
          message={error}
          onRetry={() => {
            refetchChat();
            refetchQuiz();
          }}
        />
      ) : (
        <section className="relative w-full flex flex-col gap-4.5">
          {filtered.length > 0 && (
            <div className="absolute left-[18px] top-6 bottom-6 w-[2px] bg-white/5" />
          )}

          {filtered.map((item) => (
            <div key={item.key} className="flex gap-4 w-full relative animate-in fade-in duration-200">
              <div className={`h-[38px] w-[38px] rounded-full border border-white/5 flex items-center justify-center shrink-0 z-10 shadow ${getBadge(item.type)}`}>
                {getIcon(item.type)}
              </div>
              <div className="flex-1 bg-surface border border-white/5 rounded-2xl p-4.5 flex items-center justify-between gap-3 shadow-md shadow-black/10 hover:border-white/10 transition">
                <div className="flex flex-col gap-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white truncate">{item.title}</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 mt-1.5 select-none">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider leading-none w-fit ${item.statusColor}`}>
                      {item.status}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {item.dateLabel} • {item.timeLabel}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => router.push(item.href)}
                  className="h-8 w-8 rounded-full bg-white/5 hover:bg-accent-gold/10 hover:text-accent-gold text-text-muted flex items-center justify-center transition shrink-0 cursor-pointer focus:outline-none"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="w-full bg-surface border border-white/5 rounded-3xl p-6.5 shadow-md shadow-black/20 mt-2.5">
              <EmptyState
                title={isFiltering ? "No matching activity" : "No study history yet"}
                description={
                  isFiltering
                    ? "Try a different search term or filter to find your activity."
                    : "Upload documents, take quizzes, generate summaries or chat with AI to see your activity here."
                }
                icon={
                  <span className="h-14 w-14 rounded-2xl bg-card-bg border border-border-subtle flex items-center justify-center text-text-muted">
                    <FileText className="h-7 w-7" />
                  </span>
                }
                action={
                  !isFiltering && (
                    <button
                      onClick={() => router.push("/dashboard/upload")}
                      className="py-3 px-5 bg-accent-gold hover:bg-accent-gold-hover text-accent-gold-fg font-bold rounded-full text-xs flex items-center justify-center gap-1.5 transition shadow shadow-accent-gold/10 cursor-pointer select-none focus:outline-none"
                    >
                      <Plus className="h-4 w-4 stroke-[3px]" />
                      Upload Your First Document
                    </button>
                  )
                }
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
