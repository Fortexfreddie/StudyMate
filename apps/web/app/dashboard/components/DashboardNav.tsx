"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Upload, History, User } from "lucide-react";

interface NavItem {
  label: string;
  icon: typeof Home;
  href: string;
}

export function DashboardNav() {
  const pathname = usePathname();

  const items: NavItem[] = [
    { label: "Home", icon: Home, href: "/dashboard" },
    { label: "Upload", icon: Upload, href: "/dashboard/upload" },
    { label: "History", icon: History, href: "/dashboard/history" },
    { label: "Profile", icon: User, href: "/dashboard/profile" },
  ];

  const checkActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/document/");
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
                className={`flex flex-col items-center gap-1 focus:outline-none transition ${
                  active ? "text-brand-primary" : "text-text-muted hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Desktop/Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card-bg border-r border-border-subtle min-h-screen p-6 shrink-0">
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
                className={`flex items-center gap-3 w-full rounded-2xl py-3.5 px-4 font-bold text-sm focus:outline-none transition ${
                  active
                    ? "bg-brand-primary text-black"
                    : "text-text-muted hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop Sidebar Profile Summary */}
        <div className="border-t border-border-subtle pt-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">
            E
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white leading-none mb-1">
              Esther
            </span>
            <span className="text-xs text-text-muted leading-none">
              student@futo.edu
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
