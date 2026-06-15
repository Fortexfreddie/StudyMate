"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Coins,
  MessageSquare,
  FileStack,
  GraduationCap,
  Clock,
  FileText,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { api, ApiClientError } from "@/lib/api";
import type {
  AdminUserActivityResponse,
  AdminUserProfileResponse,
  AdminUserUsageResponse,
} from "@/lib/types";
import { AdminTabs } from "../../components/AdminTabs";
import { RoleBadge, TierBadge } from "../../components/Badges";
import {
  formatCompact,
  formatJoined,
  formatNumber,
  formatShortDate,
  useChartPalette,
} from "../../components/adminHelpers";

const PAGE_SIZE = 20;
const TYPE_FILTERS = ["all", "chat", "summary", "quiz"] as const;
// Preset usage windows (days back from today, inclusive).
const RANGE_PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

// Local YYYY-MM-DD for `n` days ago (inclusive window start). Uses the browser's
// date; the backend buckets in UTC, which is close enough for an admin filter.
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const TYPE_META: Record<
  string,
  { label: string; icon: typeof MessageSquare; color: string }
> = {
  chat: { label: "Chat", icon: MessageSquare, color: "text-brand-primary" },
  summary: { label: "Summary", icon: FileStack, color: "text-accent-gold" },
  quiz: { label: "Quiz", icon: GraduationCap, color: "text-accent-coral" },
};

const tooltipStyle = {
  contentStyle: {
    background: "rgba(24, 24, 24, 0.85)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    fontSize: "11px",
    fontWeight: "700",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
    padding: "10px 14px",
  },
  labelStyle: { color: "var(--color-text-muted)", marginBottom: "4px" },
  itemStyle: { color: "#fff" },
};

