"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, SlidersHorizontal, FileText, HelpCircle, MessageSquare, Layers, ExternalLink, Plus } from "lucide-react";
import { DashboardNav } from "../components/DashboardNav";

interface HistoryItem {
  id: number;
  title: string;
  type: "document" | "quiz" | "summary" | "chat";
  status: string;
  statusColor: string;
  date: string;
  time: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Documents" | "Quizzes" | "Summaries" | "Chats">("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  // Exact study activities list from screenshot
  const initialItems: HistoryItem[] = [
    {
      id: 1,
      title: "Data Structures and Algorithms.pdf",
      type: "document",
      status: "Document Uploaded",
      statusColor: "bg-[#f3c494]/10 text-[#f3c494] border-brand-primary/10",
      date: "May 20, 2024",
      time: "10:30 AM",
    },
    {
      id: 2,
      title: "Java Programming Quiz",
      type: "quiz",
      status: "Quiz Completed",
      statusColor: "bg-emerald-400/10 text-emerald-400 border-emerald-400/10",
      date: "May 20, 2024",
      time: "11:15 AM",
    },
    {
      id: 3,
      title: "Machine Learning Basics Summary",
      type: "summary",
      status: "Summary Generated",
      statusColor: "bg-[#d6b2d1]/10 text-[#d6b2d1] border-[#d6b2d1]/10",
      date: "May 20, 2024",
      time: "12:05 PM",
    },
    {
      id: 4,
      title: "Chat: Neural Networks Explained",
      type: "chat",
      status: "Chat Session",
      statusColor: "bg-sky-400/10 text-sky-400 border-sky-400/10",
      date: "May 20, 2024",
      time: "01:20 PM",
    },
    {
      id: 5,
      title: "Operating Systems Notes.pdf",
      type: "document",
      status: "Document Uploaded",
      statusColor: "bg-[#f3c494]/10 text-[#f3c494] border-brand-primary/10",
      date: "May 19, 2024",
      time: "09:45 PM",
    },
  ];

  // Helper function to check if item matches current filter tab
  const matchesTab = (item: HistoryItem) => {
    if (activeTab === "All") return true;
    if (activeTab === "Documents" && item.type === "document") return true;
    if (activeTab === "Quizzes" && item.type === "quiz") return true;
    if (activeTab === "Summaries" && item.type === "summary") return true;
    if (activeTab === "Chats" && item.type === "chat") return true;
    return false;
  };

