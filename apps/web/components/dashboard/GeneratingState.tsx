import { Sparkles } from "lucide-react";

interface GeneratingStateProps {
  title: string;
  subtitle: string;
  progress: number;
  progressLabel: string;
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
  return (
    <section className="flex flex-col items-center justify-center text-center my-auto gap-6 animate-in fade-in duration-300">
      <div className="relative h-20 w-20 flex items-center justify-center">
        <div className="absolute h-full w-full rounded-full border-4 border-border-subtle" />
        <div
          style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)", borderColor: accentColor }}
          className="absolute h-full w-full rounded-full border-4 animate-spin"
        />
        <Sparkles className={`h-6 w-6 animate-pulse ${accentClass}`} />
      </div>

      <div className="flex flex-col gap-1.5 mt-2">
        <h2 className="text-base font-extrabold text-white leading-none">{title}</h2>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>

      <div className="w-48 bg-card-bg border border-border-subtle h-2 rounded-full overflow-hidden mt-2">
        <div
          style={{ width: `${progress}%`, backgroundColor: accentColor }}
          className="h-full transition-all duration-150"
        />
      </div>
      <span className={`text-[10px] font-bold ${accentClass}`}>{progressLabel}</span>
    </section>
  );
}
