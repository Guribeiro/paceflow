import { type DistanceUnit, KM_PER_MILE, formatDistance, formatDuration } from './pace';
import type { Workout } from './workout';
import { startOfWeek, summarizeWeek } from './workout-summary';

/**
 * Props do widget "Semana". O componente do widget roda isolado, sem imports
 * nem lógica assíncrona, por isso recebe tudo já formatado.
 */
export interface WeekWidgetProps {
  weekLabel: string;
  distance: string;
  unit: DistanceUnit;
  count: string;
  lastPace: string | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function countLabel(count: number): string {
  if (count === 0) return 'Nenhum treino';
  return `${count} ${count === 1 ? 'treino' : 'treinos'}`;
}

export function buildWeekWidgetProps(
  workouts: readonly Workout[],
  unit: DistanceUnit,
  now: Date = new Date(),
): WeekWidgetProps {
  const monday = startOfWeek(now);
  const summary = summarizeWeek(workouts, now);

  const latest = workouts
    .filter((w) => w.deletedAt === null)
    .reduce<Workout | null>((acc, w) => (!acc || Date.parse(w.date) > Date.parse(acc.date) ? w : acc), null);

  let lastPace: string | null = null;
  if (latest) {
    const secondsPerKm = latest.durationSeconds / (latest.distanceMeters / 1000);
    const pace = unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm;
    lastPace = `${formatDuration(pace)}/${unit}`;
  }

  return {
    weekLabel: `Semana de ${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}`,
    distance: formatDistance(summary.distanceMeters, unit),
    unit,
    count: countLabel(summary.count),
    lastPace,
  };
}
