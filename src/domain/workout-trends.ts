import type { Workout } from './workout';
import { startOfWeek } from './workout-summary';

export interface WeekTotal {
  /** Segunda-feira 00:00 local, em ISO. */
  weekStart: string;
  distanceMeters: number;
  durationSeconds: number;
  count: number;
}

export interface Trends {
  activeWeeks: number;
  /** Média por semana com treino (semanas vazias não puxam a média para baixo). */
  averageWeeklyMeters: number | null;
  bestWeek: WeekTotal | null;
  /** Pace médio (s/km) das últimas 4 semanas vs as 4 anteriores. */
  paceChange: { recent: number; previous: number; deltaSeconds: number } | null;
}

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/** Totais das últimas `weeks` semanas (segunda a domingo), da mais antiga à atual. */
export function weeklyTotals(workouts: readonly Workout[], now: Date = new Date(), weeks = 12): WeekTotal[] {
  const current = startOfWeek(now);
  // Pelo calendário, não 7×24h em ms, por causa do horário de verão.
  const starts = Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)));
  const totals = starts.map((start) => ({ weekStart: start.toISOString(), distanceMeters: 0, durationSeconds: 0, count: 0 }));
  const first = starts[0].getTime();
  const end = addDays(current, 7).getTime();

  for (const w of workouts) {
    const time = Date.parse(w.date);
    if (w.deletedAt !== null || time < first || time >= end) continue;
    const index = starts.findIndex((start, i) => time >= start.getTime() && (i === weeks - 1 || time < starts[i + 1].getTime()));
    const week = totals[index];
    week.distanceMeters += w.distanceMeters;
    week.durationSeconds += w.durationSeconds;
    week.count += 1;
  }
  return totals;
}

/** s/km ponderado pela distância; null sem distância. */
export function averagePace(total: Pick<WeekTotal, 'distanceMeters' | 'durationSeconds'>): number | null {
  return total.distanceMeters > 0 ? total.durationSeconds / (total.distanceMeters / 1000) : null;
}

function combine(weeks: readonly WeekTotal[]) {
  return weeks.reduce(
    (acc, w) => ({ distanceMeters: acc.distanceMeters + w.distanceMeters, durationSeconds: acc.durationSeconds + w.durationSeconds }),
    { distanceMeters: 0, durationSeconds: 0 },
  );
}

export function summarizeTrends(weeks: readonly WeekTotal[]): Trends {
  const active = weeks.filter((w) => w.count > 0);
  // Empate: vale a semana mais recente (>=, percorrendo em ordem crescente).
  const bestWeek = active.reduce<WeekTotal | null>(
    (best, w) => (!best || w.distanceMeters >= best.distanceMeters ? w : best),
    null,
  );

  const recent = averagePace(combine(weeks.slice(-4)));
  const previous = averagePace(combine(weeks.slice(-8, -4)));

  return {
    activeWeeks: active.length,
    averageWeeklyMeters: active.length > 0 ? combine(active).distanceMeters / active.length : null,
    bestWeek,
    paceChange:
      recent !== null && previous !== null ? { recent, previous, deltaSeconds: recent - previous } : null,
  };
}

/** Texto da diferença de pace; negativo = mais rápido. */
export function comparePace(deltaSeconds: number): string {
  const rounded = Math.round(Math.abs(deltaSeconds));
  if (rounded === 0) return 'mesmo ritmo';
  return `${rounded} s ${deltaSeconds < 0 ? 'mais rápido' : 'mais lento'}`;
}
