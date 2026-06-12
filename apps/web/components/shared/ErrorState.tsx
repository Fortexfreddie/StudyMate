import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}
    >
      <span className="h-12 w-12 rounded-full bg-error-text/10 border border-error-text/20 flex items-center justify-center text-error-text">
        <AlertCircle className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-text-muted max-w-[280px] leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 py-2 px-4 bg-card-bg border border-border-subtle hover:bg-white/5 rounded-full text-xs font-bold text-white transition cursor-pointer"
        >
          Try again
        </button>
      )}
    </div>
  );
}
