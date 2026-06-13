"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

interface AdminGuardProps {
  children: ReactNode;
}

const ADMIN_ROLES = ["admin", "super_admin"];

// Sits inside the dashboard (already authenticated). Gates the admin section to
// admin/super_admin roles; everyone else is sent back to the dashboard home. The
// backend independently enforces the same gate, so this is purely UX.
export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role ?? "");

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted">
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}
