import type { Metadata } from "next";
import Link from "next/link";
import { Upload, FileText, HelpCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { OnboardingIllustration } from "./components/OnboardingIllustration";

export const metadata: Metadata = {
  title: "StudyMate — Your AI Study Companion",
  description:
    "Upload your lecture PDFs and get AI-powered chat, summaries, and quizzes grounded in your own notes.",
};

export default function LandingPage() {
  const FEATURES = [
    {
      icon: <Upload className="h-4.5 w-4.5" />,
      title: "Upload Lecture Notes",
      description: "Upload your PDFs and documents",
    },
    {
      icon: <FileText className="h-4.5 w-4.5" />,
      title: "Generate Summaries",
      description: "Get AI-powered summaries in seconds",
    },
    {
      icon: <HelpCircle className="h-4.5 w-4.5" />,
      title: "Practice Quizzes",
      description: "Test your knowledge and improve retention",
    },
    {
      icon: <MessageSquare className="h-4.5 w-4.5" />,
      title: "Ask Questions",
      description: "Chat with AI about your documents",
    },
  ];

  return (
    <main className="flex min-h-screen bg-bg-main flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-[420px] flex flex-col items-center animate-in fade-in slide-in-from-bottom-3 duration-500">
        
        {/* Customized SVG Illustration */}
        <div className="w-full flex justify-center mb-2 transition-transform duration-300 hover:scale-105">
          <OnboardingIllustration />
        </div>

        {/* Header Typography */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2.5">
            Study Smarter <br />
            with <span className="text-brand-primary">AI</span>
          </h1>
          <p className="text-sm text-text-muted px-4 leading-relaxed max-w-[340px] mx-auto">
            Your AI study companion that helps you learn faster, understand better, and achieve more.
          </p>
        </div>

        {/* Feature List Container Card */}
        <div className="w-full rounded-3xl bg-card-bg border border-border-subtle p-5 flex flex-col gap-5 shadow-2xl shadow-black/60">
          {FEATURES.map((feat, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0 transition-all duration-200 hover:scale-105">
                {feat.icon}
              </div>
              <div className="flex flex-col pt-0.5">
                <span className="text-sm font-bold text-white tracking-wide">
                  {feat.title}
                </span>
                <span className="text-xs text-text-muted mt-0.5 leading-normal">
                  {feat.description}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Actions (CTA) */}
        <div className="flex flex-col gap-3.5 w-full mt-6">
          <Link href="/signup" passHref className="w-full">
            <Button
              id="btn-get-started"
              variant="primary"
              className="py-4 shadow-lg shadow-brand-primary/10 cursor-pointer"
            >
              Get Started
            </Button>
          </Link>
          <Link href="/login" passHref className="w-full">
            <Button
              id="btn-login"
              variant="outline"
              className="py-4 border-brand-primary/20 text-white hover:border-brand-primary/40 hover:bg-brand-primary/5 cursor-pointer"
            >
              Login
            </Button>
          </Link>
        </div>

        {/* Footnote Message */}
        <p className="mt-8 text-[11px] text-text-muted text-center tracking-normal leading-normal">
          Join thousands of students learning smarter every day.
        </p>
      </div>
    </main>
  );
}

