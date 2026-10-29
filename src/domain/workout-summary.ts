import type { Workout } from './workout';

export interface WeekSummary {
  count: number;
  distanceMeters: number;
  durationSeconds: number;
}

/** Segunda-feira 00:00 (horário local) da semana que contém `date`. */
export function startOfWeek(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
}

/** Totais dos treinos ativos da semana (segunda a domingo) que contém `now`. */
export function summarizeWeek(workouts: readonly Workout[], now: Date = new Date()): WeekSummary {
  const monday = startOfWeek(now);
  const start = monday.getTime();
  // Fim pelo calendário, não com +7 dias em ms, por causa do horário de verão.
  const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).getTime();

  return workouts.reduce<WeekSummary>(
    (acc, w) => {
      const time = Date.parse(w.date);
      if (w.deletedAt !== null || time < start || time >= end) return acc;
      return {
        count: acc.count + 1,
        distanceMeters: acc.distanceMeters + w.distanceMeters,
        durationSeconds: acc.durationSeconds + w.durationSeconds,
      };
    },
    { count: 0, distanceMeters: 0, durationSeconds: 0 },
  );
}