const labelDate = (label: unknown): string => formatShortDate(String(label));

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;
  const palette = useChartPalette();

  const [rangeDays, setRangeDays] = useState<number>(30);

  // Profile panel (lifetime metadata)
  const [profile, setProfile] = useState<AdminUserProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Usage panel
  const [usage, setUsage] = useState<AdminUserUsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  // Activity panel
  const [typeFilter, setTypeFilter] =
    useState<(typeof TYPE_FILTERS)[number]>("all");
  const [page, setPage] = useState(0);
  const [activity, setActivity] = useState<AdminUserActivityResponse | null>(
    null
  );
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const res = await api.admin.userUsage(userId, {
        start: isoDaysAgo(rangeDays),
        end: todayIso(),
      });
      setUsage(res);
    } catch (err) {
      setUsageError(
        err instanceof ApiClientError ? err.detail : "Failed to load usage."
      );
    } finally {
      setUsageLoading(false);
    }
  }, [userId, rangeDays]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await api.admin.userActivity(userId, {
        action_type: typeFilter === "all" ? undefined : typeFilter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setActivity(res);
    } catch (err) {
      setActivityError(
        err instanceof ApiClientError ? err.detail : "Failed to load activity."
      );
    } finally {
      setActivityLoading(false);
    }
  }, [userId, typeFilter, page]);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    try {
      setProfile(await api.admin.userProfile(userId));
    } catch (err) {
      setProfileError(
        err instanceof ApiClientError ? err.detail : "Failed to load profile."
      );
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const totalPages = activity
    ? Math.max(1, Math.ceil(activity.total / PAGE_SIZE))
    : 1;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
      <header className="mb-6">
        <button
          onClick={() => router.push("/dashboard/admin/users")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-white transition mb-3 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to users
        </button>
        <h2 className="text-xl sm:text-2xl text-white font-extrabold leading-tight">
          {profile?.full_name ?? usage?.full_name ?? activity?.full_name ?? "User detail"}
        </h2>
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-xs text-text-muted">
            {profile?.email ?? usage?.email ?? activity?.email ?? ""}
          </p>
          {(profile ?? usage) && (
            <span className="flex items-center gap-1.5">
              <RoleBadge role={(profile ?? usage)!.role} />
              <TierBadge isPro={(profile ?? usage)!.is_pro} />
            </span>
          )}
        </div>
      </header>

      <AdminTabs />

      {profileError && (
        <ErrorState
          className="py-8"
          title="Couldn't load profile"
          message={profileError}
          onRetry={loadProfile}
        />
      )}

      {profile && (
        <div className="flex flex-col gap-4 mb-8">
          {profile.is_suspended && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-4 flex items-center gap-3 text-red-400 text-xs sm:text-sm font-bold animate-in slide-in-from-top-1 duration-200">
              <span className="h-8 w-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 text-red-400">
                ⚠️
              </span>
              <div className="flex-1">
                <p className="text-white font-extrabold">Account Suspended</p>
                <p className="text-[11px] text-text-muted mt-0.5 font-medium">
                  This account was suspended{profile.suspended_at ? ` on ${new Date(profile.suspended_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}. Access to the platform is blocked.
                </p>
              </div>
            </div>
          )}

          {/* Lifetime count tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <UsageTile icon={FileStack} label="Documents" value={formatNumber(profile.total_documents)} />
            <UsageTile icon={MessageSquare} label="Chats" value={formatNumber(profile.total_chats)} />
            <UsageTile icon={FileText} label="Summaries" value={formatNumber(profile.total_summaries)} />
            <UsageTile icon={GraduationCap} label="Quizzes" value={formatNumber(profile.total_quizzes)} />
          </div>

          {/* Account meta + breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card-bg border border-border-subtle rounded-3xl p-6 shadow-lg shadow-black/20 flex flex-col gap-2.5">
              <h4 className="text-[10px] font-black text-white uppercase tracking-wider mb-1">
                Account
              </h4>
              <MetaRow label="Status" value={
                profile.is_suspended ? (
                  <span className="text-red-400 font-extrabold">Suspended</span>
                ) : profile.is_online ? (
                  <span className="text-emerald-400 font-extrabold flex items-center gap-1.5 justify-end">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online now
                  </span>
                ) : (
                  <span className="text-text-muted font-bold">Offline</span>
                )
              } />
              <MetaRow label="Signed up" value={formatJoined(profile.created_at)} />
              <MetaRow
                label="Last active"
                value={profile.last_active ? formatShortDate(profile.last_active) : "Never"}
              />
              <MetaRow
                label="Current streak"
                value={`🔥 ${profile.current_streak} days`}
              />
              <MetaRow
                label="Last login"
                value={
                  profile.last_login_at
                    ? new Date(profile.last_login_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Not tracked yet"
                }
              />
              <MetaRow label="Major" value={profile.major || "—"} />
              <MetaRow
                label="Avg quiz score"
                value={profile.total_quizzes > 0 ? `${profile.average_quiz_score}%` : "—"}
              />
              <MetaRow label="Lifetime pages" value={formatNumber(profile.total_pages)} />
              <MetaRow label="Lifetime tokens" value={formatNumber(profile.lifetime_tokens)} />
            </div>

            <div className="bg-card-bg border border-border-subtle rounded-3xl p-6 shadow-lg shadow-black/20 flex flex-col gap-4">
              <BreakdownBlock title="Summary formats" data={profile.summary_formats} />
              <BreakdownBlock title="Performance modes" data={profile.performance_modes} />
            </div>
          </div>

          {/* Generation performance */}
          {(Object.keys(profile.avg_generation_ms).length > 0 ||
            profile.cached_tokens_total > 0) && (
            <div className="bg-card-bg border border-border-subtle rounded-3xl p-6 shadow-lg shadow-black/20 flex flex-col gap-3">
              <h4 className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                Generation performance
                <InfoTooltip label="About generation performance">
                  Average time the model took to generate each type of response and
                  the average number of document chunks fed as context. Cached tokens
                  are input tokens Gemini billed at the cheaper cached rate.
                </InfoTooltip>
              </h4>
              {(["chat", "summary", "quiz"] as const).map((t) => {
                const ms = profile.avg_generation_ms[t];
                const chunks = profile.avg_chunks_used[t];
                if (ms === undefined && chunks === undefined) return null;
                return (
                  <MetaRow
                    key={t}
                    label={`Avg ${t} generation`}
                    value={[
                      ms !== undefined ? `${(ms / 1000).toFixed(1)}s` : null,
                      chunks !== undefined ? `${chunks} chunks` : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  />
                );
              })}
              <MetaRow
                label="Cached tokens (lifetime)"
                value={formatNumber(profile.cached_tokens_total)}
              />
            </div>
          )}
        </div>
      )}

      {/* Usage window presets */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
          Token usage
          <InfoTooltip label="About token usage">
            Tokens this user consumed in the selected window, summed from the
            per-request usage log. Input + output across chat, summary, and quiz.
          </InfoTooltip>
        </h3>
        <div className="inline-flex items-center gap-1 bg-surface-raised/40 border border-border-subtle/50 rounded-xl p-1">
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                rangeDays === r.days
                  ? "bg-brand-primary text-brand-primary-fg shadow-sm"
                  : "text-text-muted hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {usageLoading && <LoadingState className="py-16" label="Loading usage..." />}
      {usageError && (
        <ErrorState
          className="py-16"
          title="Couldn't load usage"
          message={usageError}
          onRetry={loadUsage}
        />
      )}

      {usage && !usageLoading && !usageError && (
        <div className="flex flex-col gap-4 mb-8">
          {/* Token stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <UsageTile
              icon={Coins}
              label="Total tokens"
              value={formatCompact(usage.total_tokens)}
            />
            <UsageTile
              icon={Coins}
              label="Input tokens"
              value={formatCompact(usage.total_input_tokens)}
            />
            <UsageTile
              icon={Coins}
              label="Output tokens"
              value={formatCompact(usage.total_output_tokens)}
            />
            <UsageTile
              icon={Clock}
              label="Requests"
              value={formatNumber(usage.request_count)}
            />
            <UsageTile
              icon={FileText}
              label="Total pages"
              value={formatNumber(usage.total_pages)}
            />
            <UsageTile
              icon={FileStack}
              label="Documents"
              value={formatNumber(usage.document_count)}
            />
          </div>

          {/* Daily token chart */}
          <div className="bg-card-bg border border-border-subtle rounded-3xl p-6 shadow-lg shadow-black/20">
            <h4 className="text-[10px] font-black text-white uppercase tracking-wider mb-4">
              Tokens by type ({usage.start_date} → {usage.end_date})
            </h4>
            {usage.daily_tokens.length === 0 ? (
              <p className="text-xs text-text-muted py-10 text-center">
                No token usage in this window.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={usage.daily_tokens}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke={palette.grid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fill: palette.muted, fontSize: 10 }}
                    minTickGap={24}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatCompact}
                    tick={{ fill: palette.muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...tooltipStyle} labelFormatter={labelDate} />
                  <Bar dataKey="chat" name="Chat" stackId="t" fill={palette.primary} />
                  <Bar
                    dataKey="summary"
                    name="Summary"
                    stackId="t"
                    fill={palette.gold}
                  />
                  <Bar
                    dataKey="quiz"
                    name="Quiz"
                    stackId="t"
                    fill={palette.coral}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By model */}
          {Object.keys(usage.tokens_by_model).length > 0 && (
            <div className="bg-card-bg border border-border-subtle rounded-3xl p-6 shadow-lg shadow-black/20">
              <h4 className="text-[10px] font-black text-white uppercase tracking-wider mb-4">
                Tokens by model
              </h4>
              <div className="flex flex-col gap-2">
                {Object.entries(usage.tokens_by_model)
                  .sort(([, a], [, b]) => b - a)
                  .map(([model, total]) => (
                    <div
                      key={model}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.02] last:border-0"
                    >
                      <span className="text-white font-bold truncate pr-3">
                        {model}
                      </span>
                      <span className="text-accent-gold font-extrabold shrink-0 bg-accent-gold/5 border border-accent-gold/10 px-2 py-0.5 rounded-md text-[10px]">
                        {formatNumber(total)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit timeline */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
          Activity log
          <InfoTooltip label="About the activity log">
            A metadata-only audit trail: action type, time, document, and a short
            preview of the query/topic. Full questions and answers are never shown
            to protect the student&apos;s private study content.
          </InfoTooltip>
        </h3>
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTypeFilter(t);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold capitalize transition border cursor-pointer ${
                typeFilter === t
                  ? "bg-brand-primary text-brand-primary-fg border-brand-primary/20 shadow-sm"
                  : "bg-card-bg text-text-muted border-border-subtle hover:text-white hover:border-white/10"
              }`}
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
      </div>

      {activityLoading && (
        <LoadingState className="py-16" label="Loading activity..." />
      )}
      {activityError && (
        <ErrorState
          className="py-16"
          title="Couldn't load activity"
          message={activityError}
          onRetry={loadActivity}
        />
      )}

      {activity && !activityLoading && !activityError && (
        <>
          {activity.items.length === 0 ? (
            <div className="bg-card-bg border border-border-subtle rounded-3xl p-10 text-center">
              <p className="text-sm text-text-muted font-bold">
                No activity recorded.
              </p>
              <p className="text-xs text-text-muted/60 mt-1">
                This user hasn&apos;t performed any{" "}
                {typeFilter === "all" ? "" : `${typeFilter} `}actions yet.
              </p>
            </div>
          ) : (
            <div className="bg-card-bg border border-border-subtle rounded-3xl divide-y divide-border-subtle overflow-hidden shadow-lg shadow-black/20">
              {activity.items.map((item) => (
                <ActivityRow key={`${item.action_type}-${item.id}`} item={item} />
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <span className="text-xs text-text-muted">
              {activity.total} total
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-card-bg border border-border-subtle text-white text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition cursor-pointer"
              >
                Prev
              </button>
              <span className="text-xs text-text-muted font-bold">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl bg-card-bg border border-border-subtle text-white text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UsageTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-3 shadow-md">
      <span className="h-8.5 w-8.5 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center text-accent-gold">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-2xl font-black text-white leading-none tracking-tight">
          {value}
        </span>
        <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider mt-1">
          {label}
        </span>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-white/[0.02] last:border-0">
      <span className="text-text-muted font-medium">{label}</span>
      <span className="text-white font-bold text-right">{value}</span>
    </div>
  );
}

// A labelled "key → count" list (summary formats, performance modes). Renders a
// muted placeholder when the user has none yet.
function BreakdownBlock({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-[10px] font-black text-white uppercase tracking-wider">
        {title}
      </h4>
      {entries.length === 0 ? (
        <p className="text-[11px] text-text-muted/60">None yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([key, count]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted bg-white/5 border border-border-subtle px-2 py-1 rounded-lg capitalize"
            >
              {key.replace(/_/g, " ")}
              <span className="text-brand-primary font-black">{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  item,
}: {
  item: AdminUserActivityResponse["items"][number];
}) {
  const meta = TYPE_META[item.action_type] ?? TYPE_META.chat;
  const Icon = meta.icon;
  const when = new Date(item.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div className="flex items-start gap-3.5 p-4 sm:p-5 hover:bg-white/[0.015] transition-colors">
      <span
        className={`h-8 w-8 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-center shrink-0 ${meta.color}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex flex-col min-w-0 flex-1 gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-extrabold text-white">{meta.label}</span>
          {item.action_type === "quiz" &&
            item.score !== null &&
            item.total_questions !== null && (
              <span className="text-[10px] font-black text-accent-gold bg-accent-gold/5 border border-accent-gold/10 px-2 py-0.5 rounded-md">
                {item.score}/{item.total_questions}
              </span>
            )}
          {item.summary_format && (
            <span className="text-[9px] font-black text-accent-gold uppercase tracking-wider bg-accent-gold/5 border border-accent-gold/10 px-1.5 py-0.5 rounded-md">
              {item.summary_format.replace(/_/g, " ")}
            </span>
          )}
          {item.performance_mode && (
            <span className="text-[9px] font-black text-text-muted uppercase tracking-wider bg-white/5 border border-border-subtle px-1.5 py-0.5 rounded-md">
              {item.performance_mode.replace("_", " ")}
            </span>
          )}
        </div>
        {item.preview && (
          <p className="text-[11px] text-text-muted truncate">{item.preview}</p>
        )}
        {item.doc_filename && (
          <span className="inline-flex items-center gap-1 text-[10px] text-text-muted/70 mt-0.5">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.doc_filename}</span>
          </span>
        )}
      </div>
      <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0 mt-0.5">
        {when}
      </span>
    </div>
  );
}
