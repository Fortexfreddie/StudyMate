"use client";

import { useState } from "react";
import { Trophy, Activity, Coins, Flame } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { formatCompact, formatNumber } from "../admin/components/adminHelpers";
import { AchievementBadges } from "../admin/components/AchievementBadges";

const METRICS = [
  { value: "activity", label: "Activity", icon: Activity },
  { value: "tokens", label: "Tokens", icon: Coins },
  { value: "streak", label: "Streak", icon: Flame },
] as const;

export default function LeaderboardPage() {
  const [metric, setMetric] = useState<string>("activity");

  const { data, isLoading, error, refetch } = useApi(
    () => api.leaderboard.get(metric),
    [metric]
  );

  const getMetricDisplay = (val: number, currentMetric: string) => {
    if (currentMetric === "tokens") {
      return `${formatCompact(val)} tokens`;
    }
    if (currentMetric === "streak") {
      return `${formatNumber(val)} days`;
    }
    return `${formatNumber(val)} actions`;
  };

  const getPodiumClass = (rank: number) => {
    if (rank === 1) return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
    if (rank === 2) return "bg-slate-400/10 border-slate-400/30 text-slate-300";
    if (rank === 3) return "bg-amber-600/10 border-amber-600/30 text-amber-500";
    return "bg-surface-raised border-border-subtle text-text-muted";
  };

  const isMeInList = data?.entries.some((e) => e.user_id === data.me?.user_id) ?? false;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
      <header className="mb-6">
        <h2 className="text-xl sm:text-2xl text-white font-extrabold leading-tight flex items-center gap-2">
          <Trophy className="h-6 w-6 text-brand-primary" />
          Leaderboard
        </h2>
        <p className="text-xs text-text-muted mt-1">
          See how you stack up against other students on StudyMate.
        </p>
      </header>

      {/* Metric Selector Tabs */}
      <div className="flex gap-2 mb-6">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const active = metric === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center gap-1.5 cursor-pointer border select-none ${
                active
                  ? "bg-brand-primary text-brand-primary-fg border-brand-primary/20 shadow-lg shadow-brand-primary/10"
                  : "bg-card-bg text-text-muted border-border-subtle hover:text-white hover:border-white/10"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {m.label}
            </button>
          );
        })}
      </div>

      {isLoading && <LoadingState className="py-24" label="Loading leaderboard..." />}

      {error && (
        <ErrorState
          className="py-24"
          title="Failed to load leaderboard"
          message={error}
          onRetry={refetch}
        />
      )}

      {data && !isLoading && !error && (
        <>
          {data.entries.length === 0 ? (
            <div className="bg-card-bg border border-border-subtle rounded-3xl p-12 text-center shadow-lg">
              <span className="h-12 w-12 rounded-2xl bg-surface-raised border border-border-subtle flex items-center justify-center text-text-muted mx-auto mb-4">
                <Trophy className="h-6 w-6" />
              </span>
              <p className="text-sm font-bold text-white">No leaderboard entries found</p>
              <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
                Start studying, generating summaries, taking quizzes or chat with your document to claim a spot on the leaderboard!
              </p>
            </div>
          ) : (
            <div className="bg-card-bg border border-border-subtle rounded-3xl overflow-hidden shadow-xl shadow-black/20 divide-y divide-border-subtle flex flex-col">
              {/* Entries list */}
              <div className="divide-y divide-border-subtle flex flex-col">
                {data.entries.map((entry) => {
                  const isMe = entry.user_id === data.me?.user_id;
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-colors ${
                        isMe
                          ? "bg-brand-primary/[0.03] border-y border-brand-primary/10 hover:bg-brand-primary/[0.05]"
                          : "hover:bg-white/[0.015]"
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Rank Indicator */}
                        <span
                          className={`h-8 w-8 rounded-xl border flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${getPodiumClass(
                            entry.rank
                          )}`}
                        >
                          {entry.rank}
                        </span>

                        {/* User Profile Info */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-extrabold text-white truncate">
                            {entry.full_name}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-black text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                              You
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Value, Badges and Secondary Stats */}
                      <div className="flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                        {/* Achievement Badges */}
                        <div className="shrink-0">
                          <AchievementBadges badges={entry.badges} />
                        </div>

                        {/* Streak & Token Secondary Indicators */}
                        <div className="flex items-center gap-2">
                          {metric !== "streak" && entry.streak > 0 && (
                            <span className="text-[10px] font-black text-accent-coral bg-accent-coral/5 border border-accent-coral/10 px-2 py-0.5 rounded-md shrink-0">
                              🔥 {entry.streak}d
                            </span>
                          )}
                          {metric !== "tokens" && entry.total_tokens > 0 && (
                            <span className="text-[10px] font-black text-brand-primary bg-brand-primary/5 border border-brand-primary/10 px-2 py-0.5 rounded-md shrink-0">
                              {formatCompact(entry.total_tokens)} tkn
                            </span>
                          )}

                          {/* Main Metric Value */}
                          <span className="text-xs font-black text-white bg-white/5 border border-border-subtle px-3 py-1.5 rounded-xl shrink-0">
                            {getMetricDisplay(entry.value, metric)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pin Caller (me) Row if not in the top list */}
              {!isMeInList && data.me && (
                <div className="border-t-2 border-dashed border-border-subtle bg-brand-primary/[0.04] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Rank Indicator */}
                    <span
                      className={`h-8 w-8 rounded-xl border flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${getPodiumClass(
                        data.me.rank
                      )}`}
                    >
                      {data.me.rank}
                    </span>

                    {/* User Profile Info */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-extrabold text-white truncate">
                        {data.me.full_name}
                      </span>
                      <span className="text-[9px] font-black text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                        You
                      </span>
                    </div>
                  </div>

                  {/* Value, Badges and Secondary Stats */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                    {/* Achievement Badges */}
                    <div className="shrink-0">
                      <AchievementBadges badges={data.me.badges} />
                    </div>

                    {/* Streak & Token Secondary Indicators */}
                    <div className="flex items-center gap-2">
                      {metric !== "streak" && data.me.streak > 0 && (
                        <span className="text-[10px] font-black text-accent-coral bg-accent-coral/5 border border-accent-coral/10 px-2 py-0.5 rounded-md shrink-0">
                          🔥 {data.me.streak}d
                        </span>
                      )}
                      {metric !== "tokens" && data.me.total_tokens > 0 && (
                        <span className="text-[10px] font-black text-brand-primary bg-brand-primary/5 border border-brand-primary/10 px-2 py-0.5 rounded-md shrink-0">
                          {formatCompact(data.me.total_tokens)} tkn
                        </span>
                      )}

                      {/* Main Metric Value */}
                      <span className="text-xs font-black text-white bg-white/5 border border-border-subtle px-3 py-1.5 rounded-xl shrink-0">
                        {getMetricDisplay(data.me.value, metric)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
