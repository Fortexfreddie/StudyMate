import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const APP_NAME = "StudyMate";
const APP_DESCRIPTION =
  "Upload your PDF lecture notes and study smarter with AI — chat with your documents, generate grounded summaries in six formats, and create auto-graded quizzes. Powered by Retrieval-Augmented Generation, so answers come only from your own materials.";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "StudyMate — AI Study Companion & Quiz Generator",
    template: "%s | StudyMate",
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    "StudyMate",
    "AI study companion",
    "quiz generator",
    "RAG",
    "retrieval-augmented generation",
    "PDF chat",
    "lecture notes",
    "study tool",
    "flashcards",
    "AI summaries",
  ],
  authors: [{ name: "Ekwem Kamsiyochukwu Fredrick" }],
  creator: "Ekwem Kamsiyochukwu Fredrick",
  category: "education",
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: "StudyMate — AI Study Companion & Quiz Generator",
    description: APP_DESCRIPTION,
    url: APP_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyMate — AI Study Companion & Quiz Generator",
    description: APP_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sansFont.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
