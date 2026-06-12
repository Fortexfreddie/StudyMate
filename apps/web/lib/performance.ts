import type { PerformanceMode } from "./types";
import { getPerformanceMode } from "./api";

interface PerfConfig {
  default: number;
  max: number;
}

// top_k defaults/caps per performance tier — mirrors the backend PERFORMANCE_MODES.
const PERF_CONFIG: Record<PerformanceMode, PerfConfig> = {
  low: { default: 5, max: 10 },
  medium: { default: 8, max: 15 },
  high: { default: 10, max: 20 },
  very_high: { default: 15, max: 25 },
  max: { default: 20, max: 30 },
};

export function getPerfConfig(mode: string): PerfConfig {
  return PERF_CONFIG[mode as PerformanceMode] ?? PERF_CONFIG.high;
}

export function getActivePerfConfig(): { mode: string; config: PerfConfig } {
  const mode = getPerformanceMode();
  return { mode, config: getPerfConfig(mode) };
}
