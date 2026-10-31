import { describeMeasure } from './interval-plan';
import { type DistanceUnit, KM_PER_MILE, describeSeries, formatDuration, lapStats } from './pace';
import type { IntervalProgress, PhaseResult } from './run-tracker';

/** Tiros concluídos sem pular. */
export const completedWork = (results: readonly PhaseResult[]) => results.filter((r) => r.kind === 'work' && !r.skipped);

/**
 * Nota automática do treino: "8×400 m · média 1:32 (3:50/km) · variação 4 s"
 * para tiros por distância (como no modo Tiros), "6 × 2 min · média 520 m
 * (3:51/km)" por tempo. null sem tiro concluído.
 */
export function seriesNote(progress: IntervalProgress, unit: DistanceUnit): string | null {
  const reps = completedWork(progress.results);
  if (reps.length === 0) return null;
  const { work } = progress.plan;
  if (work.kind === 'distance') {
    const stats = lapStats(
      reps.map((r) => r.ms / 1000),
      work.meters,
    );
    return stats ? describeSeries(stats, work.meters, unit) : null;
  }
  const meters = reps.reduce((sum, r) => sum + r.meters, 0);
  const seconds = reps.reduce((sum, r) => sum + r.ms, 0) / 1000;
  const average = `média ${Math.round(meters / reps.length)} m`;
  if (meters < 1) return `${reps.length} × ${describeMeasure(work)} · ${average}`;
  const pace = seconds / (meters / 1000);
  return `${reps.length} × ${describeMeasure(work)} · ${average} (${formatDuration(
    Math.round(unit === 'mi' ? pace * KM_PER_MILE : pace),
  )}/${unit})`;
}
