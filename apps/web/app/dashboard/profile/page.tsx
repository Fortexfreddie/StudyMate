"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  HelpCircle,
  Flame,
  Check,
  ChevronRight,
  User,
  Palette,
  Headphones,
  LogOut,
  TrendingUp,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Zap,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { api, ApiClientError, getPerformanceMode, setPerformanceMode } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import type { PerformanceMode, UsageResponse } from "@/lib/types";

type ScreenType = "main" | "edit" | "theme" | "help" | "performance";
type ThemeKey = "midnight" | "obsidian" | "sepia";

const THEME_STORAGE_KEY = "studymate_theme";

// The daily token window resets at a fixed 00:00 UTC; show the time until then.
function formatResetLabel(resetTime?: string): string {
  if (!resetTime) return "Resets daily";
  const diffMs = new Date(resetTime).getTime() - Date.now();
  if (diffMs <= 0) return "Resetting now";
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
  return `Resets in ${minutes}m`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const { data: stats } = useApi(() => api.stats.get(), []);

  const [activeScreen, setActiveScreen] = useState<ScreenType>("main");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [major, setMajor] = useState(user?.major ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>("midnight");
  const [selectedPerformanceMode, setSelectedPerformanceMode] = useState<PerformanceMode>("high");
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load initial settings and fetch usage data
  useEffect(() => {
    setFullName(user?.full_name ?? "");
    setMajor(user?.major ?? "");
  }, [user]);

  const fetchUsage = async () => {
    setUsageError(null);
    try {
      const u = await api.usage.get();
      setUsage(u);
    } catch (err) {
      setUsageError(
        err instanceof ApiClientError ? err.detail : "Failed to load token usage."
      );
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null;
    if (savedTheme) setSelectedTheme(savedTheme);

    const savedPerf = getPerformanceMode() as PerformanceMode;
    setSelectedPerformanceMode(savedPerf);

    fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen]); // Refresh usage when returning/switching screens

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleOptionClick = (label: string) => {
    if (label === "Logout") {
      logout();
      router.push("/login");
    } else if (label === "Edit Profile") setActiveScreen("edit");
    else if (label === "Theme Preference") setActiveScreen("theme");
    else if (label === "Performance Level") setActiveScreen("performance");
    else if (label === "Help & Support") setActiveScreen("help");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await api.auth.updateProfile({
        full_name: fullName.trim(),
        major: major.trim(),
      });
      updateUser(updated);
      showToast("Profile updated successfully!");
      setActiveScreen("main");
    } catch (err) {
      setSaveError(
        err instanceof ApiClientError ? err.detail : "Failed to update profile."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyTheme = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    const labels: Record<ThemeKey, string> = {
      midnight: "Midnight Black",
      obsidian: "Deep Obsidian",
      sepia: "Warm Sepia",
    };
    showToast(`Applied ${labels[selectedTheme]} theme!`);
    setActiveScreen("main");
  };

  const handleApplyPerformance = (e: React.FormEvent) => {
    e.preventDefault();
    setPerformanceMode(selectedPerformanceMode);

    const labels: Record<PerformanceMode, string> = {
      low: "Low — Fastest speed, shorter answers, uses low resources ⚡",
      medium: "Medium — Balanced speed & quality, uses moderate resources ⚡⚡",
      high: "High — Best quality, detailed reasoning, uses standard resources ⚡⚡⚡",
      very_high: "Very High — High reasoning depth, comprehensive analysis 🧠⚡⚡⚡",
      max: "Max — Full power, deepest logical reasoning, maximum resources 🧠🧠⚡⚡⚡",
    };

    showToast(`Configured ${labels[selectedPerformanceMode]}!`);
    setActiveScreen("main");
  };

  const initials =
    (user?.full_name ?? "")
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="flex-1 flex flex-col max-w-[820px] mx-auto w-full p-4 sm:p-6 md:py-8 justify-start gap-5 relative">
      {toastMessage && (
        <div role="status" aria-live="polite" className="absolute top-6 left-1/2 -translate-x-1/2 bg-surface border border-accent-gold/30 px-4 py-2.5 rounded-full flex items-center gap-2 z-50 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="h-4 w-4 text-accent-gold" />
          <span className="text-[11px] sm:text-xs font-black text-white">{toastMessage}</span>
        </div>
      )}

      {/* MAIN */}
      {activeScreen === "main" && (
        <>
          {/* Avatar + name */}
          <section className="flex flex-col items-center text-center gap-3 mt-1.5 select-none">
            <div className="h-[96px] w-[96px] rounded-full p-[3px] bg-gradient-to-tr from-accent-gold/30 via-accent-gold/90 to-accent-gold/20 shadow-avatar-gold flex items-center justify-center">
              <div className="h-full w-full rounded-full overflow-hidden bg-surface-raised border border-black/80 flex items-center justify-center text-accent-gold text-2xl font-black">
                {initials}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <h2 className="text-lg font-black text-white tracking-wide">{user?.full_name}</h2>
              <span className="text-xs text-text-muted font-medium">{user?.email}</span>
              {user?.major && (
                <span className="text-[11px] text-accent-gold font-bold mt-0.5">{user.major}</span>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <div className="flex flex-col gap-5">
              {/* Stats — real */}
              <section className="w-full bg-surface border border-white/5 rounded-3xl p-5 flex flex-col gap-4 shadow-md shadow-black/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-extrabold text-white">Study Statistics</h3>
                  <div className="h-7 w-7 rounded-lg bg-surface-raised flex items-center justify-center text-accent-gold">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1 text-center items-stretch">
                  {[
                    { icon: FileText, value: stats?.documents_uploaded ?? 0, label: "Documents Uploaded" },
                    { icon: HelpCircle, value: stats?.quizzes_taken ?? 0, label: "Quizzes Taken" },
                    { icon: FileText, value: stats?.summaries_generated ?? 0, label: "Summaries Generated" },
                  ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <div key={i} className="flex flex-col items-center justify-between py-1">
                        <div className="h-9 w-9 rounded-full bg-accent-gold/10 flex items-center justify-center text-accent-gold">
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <span className="text-lg font-black text-accent-gold mt-2.5 leading-none">{stat.value}</span>
                        <span className="text-[9px] font-bold text-text-muted mt-2 leading-tight max-w-[72px]">{stat.label}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Streak — real */}
              <section className="w-full bg-surface border border-white/5 rounded-3xl p-5 flex items-center justify-between shadow-md shadow-black/20">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full border-2 border-accent-gold bg-accent-gold/10 flex items-center justify-center text-accent-gold">
                    <Flame className="h-6 w-6 fill-current" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-xs sm:text-sm font-extrabold text-white leading-none">Study Streak</h4>
                    <p className="text-[10px] sm:text-xs text-text-muted leading-none">
                      {stats?.current_streak ? "Keep it going!" : "Study today to start one."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end leading-none">
                  <span className="text-xl font-black text-accent-gold">{stats?.current_streak ?? 0}</span>
                  <span className="text-[9px] font-bold text-accent-gold mt-1 uppercase tracking-wider">Days</span>
                </div>
              </section>

              {/* Token Usage Card */}
              <section className="w-full bg-surface border border-white/5 rounded-3xl p-5 flex flex-col gap-3.5 shadow-md shadow-black/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-extrabold text-white inline-flex items-center gap-1.5">
                      Daily Token Usage
                      <InfoTooltip label="What are tokens?">
                        Tokens are small pieces of text the AI processes (roughly ¾ of a word each).
                        Every chat, summary, and quiz uses some. Your plan has a daily limit that
                        resets at midnight UTC; lower performance levels use fewer.
                      </InfoTooltip>
                    </h4>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      usage?.is_pro
                        ? "bg-accent-gold/10 border-accent-gold text-accent-gold"
                        : "bg-white/5 border-white/10 text-text-muted"
                    }`}>
                      {usage?.is_pro ? "Pro Plan" : "Free Plan"}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-accent-gold shrink-0">
                    {formatResetLabel(usage?.reset_time)}
                  </span>
                </div>

                {usage ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <span className="text-lg font-black text-white leading-none">
                        {usage.tokens_used_today.toLocaleString()}
                        <span className="text-xs font-bold text-text-muted"> / {usage.token_limit.toLocaleString()}</span>
                      </span>
                      <span className="text-[10px] font-black text-text-muted">
                        {usage.tokens_remaining.toLocaleString()} left
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-surface-raised border border-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          usage.tokens_used_today >= usage.token_limit
                            ? "bg-accent-coral"
                            : usage.tokens_used_today >= usage.token_limit * 0.8
                            ? "bg-status-warning"
                            : "bg-accent-gold"
                        }`}
                        style={{ width: `${Math.min(100, (usage.tokens_used_today / usage.token_limit) * 100)}%` }}
                      />
                    </div>

                    <p className="text-[9px] font-bold text-text-muted leading-tight mt-1 flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 text-text-muted shrink-0 mt-0.5" />
                      <span>
                        Lower performance levels consume significantly fewer tokens and allow more requests per day.
                      </span>
                    </p>
                  </div>
                ) : usageError ? (
                  <div className="flex items-center justify-between gap-2 py-3">
                    <span className="text-[11px] text-error-text font-semibold">{usageError}</span>
                    <button
                      onClick={fetchUsage}
                      className="text-[11px] font-bold text-accent-gold hover:underline shrink-0 cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 text-accent-gold animate-spin" />
                  </div>
                )}
              </section>
            </div>

            {/* Menu */}
            <section className="w-full bg-surface border border-white/5 rounded-3xl p-2.5 flex flex-col gap-0.5 shadow-md shadow-black/20">
              {[
                { label: "Edit Profile", icon: User },
                { label: "Theme Preference", icon: Palette },
                { label: "Performance Level", icon: Zap },
                { label: "Help & Support", icon: Headphones },
                { label: "Logout", icon: LogOut },
              ].map((item, idx, arr) => {
                const Icon = item.icon;
                const isLogout = item.label === "Logout";
                return (
                  <div key={item.label} className="w-full">
                    <button
                      onClick={() => handleOptionClick(item.label)}
                      className="w-full flex items-center justify-between py-3.5 px-3 rounded-2xl hover:bg-white/5 transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isLogout ? "bg-accent-coral/15 text-accent-coral" : "bg-accent-gold/10 text-accent-gold"}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <span className={`text-xs sm:text-sm font-extrabold ${isLogout ? "text-accent-coral" : "text-white"}`}>
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className={`h-4.5 w-4.5 shrink-0 ${isLogout ? "text-accent-coral/60" : "text-text-muted"}`} />
                    </button>
                    {idx < arr.length - 1 && <div className="h-[1px] w-[92%] mx-auto bg-white/5" />}
                  </div>
                );
              })}
            </section>
          </div>
        </>
      )}

      {/* EDIT PROFILE — real PATCH /auth/me */}
      {activeScreen === "edit" && (
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-5.5 w-full max-w-[520px] mx-auto animate-in fade-in duration-200">
          <header className="flex items-center gap-3 w-full pb-3 border-b border-white/5">
            <button type="button" onClick={() => setActiveScreen("main")} className="flex items-center justify-center h-10 w-10 rounded-full bg-surface border border-white/5 hover:bg-white/5 transition cursor-pointer">
              <ArrowLeft className="h-4.5 w-4.5 text-white" />
            </button>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">Edit Profile</h1>
          </header>

          {saveError && (
            <div className="bg-error-text/10 border border-error-text/20 text-error-text text-xs font-semibold rounded-xl p-3">
              {saveError}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-wider px-1">Full Name</label>
              <div className="w-full bg-surface border border-white/5 rounded-2xl p-3 px-4">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-white font-extrabold focus:ring-0"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-wider px-1">Email Address</label>
              <div className="w-full bg-surface/50 border border-white/5 rounded-2xl p-3 px-4 opacity-85">
                <input
                  type="email"
                  value={user?.email ?? ""}
                  className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-text-muted font-bold cursor-not-allowed"
                  disabled
                />
              </div>
              <span className="text-[10px] text-text-muted px-1">Email cannot be changed.</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-wider px-1">Study Major / Institution</label>
              <div className="w-full bg-surface border border-white/5 rounded-2xl p-3 px-4">
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-white font-extrabold focus:ring-0 placeholder:text-text-muted/50 placeholder:font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mt-5">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-accent-gold hover:bg-accent-gold-hover text-accent-gold-fg font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow cursor-pointer disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving ? "Saving…" : "Save Profile Changes"}
            </button>
            <button type="button" onClick={() => setActiveScreen("main")} className="w-full py-4 bg-transparent hover:bg-white/5 border border-white/10 text-white font-bold rounded-2xl text-xs sm:text-sm transition cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* THEME — localStorage only */}
      {activeScreen === "theme" && (
        <form onSubmit={handleApplyTheme} className="flex flex-col gap-5.5 w-full max-w-[520px] mx-auto animate-in fade-in duration-200">
          <header className="flex items-center gap-3 w-full pb-3 border-b border-white/5">
            <button type="button" onClick={() => setActiveScreen("main")} className="flex items-center justify-center h-10 w-10 rounded-full bg-surface border border-white/5 hover:bg-white/5 transition cursor-pointer">
              <ArrowLeft className="h-4.5 w-4.5 text-white" />
            </button>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">Theme Preference</h1>
          </header>

          <div className="grid grid-cols-1 gap-3.5 w-full">
            {([
              { key: "midnight", title: "Midnight Black", desc: "Pitch black palette, gold accenting", swatch: "bg-bg-main border-accent-gold/30" },
              { key: "obsidian", title: "Obsidian Charcoal", desc: "Dark grey palette, gold elements", swatch: "bg-surface-raised border-white/10" },
              { key: "sepia", title: "Warm Sepia", desc: "Cozy warm aesthetics, orange-gold", swatch: "bg-[#1d1916] border-accent-gold/20" },
            ] as const).map((theme) => (
              <div
                key={theme.key}
                onClick={() => setSelectedTheme(theme.key)}
                className={`bg-surface rounded-3xl p-4.5 flex items-center justify-between border cursor-pointer select-none transition ${
                  selectedTheme === theme.key ? "border-accent-gold shadow-card-selected" : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`h-7 w-7 rounded-full border shrink-0 ${theme.swatch}`} />
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-extrabold text-white">{theme.title}</span>
                    <span className="text-[10px] text-text-muted">{theme.desc}</span>
                  </div>
                </div>
                {selectedTheme === theme.key && <Check className="h-4 w-4 text-accent-gold stroke-[3px]" />}
              </div>
            ))}
          </div>

          <span className="text-[10px] text-text-muted px-1 -mt-2">
            Theme preference is saved on this device.
          </span>

          <button type="submit" className="w-full py-4 bg-accent-gold hover:bg-accent-gold-hover text-accent-gold-fg font-bold rounded-2xl text-xs sm:text-sm transition shadow cursor-pointer">
            Apply Theme
          </button>
        </form>
      )}

      {/* PERFORMANCE — dynamic localStorage settings */}
      {activeScreen === "performance" && (
        <form onSubmit={handleApplyPerformance} className="flex flex-col gap-5.5 w-full max-w-[520px] mx-auto animate-in fade-in duration-200">
          <header className="flex items-center gap-3 w-full pb-3 border-b border-white/5">
            <button type="button" onClick={() => setActiveScreen("main")} className="flex items-center justify-center h-10 w-10 rounded-full bg-surface border border-white/5 hover:bg-white/5 transition cursor-pointer">
              <ArrowLeft className="h-4.5 w-4.5 text-white" />
            </button>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight inline-flex items-center gap-1.5">
              Performance Level
              <InfoTooltip label="What is Performance Level?">
                Sets how much reasoning the AI uses for chat, summaries, and quizzes. Higher levels
                give deeper, more thorough answers but are slower and use more of your daily token
                budget. It also raises the maximum Context Depth you can pick.
              </InfoTooltip>
            </h1>
          </header>

          <div className="grid grid-cols-1 gap-3.5 w-full">
            {([
              { key: "low", title: "Low Level", desc: "Fastest responses, shorter answers, uses low resources ⚡", badge: "Flash Lite" },
              { key: "medium", title: "Medium Level", desc: "Balanced speed & quality, uses moderate resources ⚡⚡", badge: "Flash" },
              { key: "high", title: "High Level (Default)", desc: "Best quality, detailed reasoning, uses standard resources ⚡⚡⚡", badge: "Pro" },
              { key: "very_high", title: "Very High Level", desc: "High reasoning depth, comprehensive analysis 🧠⚡⚡⚡", badge: "Pro + Deep Thinking" },
              { key: "max", title: "Max Level", desc: "Full power, deepest logical reasoning, maximum resources 🧠🧠⚡⚡⚡", badge: "Pro + Max Thinking" },
            ] as const).map((mode) => (
              <div
                key={mode.key}
                onClick={() => setSelectedPerformanceMode(mode.key)}
                className={`bg-surface rounded-3xl p-4.5 flex items-center justify-between border cursor-pointer select-none transition ${
                  selectedPerformanceMode === mode.key ? "border-accent-gold shadow-card-selected" : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`h-7 w-7 rounded-full bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center shrink-0`}>
                    <Zap className={`h-4 w-4 ${selectedPerformanceMode === mode.key ? "text-accent-gold" : "text-text-muted"}`} />
                  </div>
                  <div className="flex flex-col pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-extrabold text-white">{mode.title}</span>
                      <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-text-muted border border-white/5">
                        {mode.badge}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted mt-1 leading-tight">{mode.desc}</span>
                  </div>
                </div>
                {selectedPerformanceMode === mode.key && <Check className="h-4 w-4 text-accent-gold stroke-[3px]" />}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-text-muted px-1 -mt-2 leading-relaxed flex items-start gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" />
            <span>
              Higher levels provide more thorough and deeper academic responses using advanced reasoning, but consume significantly more daily tokens.
            </span>
          </p>

          <button type="submit" className="w-full py-4 bg-accent-gold hover:bg-accent-gold-hover text-accent-gold-fg font-bold rounded-2xl text-xs sm:text-sm transition shadow cursor-pointer">
            Apply Performance Settings
          </button>
        </form>
      )}

      {/* HELP — static FAQs */}
      {activeScreen === "help" && (
        <div className="flex flex-col gap-5.5 w-full max-w-[520px] mx-auto animate-in fade-in duration-200">
          <header className="flex items-center gap-3 w-full pb-3 border-b border-white/5">
            <button type="button" onClick={() => setActiveScreen("main")} className="flex items-center justify-center h-10 w-10 rounded-full bg-surface border border-white/5 hover:bg-white/5 transition cursor-pointer">
              <ArrowLeft className="h-4.5 w-4.5 text-white" />
            </button>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">Help & Support</h1>
          </header>

          <section className="flex flex-col gap-3 w-full">
            <h3 className="text-xs font-black text-accent-gold uppercase tracking-wider px-1">Frequently Asked Questions</h3>
            <div className="flex flex-col gap-2.5 mt-1.5">
              {[
                { q: "How do I upload a document?", a: "Go to the Upload tab, select or drag a PDF, then tap Upload & Process. We extract, chunk, embed, and index it automatically." },
                { q: "How are quizzes generated?", a: "Our AI reads the retrieved context from your document and writes multiple-choice questions grounded strictly in that text. You can request 5 to 30 questions." },
                { q: "What summary formats are available?", a: "Bullet Points, Key Concepts, Study Guide, Flashcards, Cheat Sheet, and Mind Map — each generated from your document's actual content." },
                { q: "Why does it sometimes say 'limited context'?", a: "The AI only answers from your uploaded document. If the document doesn't cover your question, it tells you honestly instead of guessing." },
              ].map((faq, idx) => {
                const isOpen = faqOpenIndex === idx;
                return (
                  <div key={idx} className="bg-surface border border-white/5 rounded-2xl overflow-hidden transition">
                    <button
                      type="button"
                      onClick={() => setFaqOpenIndex(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
                    >
                      <span className="text-xs sm:text-sm font-extrabold text-white leading-relaxed pr-2">{faq.q}</span>
                      <ChevronRight className={`h-4.5 w-4.5 text-text-muted shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90 text-accent-gold" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="p-4 pt-0 text-[11px] sm:text-xs text-text-muted leading-relaxed border-t border-white/5 bg-surface-raised/40 animate-in fade-in duration-200">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
