"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Upload, History, User, Shield, Trophy } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getFirstName, getInitials } from "@/lib/user";

interface NavItem {
  label: string;
  icon: typeof Home;
  href: string;
}

export function DashboardNav() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  // Only decide admin-ness once auth has hydrated, so the Admin link doesn't pop
  // in/out during the initial load for an admin user.
  const isAdmin =
    !isLoading && (user?.role === "admin" || user?.role === "super_admin");

  // Admin link sits between History and Profile, and only for admin roles. Built
  // once here so the mobile bar and desktop sidebar stay in sync.
  const items: NavItem[] = [
    { label: "Home", icon: Home, href: "/dashboard" },
    { label: "Upload", icon: Upload, href: "/dashboard/upload" },
    { label: "History", icon: History, href: "/dashboard/history" },
    ...(isAdmin
      ? [{ label: "Admin", icon: Shield, href: "/dashboard/admin" }]
      : []),
    { label: "Profile", icon: User, href: "/dashboard/profile" },
  ];

  const checkActive = (href: string) => {
    if (href === "/dashboard") {
      // Home covers the dashboard itself plus all study sub-pages
      // that don't have their own sidebar entry.
      return (
        pathname === "/dashboard" ||
        pathname.startsWith("/dashboard/document/") ||
        pathname.startsWith("/dashboard/documents") ||
        pathname.startsWith("/dashboard/quiz") ||
        pathname.startsWith("/dashboard/summary") ||
        pathname.startsWith("/dashboard/chat")
      );
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Floating Bottom Bar */}
      <div className="md:hidden fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-[360px] z-50">
        <div className="flex items-center justify-around bg-card-bg border border-border-subtle rounded-3xl py-3 px-4 shadow-2xl shadow-black/80 backdrop-blur-md">
          {items.map((item) => {
            const Icon = item.icon;
            const active = checkActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                data-tour={item.label.toLowerCase()}
                className={`relative flex flex-col items-center gap-1 focus:outline-none transition-all duration-300 hover:scale-105 active:scale-95 pb-1 ${
                  active ? "text-brand-primary" : "text-text-muted hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-300 ${active ? "scale-110" : ""}`} />
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Desktop/Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card-bg border-r border-border-subtle h-screen sticky top-0 p-6 shrink-0 overflow-y-auto">
        <div className="flex items-center gap-3 mb-10 select-none">
          <div className="h-8 w-8 rounded-xl bg-brand-primary flex items-center justify-center font-extrabold text-black">
            S
          </div>
          <span className="text-lg font-black text-white tracking-wider">
            StudyMate
          </span>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = checkActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                data-tour={item.label.toLowerCase()}
                className={`flex items-center gap-3 w-full rounded-2xl py-3.5 px-4 font-bold text-sm focus:outline-none transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] ${
                  active
                    ? "bg-brand-primary text-black shadow-lg shadow-brand-primary/10"
                    : "text-text-muted hover:text-white hover:bg-white/5 hover:-translate-y-0.5"
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-300 ${active ? "scale-105" : ""}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop Sidebar Profile Summary */}
        <div className="border-t border-border-subtle pt-6 flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold shrink-0">
            {getInitials(user)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white leading-none mb-1 truncate">
              {getFirstName(user)}
            </span>
            <span className="text-xs text-text-muted leading-none truncate">
              {user?.email ?? ""}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
