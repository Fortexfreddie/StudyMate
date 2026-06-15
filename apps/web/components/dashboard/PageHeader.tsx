"use client";

import { type ReactNode } from "react";
import { ArrowLeft, Bell } from "lucide-react";
import { IconButton } from "@/components/shared/IconButton";

interface PageHeaderProps {
  title?: ReactNode;
  onBack?: () => void;
  titleIcon?: ReactNode;
  showBell?: boolean;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({
  title,
  onBack,
  titleIcon,
  // Off by default: the bell is not yet wired to a real notifications feed, so a
  // permanently-lit dot is misleading. Opt in explicitly once it has a backend.
  showBell = false,
  className = "",
  children,
}: PageHeaderProps) {
  return (
    <header className={`flex items-center justify-between w-full ${className}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {onBack && (
          <IconButton
            onClick={onBack}
            aria-label="Go back"
            icon={<ArrowLeft className="h-4.5 w-4.5 text-white" />}
            className="cursor-pointer"
          />
        )}
        {titleIcon}
        {title && (
          <h1 className="text-sm font-bold text-white truncate">{title}</h1>
        )}
        {children}
      </div>

      {showBell && (
        <IconButton
          aria-label="Notifications"
          dot
          icon={<Bell className="h-4.5 w-4.5 text-white" />}
        />
      )}
    </header>
  );
}
