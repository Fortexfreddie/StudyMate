interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = "Loading...", className = "" }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-brand-primary" />
      <span className="text-xs text-text-muted font-medium">{label}</span>
    </div>
  );
}
