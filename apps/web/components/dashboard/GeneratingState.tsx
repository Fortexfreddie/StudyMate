import { GeneratingLoader } from "@/components/shared/Icons";

interface GeneratingStateProps {
  title: string;
  subtitle: string;
  /** Omit for an indeterminate bar (used when real progress can't be measured). */
  progress?: number;
  progressLabel?: string;
  accentClass?: string;
  accentColor?: string;
}

export function GeneratingState({
  title,
  subtitle,
  progress,
  progressLabel,
  accentClass = "text-brand-primary",
  accentColor = "var(--color-brand-primary)",
}: GeneratingStateProps) {
  const indeterminate = progress === undefined;
  return (
    <section className="flex flex-col items-center justify-center text-center my-auto gap-6 animate-in fade-in duration-300">
      <div className="relative h-20 w-20 flex items-center justify-center">
        <div className="absolute h-full w-full rounded-full border-4 border-border-subtle" />
        <div
          style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)", borderColor: accentColor }}
          className="absolute h-full w-full rounded-full border-4 animate-spin"
        />
        <GeneratingLoader className={`h-7 w-7 ${accentClass}`} />
      </div>

      <div className="flex flex-col gap-1.5 mt-2">
        <h2 className="text-base font-extrabold text-white leading-none">{title}</h2>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>

      <div className="relative w-48 bg-card-bg border border-border-subtle h-2 rounded-full overflow-hidden mt-2">
        {indeterminate ? (
          <div
            style={{ backgroundColor: accentColor }}
            className="absolute top-0 bottom-0 left-0 w-1/3 rounded-full animate-progress-slide"
          />
        ) : (
          <div
            style={{ width: `${progress}%`, backgroundColor: accentColor }}
            className="h-full transition-all duration-150"
          />
        )}
      </div>
      {progressLabel && (
        <span className={`text-[10px] font-bold ${accentClass}`}>{progressLabel}</span>
      )}
    </section>
  );
}
