"use client";

export interface BadgeMeta {
  label: string;
  emoji: string;
  color: string;
}

export const BADGE_MAP: Record<string, BadgeMeta> = {
  // Streaks
  streak_3: { label: "3-Day Streak", emoji: "🔥", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  streak_7: { label: "Week Warrior", emoji: "⚡", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  streak_30: { label: "Monthly Master", emoji: "🏆", color: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" },
  streak_100: { label: "Century Legend", emoji: "💎", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },

  // Summaries
  summaries_10: { label: "Summarizer", emoji: "📝", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  summaries_50: { label: "Summary Pro", emoji: "📚", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  summaries_100: { label: "Summary Master", emoji: "🎓", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },

  // Quizzes
  quizzes_10: { label: "Quiz Taker", emoji: "❓", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  quizzes_50: { label: "Quiz Pro", emoji: "🧠", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  quizzes_100: { label: "Quiz Legend", emoji: "👑", color: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" },

  // Documents
  documents_5: { label: "Uploader", emoji: "📁", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  documents_25: { label: "Library Builder", emoji: "🏗️", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  documents_100: { label: "Archive Master", emoji: "🗄️", color: "bg-red-500/10 text-red-400 border-red-500/20" },

  // Chats
  chats_25: { label: "Curious Mind", emoji: "💬", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  chats_100: { label: "Conversationalist", emoji: "🗣️", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  chats_500: { label: "Chat Legend", emoji: "🌟", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },

  // Quiz Ace
  quiz_ace: { label: "Quiz Ace", emoji: "🎯", color: "bg-red-500/10 text-red-400 border-red-500/25" },
};

interface AchievementBadgesProps {
  badges: string[];
}

export function AchievementBadges({ badges }: AchievementBadgesProps) {
  if (!badges || badges.length === 0) {
    return <span className="text-[10px] text-text-muted italic">No badges earned</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((key) => {
        const meta = BADGE_MAP[key];
        if (!meta) return null;
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-wider ${meta.color}`}
            title={meta.label}
          >
            <span>{meta.emoji}</span>
            <span>{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}
