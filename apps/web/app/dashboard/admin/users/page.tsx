"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { AdminToast, type ToastState } from "@/components/shared/AdminToast";
import { useAuth } from "@/components/providers/AuthProvider";
import { api, ApiClientError } from "@/lib/api";
import type { AdminUserListItem, AdminUserListResponse } from "@/lib/types";
import { AdminTabs } from "../components/AdminTabs";
import { RoleBadge, TierBadge } from "../components/Badges";
import { formatJoined, effectiveIsPro, isAdminRole } from "../components/adminHelpers";
import { EmptySearchIllustration } from "@/components/shared/EmptySearchIllustration";

const PAGE_SIZE = 20;
const ROLE_FILTERS = ["all", "user", "admin", "super_admin"] as const;
const TIER_FILTERS = ["all", "pro", "free"] as const;

type Action =
  | { kind: "tier"; user: AdminUserListItem }
  | { kind: "role"; user: AdminUserListItem }
  | { kind: "delete"; user: AdminUserListItem };

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const isSuper = me?.role === "super_admin";

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("all");
  const [tierFilter, setTierFilter] = useState<(typeof TIER_FILTERS)[number]>("all");
  const [page, setPage] = useState(0);

  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Debounce the search box so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Guards against out-of-order responses: only the latest request may commit
  // its result to state, so a slow earlier fetch can't clobber a newer one.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.listUsers({
        search: search || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        is_pro: tierFilter === "all" ? undefined : tierFilter === "pro",
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (seq === loadSeq.current) setData(res);
    } catch (err) {
      if (seq === loadSeq.current) {
        setError(err instanceof ApiClientError ? err.detail : "Failed to load users.");
      }
    } finally {
      if (seq === loadSeq.current) setIsLoading(false);
    }
  }, [search, roleFilter, tierFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const rangeStart = data && data.total > 0 ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = data ? Math.min((page + 1) * PAGE_SIZE, data.total) : 0;

  const confirmAction = async () => {
    if (!action) return;
    setBusy(true);
    setActionError(null);
    const { kind, user } = action;
    try {
      if (kind === "tier") {
        await api.admin.updateUser(user.id, { is_pro: !user.is_pro });
        showToast(
          `${user.full_name} ${user.is_pro ? "downgraded to Free" : "upgraded to Pro"}`,
          "success"
        );
      } else if (kind === "role") {
        const nextRole = user.role === "admin" ? "user" : "admin";
        await api.admin.updateUser(user.id, { role: nextRole });
        showToast(
          `${user.full_name} ${nextRole === "admin" ? "promoted to Admin" : "demoted to User"}`,
          "success"
        );
      } else {
        await api.admin.deleteUser(user.id);
        showToast(`User ${user.email} deleted`, "success");
      }
      setAction(null);
      // If we just removed the only row on a non-first page, step back so we don't
      // strand the user on an empty page past the end. Changing `page` re-triggers
      // `load`; otherwise reload the current page in place.
      if (kind === "delete" && page > 0 && data?.users.length === 1) {
        setPage((p) => Math.max(0, p - 1));
      } else {
        load();
      }
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.detail : "Action failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const showToast = (message: string, variant: ToastState["variant"]) =>
    setToast({ message, variant });

  // Open a confirm modal for an action, clearing any error left from a prior one.
  const openAction = (a: Action) => {
    setActionError(null);
    setAction(a);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      <header className="mb-6">
        <h2 className="text-xl sm:text-2xl text-white font-extrabold leading-tight">
          Users
        </h2>
        <p className="text-xs text-text-muted mt-1">
          Manage roles, tiers, and accounts.
        </p>
      </header>

      <AdminTabs />

      {/* Search + filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email"
            className="w-full bg-surface border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-xs sm:text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-brand-primary/40 focus:ring-1 focus:ring-brand-primary/10 transition shadow shadow-black/10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((r) => (
            <FilterChip
              key={r}
              active={roleFilter === r}
              onClick={() => {
                setRoleFilter(r);
                setPage(0);
              }}
              label={r === "all" ? "All roles" : r === "super_admin" ? "Super" : r}
            />
          ))}
          <span className="w-px bg-border-subtle mx-1" />
          {TIER_FILTERS.map((t) => (
            <FilterChip
              key={t}
              active={tierFilter === t}
              onClick={() => {
                setTierFilter(t);
                setPage(0);
              }}
              label={t === "all" ? "All tiers" : t}
            />
          ))}
        </div>
      </div>

      {isLoading && <LoadingState className="py-24" label="Loading users..." />}
      {error && (
        <ErrorState className="py-24" title="Couldn't load users" message={error} onRetry={load} />
      )}

      {data && !isLoading && !error && (
        <>
          {data.users.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <EmptySearchIllustration className="w-full max-w-[150px] mb-4 opacity-85" />
              <p className="text-sm text-text-muted font-bold">
                No users match these filters.
              </p>
              <p className="text-xs text-text-muted/60 mt-1 max-w-xs">
                Try adjusting your search query or choosing a different role or subscription tier filter.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {data.users.map((u) => (
                  <UserCard
                    key={u.id}
                    user={u}
                    isSuper={isSuper}
                    onAction={openAction}
                  />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block bg-card-bg border border-border-subtle rounded-3xl overflow-hidden shadow-xl shadow-black/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border-subtle bg-surface-raised/20">
                      <th className="font-extrabold px-6 py-4">User</th>
                      <th className="font-extrabold px-4 py-4">Role</th>
                      <th className="font-extrabold px-4 py-4">Tier</th>
                      <th className="font-extrabold px-4 py-4 text-center">Docs</th>
                      <th className="font-extrabold px-4 py-4">Joined</th>
                      <th className="font-extrabold px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        isSuper={isSuper}
                        onAction={openAction}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <span className="text-xs text-text-muted">
              {rangeStart}–{rangeEnd} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <PagerButton
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                icon={<ChevronLeft className="h-4 w-4" />}
              />
              <span className="text-xs text-text-muted font-bold">
                {page + 1} / {totalPages}
              </span>
              <PagerButton
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                icon={<ChevronRight className="h-4 w-4" />}
              />
            </div>
          </div>
        </>
      )}

      <ActionModal
        action={action}
        busy={busy}
        error={actionError}
        onConfirm={confirmAction}
        onCancel={() => {
          if (!busy) {
            setAction(null);
            setActionError(null);
          }
        }}
      />
    </div>
  );
}

// Actions shared between the card and row layouts.
function ActionButtons({
  user,
  isSuper,
  onAction,
  compact,
}: {
  user: AdminUserListItem;
  isSuper: boolean;
  onAction: (a: Action) => void;
  compact?: boolean;
}) {
  const locked = user.role === "super_admin";
  // Admins always have pro limits via role, so their tier isn't independently
  // toggleable — the is_pro flag is overridden by effective_is_pro server-side.
  const tierLocked = isAdminRole(user.role);
  const base =
    "inline-flex items-center gap-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  const pad = compact ? "p-2" : "px-3.5 py-2";

  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent-gold">
        <ShieldCheck className="h-3.5 w-3.5" /> Protected
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        disabled={tierLocked}
        onClick={() => onAction({ kind: "tier", user })}
        className={`${base} ${pad} border-border-subtle text-white hover:bg-white/5`}
        aria-label="Toggle pro"
        title={tierLocked ? "Admins always have Pro limits" : undefined}
      >
        <TrendingUp className="h-3.5 w-3.5" />
        {!compact && (user.is_pro ? "Make Free" : "Make Pro")}
      </button>
      <button
        disabled={!isSuper}
        onClick={() => onAction({ kind: "role", user })}
        className={`${base} ${pad} border-border-subtle text-white hover:bg-white/5`}
        aria-label="Change role"
        title={isSuper ? undefined : "Super admin only"}
      >
        <UserCog className="h-3.5 w-3.5" />
        {!compact && (user.role === "admin" ? "Demote" : "Promote")}
      </button>
      <button
        disabled={!isSuper}
        onClick={() => onAction({ kind: "delete", user })}
        className={`${base} ${pad} border-red-500/30 text-red-400 hover:bg-red-500/10`}
        aria-label="Delete user"
        title={isSuper ? undefined : "Super admin only"}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function UserCard({
  user,
  isSuper,
  onAction,
}: {
  user: AdminUserListItem;
  isSuper: boolean;
  onAction: (a: Action) => void;
}) {
  return (
    <div className="bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-3.5 shadow-md shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-extrabold text-white truncate">{user.full_name}</span>
          <span className="text-[11px] text-text-muted truncate mt-0.5">{user.email}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <RoleBadge role={user.role} />
          <TierBadge isPro={effectiveIsPro(user.role, user.is_pro)} />
        </div>
      </div>
      <div className="text-[11px] text-text-muted">
        {user.major ? `${user.major} • ` : ""}
        {user.document_count} docs • Joined {formatJoined(user.created_at)}
      </div>
      <div className="border-t border-border-subtle pt-3">
        <ActionButtons user={user} isSuper={isSuper} onAction={onAction} compact />
      </div>
    </div>
  );
}

function UserRow({
  user,
  isSuper,
  onAction,
}: {
  user: AdminUserListItem;
  isSuper: boolean;
  onAction: (a: Action) => void;
}) {
  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-white/[0.015] transition-colors duration-150">
      <td className="px-6 py-4">
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-white text-sm truncate">{user.full_name}</span>
          <span className="text-[11px] text-text-muted truncate mt-0.5">{user.email}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-4">
        <TierBadge isPro={effectiveIsPro(user.role, user.is_pro)} />
      </td>
      <td className="px-4 py-4 text-text-muted text-center font-bold">{user.document_count}</td>
      <td className="px-4 py-4 text-text-muted whitespace-nowrap">
        {formatJoined(user.created_at)}
      </td>
      <td className="px-6 py-4">
        <ActionButtons user={user} isSuper={isSuper} onAction={onAction} />
      </td>
    </tr>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold capitalize transition-all duration-200 border cursor-pointer ${
        active
          ? "bg-brand-primary text-brand-primary-fg border-brand-primary/20 shadow-md shadow-brand-primary/5 scale-[1.02]"
          : "bg-card-bg text-text-muted border-border-subtle hover:text-white hover:border-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function PagerButton({
  disabled,
  onClick,
  icon,
}: {
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded-xl bg-card-bg border border-border-subtle flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition cursor-pointer"
    >
      {icon}
    </button>
  );
}

// Renders the right modal copy/tone for each action kind.
function ActionModal({
  action,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  action: Action | null;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const config = useMemo(() => {
    if (!action) return null;
    const { kind, user } = action;
    if (kind === "tier") {
      const toPro = !user.is_pro;
      return {
        tone: "neutral" as const,
        icon: TrendingUp,
        title: "Change Tier",
        confirmLabel: toPro ? "Upgrade to Pro" : "Downgrade to Free",
        loadingLabel: "Saving...",
        body: (
          <>
            <strong className="text-white">{user.full_name}</strong> ({user.email})
            <div className="mt-2">
              {user.is_pro ? "Pro (500k tokens/day)" : "Free (50k tokens/day)"} →{" "}
              <span className="text-accent-gold font-bold">
                {toPro ? "Pro (500k tokens/day)" : "Free (50k tokens/day)"}
              </span>
            </div>
          </>
        ),
      };
    }
    if (kind === "role") {
      const toAdmin = user.role !== "admin";
      return {
        tone: "neutral" as const,
        icon: UserCog,
        title: "Change Role",
        confirmLabel: toAdmin ? "Promote to Admin" : "Demote to User",
        loadingLabel: "Saving...",
        body: (
          <>
            <strong className="text-white">{user.full_name}</strong> ({user.email})
            <div className="mt-2">
              Current: <span className="capitalize">{user.role}</span> →{" "}
              <span className="text-accent-gold font-bold">
                {toAdmin ? "Admin" : "User"}
              </span>
            </div>
            {toAdmin ? (
              <p className="mt-2">
                Admins can view system stats, manage users, and receive Pro tier limits.
              </p>
            ) : (
              <p className="mt-2">
                They lose admin access and revert to their own tier
                {user.is_pro ? " (Pro)" : " (Free)"}.
              </p>
            )}
          </>
        ),
      };
    }
    return {
      tone: "danger" as const,
      icon: Trash2,
      title: "Delete User",
      confirmLabel: "Delete User",
      loadingLabel: "Deleting...",
      body: (
        <>
          Permanently delete <strong className="text-white">{user.full_name}</strong> (
          {user.email})?
          <div className="mt-2 capitalize">
            {user.role} • {effectiveIsPro(user.role, user.is_pro) ? "Pro" : "Free"} •{" "}
            {user.document_count} docs
          </div>
          <p className="mt-2">
            This removes their account, all documents, and purges every indexed vector.
            This cannot be undone.
          </p>
        </>
      ),
    };
  }, [action]);

  if (!action || !config) return null;

  return (
    <ConfirmDialog
      open
      tone={config.tone}
      icon={config.icon}
      title={config.title}
      confirmLabel={config.confirmLabel}
      loadingLabel={config.loadingLabel}
      loading={busy}
      error={error}
      message={config.body}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
