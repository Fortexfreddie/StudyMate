import { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center gap-4 select-none ${className}`}>
      {icon && <div className="flex items-center justify-center">{icon}</div>}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-sm sm:text-base font-black text-white">{title}</h4>
        {description && (
          <p className="text-[10px] sm:text-xs text-text-muted max-w-[260px] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
