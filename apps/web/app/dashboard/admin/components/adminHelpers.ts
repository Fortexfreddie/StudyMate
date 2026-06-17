"use client";

import { useEffect, useState } from "react";

// Compact number formatting for stat tiles and chart axes (e.g. 12_500 -> "12.5k").
export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// Short axis label for an ISO date string (YYYY-MM-DD) -> "Jun 13".
export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatJoined(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const ROLE_LABEL: Record<string, string> = {
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
};

export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

// Mirrors the backend's User.effective_is_pro: admins always get pro limits
// regardless of the stored is_pro flag, so the UI must show them as Pro.
export function effectiveIsPro(role: string, isPro: boolean): boolean {
  return isPro || isAdminRole(role);
}

// Reads the live theme colors from CSS custom properties so charts re-theme with
// the rest of the app instead of hard-coding hex values. Re-resolves on mount.
export interface ChartPalette {
  primary: string;
  gold: string;
  coral: string;
  muted: string;
  grid: string;
}

export function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>({
    primary: "#f09e5b",
    gold: "#f3c494",
    coral: "#ef6868",
    muted: "#8a8a8a",
    grid: "#262626",
  });

  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      root.getPropertyValue(name).trim() || fallback;
    setPalette({
      primary: read("--color-brand-primary", "#f09e5b"),
      gold: read("--color-accent-gold", "#f3c494"),
      coral: read("--color-accent-coral", "#ef6868"),
      muted: read("--color-text-muted", "#8a8a8a"),
      grid: read("--color-border-subtle", "#262626"),
    });
  }, []);

  return palette;
}