  // Helper to check if item matches search query
  const matchesSearch = (item: HistoryItem) => {
    return item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           item.status.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Filter & sort list items
  const filteredItems = initialItems
    .filter(matchesTab)
    .filter(matchesSearch)
    .sort((a, b) => {
      if (sortBy === "newest") return b.id - a.id;
      return a.id - b.id;
    });

  const getTabIcon = (itemType: "document" | "quiz" | "summary" | "chat") => {
    switch (itemType) {
      case "quiz":
        return <HelpCircle className="h-4.5 w-4.5" />;
      case "summary":
        return <Layers className="h-4.5 w-4.5" />;
      case "chat":
        return <MessageSquare className="h-4.5 w-4.5" />;
      default:
        return <FileText className="h-4.5 w-4.5" />;
    }
  };

  const getTimelineBadge = (itemType: "document" | "quiz" | "summary" | "chat") => {
    switch (itemType) {
      case "quiz":
        return "bg-emerald-400/10 text-emerald-400 border-emerald-400/20";
      case "summary":
        return "bg-purple-400/10 text-purple-400 border-purple-400/20";
      case "chat":
        return "bg-sky-400/10 text-sky-400 border-sky-400/20";
      default:
        return "bg-[#f3c494]/10 text-[#f3c494] border-brand-primary/20";
    }
  };

  const handleActionClick = (item: HistoryItem) => {
    if (item.type === "document") {
      router.push(`/dashboard/document/data-structures`);
    } else if (item.type === "quiz") {
      router.push(`/dashboard/quiz`);
    } else if (item.type === "summary") {
      router.push(`/dashboard/summary`);
    } else {
      router.push(`/dashboard/chat`);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col md:flex-row pb-28 md:pb-0">
      
      {/* Sidebar Navigation */}
      <DashboardNav />

      {/* Main History View */}
      <div className="flex-1 flex flex-col max-w-[480px] mx-auto w-full p-4 sm:p-6 md:py-8 justify-start gap-5">
        
        {/* Navigation bar header with Bell */}
        <header className="flex items-center justify-between w-full select-none">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Study History
          </h1>
          <button className="relative flex items-center justify-center h-10 w-10 rounded-full bg-[#131313] border border-white/5 hover:bg-white/5 hover:border-white/10 transition shrink-0">
            <Bell className="h-4.5 w-4.5 text-white" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#ef6868]" />
          </button>
        </header>

        {/* SEARCH AND FILTER BAR */}
        <section className="w-full">
          <div className="w-full bg-[#131313] border border-white/5 rounded-2xl p-3 px-4 flex items-center gap-3 shadow shadow-black/10">
            <Search className="h-4.5 w-4.5 text-text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your study history..."
              className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-white placeholder:text-text-muted focus:ring-0 focus:outline-none"
            />
            <button className="h-5 w-5 flex items-center justify-center text-text-muted hover:text-white transition">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* DYNAMIC CATEGORY PILLS FILTER BAR */}
        <section className="w-full overflow-x-auto scrollbar-none flex items-center gap-2 pb-1 shrink-0 select-none">
          {/* Badge: All */}
          <button
            onClick={() => setActiveTab("All")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === "All"
                ? "border border-[#f3c494] text-[#f3c494] bg-transparent"
                : "bg-[#131313] border border-white/5 text-text-muted hover:text-white"
            }`}
          >
            All
          </button>

          {/* Badge: Documents */}
          <button
            onClick={() => setActiveTab("Documents")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "Documents"
                ? "border border-[#f3c494] text-[#f3c494] bg-transparent"
                : "bg-[#131313] border border-white/5 text-text-muted hover:text-white"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Documents
          </button>

          {/* Badge: Quizzes */}
          <button
            onClick={() => setActiveTab("Quizzes")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "Quizzes"
                ? "border border-[#f3c494] text-[#f3c494] bg-transparent"
                : "bg-[#131313] border border-white/5 text-text-muted hover:text-white"
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Quizzes
          </button>

          {/* Badge: Summaries */}
          <button
            onClick={() => setActiveTab("Summaries")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "Summaries"
                ? "border border-[#f3c494] text-[#f3c494] bg-transparent"
                : "bg-[#131313] border border-white/5 text-text-muted hover:text-white"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Summaries
          </button>

          {/* Badge: Chats */}
          <button
            onClick={() => setActiveTab("Chats")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "Chats"
                ? "border border-[#f3c494] text-[#f3c494] bg-transparent"
                : "bg-[#131313] border border-white/5 text-text-muted hover:text-white"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chats
          </button>
        </section>

        {/* TIMELINE ACTIVITIES HEADER */}
        <section className="flex items-center justify-between w-full select-none mt-1 shrink-0">
          <span className="text-xs sm:text-sm font-extrabold text-white">
            Recent Activity
          </span>
          <button
            onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
            className="text-xs font-bold text-text-muted flex items-center gap-1 hover:text-white transition select-none"
          >
            <span>{sortBy === "newest" ? "Newest First" : "Oldest First"}</span>
            {/* Custom dual arrow SVG to match screenshot sorting badge */}
            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
              <path d="M19 14l-1.41-1.41L13 17.17V3h-2v14.17l-4.59-4.59L5 14l7 7 7-7z" />
            </svg>
          </button>
        </section>

        {/* DYNAMIC TIMELINE STREAM BOX */}
        <section className="relative w-full flex flex-col gap-4.5">
          {/* Vertical timeline vertical connector line */}
          {filteredItems.length > 0 && (
            <div className="absolute left-[18px] top-6 bottom-6 w-[2px] bg-white/5" />
          )}

          {filteredItems.map((item) => (
            <div key={item.id} className="flex gap-4 w-full relative animate-in fade-in duration-200">
              
              {/* Circular timeline badge icon on the left */}
              <div className={`h-[38px] w-[38px] rounded-full border border-white/5 flex items-center justify-center shrink-0 z-10 shadow ${
                getTimelineBadge(item.type)
              }`}>
                {getTabIcon(item.type)}
              </div>

              {/* Activity description card details on the right */}
              <div className="flex-1 bg-[#131313] border border-white/5 rounded-2xl p-4.5 flex items-center justify-between gap-3 shadow-md shadow-black/10 hover:border-white/10 transition">
                <div className="flex flex-col gap-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[260px]">
                    {item.title}
                  </h4>
                  
                  {/* Status Badge row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 mt-1.5 select-none">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider select-none leading-none ${
                      item.statusColor
                    }`}>
                      {item.status}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {item.date} • {item.time}
                    </span>
                  </div>
                </div>

                {/* Right external exit button link */}
                <button
                  onClick={() => handleActionClick(item)}
                  className="h-8 w-8 rounded-full bg-white/5 hover:bg-[#f3c494]/10 hover:text-[#f3c494] text-text-muted flex items-center justify-center transition shrink-0 cursor-pointer focus:outline-none"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>
          ))}

          {/* FALLBACK NO HISTORY CARD: Displayed elegantly below activity logs per design */}
          <div className="w-full bg-[#131313] border border-white/5 rounded-3xl p-6.5 flex flex-col items-center text-center gap-4.5 shadow-md shadow-black/20 select-none mt-2.5">
            
            {/* Custom SVG open cardboard box with sliding papers and sparkles stars */}
            <div className="relative h-20 w-32 select-none flex items-center justify-center">
              {/* Star sparkles */}
              <span className="absolute top-0 left-6 text-[#f3c494] text-sm animate-pulse font-mono">*</span>
              <span className="absolute top-2 right-4 text-[#f3c494] text-xs animate-pulse font-mono">*</span>
              <span className="absolute bottom-6 left-1 text-[#f3c494] text-xs animate-pulse font-mono">*</span>

              {/* Custom Drawing Cardboard Box SVG */}
              <svg className="h-16 w-24 overflow-visible" viewBox="0 0 100 80" fill="none">
                {/* Paper sheet 1 sliding out */}
                <path d="M28 20 L58 10 L68 25 L38 35 Z" fill="#f4d3b1" opacity="0.9" />
                <line x1="34" y1="20" x2="48" y2="15" stroke="#3e230d" strokeWidth="0.8" />
                <line x1="38" y1="24" x2="52" y2="19" stroke="#3e230d" strokeWidth="0.8" />

                {/* Paper sheet 2 sliding out */}
                <path d="M48 24 L78 16 L86 31 L56 39 Z" fill="#ebd0b5" opacity="0.85" />
                <line x1="54" y1="24" x2="68" y2="20" stroke="#3e230d" strokeWidth="0.8" />
                <line x1="58" y1="28" x2="72" y2="24" stroke="#3e230d" strokeWidth="0.8" />

                {/* Cardboard box base - back side */}
                <path d="M15 45 L50 30 L85 45 L50 60 Z" fill="#c38b55" />

                {/* Left outer box flap open */}
                <path d="M15 45 L50 30 L35 20 L5 32 Z" fill="#d29a63" />

                {/* Right outer box flap open */}
                <path d="M50 30 L85 45 L95 32 L65 20 Z" fill="#d29a63" />

                {/* Cardboard box base - front left panel */}
                <path d="M15 45 L50 60 L50 78 L15 62 Z" fill="#b17b46" />

                {/* Cardboard box base - front right panel */}
                <path d="M50 60 L85 45 L85 62 L50 78 Z" fill="#9e6c3a" />

                {/* Front box flap open downward */}
                <path d="M15 45 L50 60 L50 67 L15 52 Z" fill="#c38b55" opacity="0.95" />
              </svg>
            </div>

            {/* Empty text descriptors */}
            <div className="flex flex-col gap-1.5">
              <h4 className="text-sm sm:text-base font-black text-white">
                No study history yet
              </h4>
              <p className="text-[10px] sm:text-xs text-text-muted max-w-[260px] leading-relaxed">
                Upload documents, take quizzes, generate summaries or chat with AI to see your activity here.
              </p>
            </div>

            {/* Gold Action Button */}
            <button
              onClick={() => router.push("/dashboard/upload")}
              className="py-3 px-5 bg-[#f3c494] hover:bg-[#e0a96d] text-[#3e230d] font-bold rounded-full text-xs flex items-center justify-center gap-1.5 transition shadow shadow-[#f3c494]/10 cursor-pointer select-none focus:outline-none"
            >
              <Plus className="h-4 w-4 stroke-[3px]" />
              Upload Your First Document
            </button>
          </div>

        </section>

      </div>
    </div>
  );
}
