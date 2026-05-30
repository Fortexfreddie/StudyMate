"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Bell, Sparkles, FileText, Send, MessageSquare } from "lucide-react";
import { DashboardNav } from "../components/DashboardNav";

const DOCUMENT_METADATA: Record<string, { title: string; pages: string; date: string; bgColor: string; textColor: string }> = {
  "data-structures": {
    title: "Data Structures and Algorithms.pdf",
    pages: "156 Pages",
    date: "May 20, 2024",
    bgColor: "#f3c494",
    textColor: "#3e230d",
  },
  "human-anatomy": {
    title: "Human Anatomy Essentials.pdf",
    pages: "212 Pages",
    date: "May 22, 2024",
    bgColor: "#e6a19f",
    textColor: "#47201f",
  },
  "neural-networks": {
    title: "Introduction to Neural Networks.pdf",
    pages: "98 Pages",
    date: "May 25, 2024",
    bgColor: "#b2d0d6",
    textColor: "#223f45",
  },
  "organic-chemistry": {
    title: "Organic Chemistry Nomenclature.pdf",
    pages: "144 Pages",
    date: "May 28, 2024",
    bgColor: "#d6b2d1",
    textColor: "#452240",
  },
};

interface MessageItem {
  id: number;
  sender: "ai" | "user";
  text: string;
  time: string;
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("doc") || "data-structures";
  const doc = DOCUMENT_METADATA[docId] || DOCUMENT_METADATA["data-structures"];

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 1,
      sender: "ai",
      text: "Hello! I'm your AI study assistant. Ask me anything about this document and I'll help you understand it better.",
      time: "10:30 AM",
    },
    {
      id: 2,
      sender: "user",
      text: "What is the main objective of this project?",
      time: "10:31 AM",
    },
    {
      id: 3,
      sender: "ai",
      text: "The main objective of this project is to develop a predictive model for Alzheimer's Disease using Deep Learning techniques, specifically Convolutional Neural Networks (CNN). The model aims to assist early diagnosis and improve prediction accuracy.",
      time: "10:31 AM",
    },
    {
      id: 4,
      sender: "user",
      text: "What datasets were used in the study?",
      time: "10:32 AM",
    },
    {
      id: 5,
      sender: "ai",
      text: "The study used the Alzheimer's Disease Neuroimaging Initiative (ADNI) dataset, which includes MRI images and corresponding clinical information of subjects classified as AD, MCI, or cognitively normal.",
      time: "10:32 AM",
    },
    {
      id: 6,
      sender: "user",
      text: "What was the best performing model?",
      time: "10:33 AM",
    },
    {
      id: 7,
      sender: "ai",
      text: "The CNN model achieved the best performance with an accuracy of 94.6%, precision of 93.1%, and recall of 95.2%.",
      time: "10:33 AM",
    },
  ]);

  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the message container whenever new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: MessageItem = {
      id: Date.now(),
      sender: "user",
      text: inputText,
      time: currentTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    // AI Simulated Auto-response after 1.2s delay
    setTimeout(() => {
      setIsTyping(false);
      const aiResponse: MessageItem = {
        id: Date.now() + 1,
        sender: "ai",
        text: `Based on your uploaded study guide, that is a core conceptual milestone! Let's review the corresponding definitions and verify lookups inside the PDF details panel!`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-bg-main text-white flex flex-col md:flex-row pb-28 md:pb-0">
      
      {/* Sidebar Navigation */}
      <DashboardNav />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-[580px] mx-auto w-full h-screen justify-between p-4 sm:p-6 md:p-8">
        
        {/* Navigation bar Header */}
        <header className="flex items-center justify-between w-full pb-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => router.push(`/dashboard/document/${docId}`)}
              className="flex items-center justify-center h-10 w-10 rounded-full bg-card-bg border border-border-subtle hover:bg-white/5 hover:border-white/20 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4.5 w-4.5 text-white" />
            </button>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className="h-4.5 w-4.5 text-text-muted shrink-0" />
              <h1 className="text-xs sm:text-sm font-bold text-white truncate pr-2">
                {doc.title}
              </h1>
            </div>
          </div>

          <button className="relative flex items-center justify-center h-10 w-10 rounded-full bg-card-bg border border-border-subtle hover:bg-white/5 hover:border-white/20 transition shrink-0">
            <Bell className="h-4.5 w-4.5 text-white" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-brand-primary" />
          </button>
        </header>

        {/* Scrollable message logs viewport */}
        <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-5 px-1 scrollbar-none">
          {/* Time separator badge */}
          <div className="flex justify-center w-full my-2">
            <span className="text-[10px] sm:text-xs font-semibold text-text-muted bg-[#181818] border border-border-subtle px-3 py-1 rounded-full">
              Today
            </span>
          </div>

          {/* Messages list */}
          {messages.map((msg) => {
            const isAI = msg.sender === "ai";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  isAI ? "self-start items-start" : "self-end items-end flex-row-reverse"
                } animate-in fade-in duration-250`}
              >
                {/* AI Sparkle badge */}
                {isAI && (
                  <div className="h-7 w-7 rounded-full bg-brand-primary flex items-center justify-center text-[#3e230d] shrink-0 mt-0.5 shadow">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                {/* Message text block */}
                <div className="flex flex-col gap-1.5">
                  <div
                    className={`p-3.5 px-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                      isAI
                        ? "bg-[#181818] border border-border-subtle text-white rounded-tl-sm"
                        : "bg-brand-primary text-[#3e230d] font-bold rounded-tr-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  
                  {/* Timestamp & Double checkmark footer */}
                  <div
                    className={`flex items-center gap-1 text-[10px] text-text-muted ${
                      isAI ? "justify-start pl-1" : "justify-end pr-1"
                    }`}
                  >
                    <span>{msg.time}</span>
                    {!isAI && (
                      <span className="flex items-center text-brand-primary font-bold">
                        {/* Custom Double Checkmark SVG matching screenshot */}
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17l-4.24-4.24-1.41 1.41 5.66 5.66L23.66 7l-1.42-1.41zM5.24 11.93L4.66 11.35l-1.41 1.41 3 3 1.41-1.41-2.42-2.42z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 items-center self-start max-w-[80%] pl-1">
              <div className="h-7 w-7 rounded-full bg-brand-primary flex items-center justify-center text-[#3e230d] shrink-0 shadow animate-pulse">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="bg-[#181818] border border-border-subtle rounded-2xl px-4 py-3 text-xs text-text-muted flex items-center gap-1 shadow-sm">
                <span className="font-semibold">AI is searching</span>
                <span className="flex gap-0.5 ml-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ef6868] animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ef6868] animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ef6868] animate-bounce" />
                </span>
              </div>
            </div>
          )}

          {/* Anchor div for auto-scrolling */}
          <div ref={chatEndRef} />
        </div>

        {/* Input area Form exactly styled like screenshot */}
        <form onSubmit={handleSendMessage} className="w-full shrink-0 pt-2">
          <div className="w-full bg-[#181818] border border-border-subtle rounded-full p-2 pl-4 flex items-center gap-3 shadow-md">
            
            {/* Left orange circle chat icon badge */}
            <div className="h-7 w-7 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 select-none">
              <MessageSquare className="h-3.5 w-3.5 fill-current" />
            </div>

            {/* Input Element */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything about your document"
              className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-white placeholder:text-text-muted h-9 focus:ring-0 focus:outline-none"
            />

            {/* Send circular button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition shrink-0 select-none cursor-pointer ${
                inputText.trim()
                  ? "bg-brand-primary text-[#3e230d] hover:bg-brand-primary-hover shadow"
                  : "bg-white/5 text-text-muted cursor-not-allowed"
              }`}
            >
              <Send className="h-3.5 w-3.5 fill-current" />
            </button>
          </div>
        </form>

      </div>
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
