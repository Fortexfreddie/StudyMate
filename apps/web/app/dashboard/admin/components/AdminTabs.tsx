"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/dashboard/admin" },
  { label: "Users", href: "/dashboard/admin/users" },
  { label: "Documents", href: "/dashboard/admin/documents" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-1 bg-surface-raised/40 backdrop-blur-md border border-border-subtle/50 rounded-2xl p-1.5 mb-8 shadow-sm self-start">
      {TABS.map((tab) => {
        const active =
          tab.href === "/dashboard/admin"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 select-none cursor-pointer ${
              active
                ? "bg-brand-primary text-brand-primary-fg shadow-lg shadow-brand-primary/10 scale-[1.02]"
                : "text-text-muted hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
