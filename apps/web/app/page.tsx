import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "StudyMate — Your AI Study Companion",
  description:
    "Upload your lecture PDFs and get AI-powered chat, summaries, and quizzes grounded in your own notes.",
};

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">StudyMate</h1>
      <p className="text-lg mb-8 text-center max-w-md">
        Upload your lecture PDFs. Chat with your notes. Generate quizzes. Study
        smarter.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 rounded-lg border font-medium"
        >
          Log In
        </Link>
        <Link
          href="/signup"
          className="px-6 py-3 rounded-lg font-medium"
        >
          Sign Up
        </Link>
      </div>
    </main>
  );
}
