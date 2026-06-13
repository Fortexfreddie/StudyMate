"use client";

import {
  Users,
  ShieldCheck,
  FileText,
  Layers,
  MessageSquare,
  FileStack,
  GraduationCap,
  Coins,
  Activity,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import type { AdminOverview } from "@/lib/types";
import { AdminTabs } from "./components/AdminTabs";
import {
  formatCompact,
  formatNumber,
  formatShortDate,
  useChartPalette,
} from "./components/adminHelpers";

interface TileProps {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  info?: string;
}

function StatTile({ icon: Icon, label, value, hint, info }: TileProps) {
  return (
    <div className="bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-3 shadow-md hover:shadow-lg transition-all duration-200 hover:border-white/10 hover:scale-[1.01]">
      <div className="flex items-center justify-between">
        <span className="h-8.5 w-8.5 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center text-accent-gold">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="flex items-center gap-1.5">
          {hint && (
            <span className="text-[9px] font-black text-text-muted uppercase tracking-wider bg-white/5 border border-border-subtle px-2 py-0.5 rounded-md">
              {hint}
            </span>
          )}
          {info && (
            <InfoTooltip label={`About ${label}`}>
              {info}
            </InfoTooltip>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-2xl font-black text-white leading-none tracking-tight">
          {value}
        </span>
        <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider mt-1">{label}</span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card-bg border border-border-subtle rounded-3xl p-6 flex flex-col gap-5 shadow-lg shadow-black/20 hover:border-white/10 transition-all duration-200">
      <h3 className="text-[10px] font-black text-white uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

// Recharts' labelFormatter is typed against ReactNode; coerce to string for our
// date formatter without fighting the generic signature.
const labelDate = (label: unknown): string => formatShortDate(String(label));

// Recharts tooltip styled to match the app surfaces.
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

export default function AdminOverviewPage() {
  const { data, isLoading, error, refetch } = useApi<AdminOverview>(
    () => api.admin.overview(),
    []
  );
  const palette = useChartPalette();

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
      <header className="mb-6">
        <h2 className="text-xl sm:text-2xl text-white font-extrabold leading-tight">
          Admin
        </h2>
        <p className="text-xs text-text-muted mt-1">
          System overview and live usage metrics.
        </p>
      </header>

      <AdminTabs />

      {isLoading && <LoadingState className="py-24" label="Loading metrics..." />}

      {error && (
        <ErrorState
          className="py-24"
          title="Couldn't load metrics"
          message={error}
          onRetry={refetch}
        />
      )}

      {data && (
        <div className="flex flex-col gap-6">
          {/* Primary stat grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatTile
              icon={Users}
              label="Total users"
              value={formatNumber(data.total_users)}
              info="Total number of registered user accounts on the platform."
            />
            <StatTile
              icon={ShieldCheck}
              label="Admins"
              value={formatNumber(data.total_admins)}
              info="Users with administrative or super admin privileges."
            />
            <StatTile
              icon={TrendingUp}
              label="Pro users"
              value={formatNumber(data.total_pro_users)}
              info="Subscribed or upgraded users with higher token limits."
            />
            <StatTile
              icon={Activity}
              label="Active today"
              value={formatNumber(data.active_users_today)}
              hint={`${formatNumber(data.active_users_7d)} / 7d`}
              info="Unique users performing actions today. Hint shows 7-day active user count."
            />
            <StatTile
              icon={FileText}
              label="Documents"
              value={formatNumber(data.total_documents)}
              info="Total number of PDF documents uploaded across all users."
            />
            <StatTile
              icon={Layers}
              label="Chunks"
              value={formatCompact(data.total_chunks)}
              info="Total text segments extracted and indexed from PDFs for search."
            />
            <StatTile
              icon={MessageSquare}
              label="Chats"
              value={formatNumber(data.total_chats)}
              info="Total number of AI study chat messages sent by users."
            />
            <StatTile
              icon={FileStack}
              label="Summaries"
              value={formatNumber(data.total_summaries)}
              info="Total number of grounded summaries generated in any format."
            />
            <StatTile
              icon={GraduationCap}
              label="Quizzes"
              value={formatNumber(data.total_quizzes)}
              hint={`${data.average_quiz_score}% avg`}
              info="Total quizzes generated and taken. Hint shows system-wide average score."
            />
            <StatTile
              icon={Coins}
              label="Lifetime tokens"
              value={formatCompact(data.lifetime_tokens)}
              info="Cumulative number of LLM input and output tokens consumed across the platform."
            />
            <StatTile
              icon={Coins}
              label="Tokens today"
              value={formatCompact(data.tokens_today_counter)}
              hint="counter"
              info="Total tokens consumed by all users today since 00:00 UTC."
            />
            <StatTile
              icon={Activity}
              label="Active 30d"
              value={formatNumber(data.active_users_30d)}
              info="Unique users active on the platform in the last 30 days."
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Signups & active users (30d)">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={mergeDailySeries(data)}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.gold} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={palette.gold} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={palette.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    tick={{ fill: palette.muted, fontSize: 10 }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...tooltipStyle} labelFormatter={labelDate} />
                  <Area
                    type="monotone"
                    dataKey="signups"
                    name="Signups"
                    stroke={palette.gold}
                    fill="url(#signupFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="active"
                    name="Active"
                    stroke={palette.primary}
                    fill="url(#dauFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Tokens by type (30d)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.daily_tokens.map((d) => ({
                    ...d,
                    date: d.date,
                  }))}
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
                  <Bar dataKey="summary" name="Summary" stackId="t" fill={palette.gold} />
                  <Bar dataKey="quiz" name="Quiz" stackId="t" fill={palette.coral} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tier split */}
            <ChartCard title="Tier breakdown">
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Pro", value: data.total_pro_users },
                        {
                          name: "Free",
                          value: Math.max(0, data.total_users - data.total_pro_users),
                        },
                      ]}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      stroke="none"
                    >
                      <Cell fill={palette.gold} />
                      <Cell fill={palette.grid} />
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3">
                  <LegendRow color={palette.gold} label="Pro" value={data.total_pro_users} />
                  <LegendRow
                    color={palette.grid}
                    label="Free"
                    value={Math.max(0, data.total_users - data.total_pro_users)}
                  />
                </div>
              </div>
            </ChartCard>

            {/* Users by major */}
            <ChartCard title="Users by major">
              {data.users_by_major.length === 0 ? (
                <p className="text-xs text-text-muted py-6 text-center">
                  No majors recorded yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                  {data.users_by_major.map((m) => (
                    <div
                      key={m.major}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.02] last:border-0"
                    >
                      <span className="text-white font-bold truncate pr-3">
                        {m.major}
                      </span>
                      <span className="text-accent-gold font-extrabold shrink-0 bg-accent-gold/5 border border-accent-gold/10 px-2 py-0.5 rounded-md text-[10px]">
                        {formatNumber(m.count)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Top uploaders */}
          <ChartCard title="Top uploaders">
            {data.top_uploaders.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">
                No documents uploaded yet.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border-subtle">
                {data.top_uploaders.map((u, i) => (
                  <div
                    key={u.user_id}
                    className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <span className="h-6 w-6 rounded-lg bg-surface-raised border border-border-subtle flex items-center justify-center text-[10px] font-black text-text-muted shrink-0 shadow-sm">
                      {i + 1}
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-extrabold text-white truncate">
                        {u.full_name}
                      </span>
                      <span className="text-[11px] text-text-muted truncate mt-0.5">
                        {u.email}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-brand-primary shrink-0 bg-brand-primary/5 border border-brand-primary/15 px-2.5 py-1 rounded-lg">
                      {formatNumber(u.document_count)} docs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-2 w-2 rounded-full shrink-0 shadow-sm"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
      />
      <span className="text-xs text-text-muted font-bold uppercase tracking-wider">{label}</span>
      <span className="text-xs text-white font-black ml-auto pl-4">
        {formatNumber(value)}
      </span>
    </div>
  );
}

// Joins daily signups and DAU into a single keyed-by-date series for the area
// chart. Days present in either source appear; missing values default to 0.
function mergeDailySeries(
  data: AdminOverview
): { date: string; signups: number; active: number }[] {
  const byDate: Record<string, { signups: number; active: number }> = {};
  for (const d of data.daily_signups) {
    byDate[d.date] = { signups: d.count, active: 0 };
  }
  for (const d of data.daily_active_users) {
    byDate[d.date] = { signups: byDate[d.date]?.signups ?? 0, active: d.count };
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}
