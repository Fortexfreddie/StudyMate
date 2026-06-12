import { type ReactNode, useState, useEffect } from "react";

interface ProgressRingProps {
  percentage: number;
  label: string;
  sublabel: string;
  strokeColor: string;
  icon: ReactNode;
}

export function ProgressRing({
  percentage,
  label,
  sublabel,
  strokeColor,
  icon,
}: ProgressRingProps) {
  const [currentPercent, setCurrentPercent] = useState(0);

  useEffect(() => {
    // Small delay to ensure the browser has rendered the initial 0% state
    const t = setTimeout(() => {
      setCurrentPercent(percentage);
    }, 50);
    return () => clearTimeout(t);
  }, [percentage]);

  const radius = 38;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (currentPercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3 select-none flex-1 min-w-[90px]">
      <div className="relative flex items-center justify-center h-22 w-22">
        
        {/* Background track circle */}
        <svg className="absolute h-full w-full transform -rotate-90">
          <circle
            cx="44"
            cy="44"
            r={radius}
            stroke="var(--color-ring-track)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress colored circle */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Interior metrics & icon */}
        <div className="flex flex-col items-center justify-center z-10 gap-0.5">
          <div className="text-text-muted">{icon}</div>
          <span className="text-sm font-bold text-white leading-none">
            {percentage}%
          </span>
        </div>
      </div>

      <div className="flex flex-col text-center">
        <span className="text-xs text-text-muted font-medium leading-tight">
          {label}
        </span>
        <span className="text-xs text-text-muted font-medium leading-tight">
          {sublabel}
        </span>
      </div>
    </div>
  );
}
