import type { User } from "./types";

export function getFirstName(user: User | null): string {
  if (!user?.full_name) return "there";
  return user.full_name.trim().split(/\s+/)[0];
}

export function getInitials(user: User | null): string {
  if (!user?.full_name) return "?";
  const parts = user.full_name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}
