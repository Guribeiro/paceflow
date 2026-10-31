import { goalProgress } from './weekly-goal';
import type { Workout } from './workout';
import { keyOfDate } from './workout-date';
import { startOfWeek } from './workout-summary';

export interface Streak {
  /** Semanas seguidas que contaram, até a passada (mais a atual, se já contou). */
  current: number;
  /** Maior sequência do histórico. */
  best: number;
  currentWeekDone: boolean;
  /** Há sequência e a semana atual ainda não contou. */
  atRisk: boolean;
  /** Quanto falta na semana atual; null sem meta (basta uma corrida) ou já cumprida. */
  remainingMeters: number | null;
}

/** Meta (metros) que valia na semana que começa em `weekKey` (AAAA-MM-DD); null = sem meta. */
export type GoalForWeek = (weekKey: string) => number | null;

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/**
 * Sequência de semanas (segunda a domingo) em que a meta foi batida. Sem
 * meta, a semana conta com pelo menos um treino. A semana atual em aberto
 * não quebra a sequência.
 */
export function weeklyStreak(workouts: readonly Workout[], goalForWeek: GoalForWeek, now: Date = new Date()): Streak {
  const weeks = new Map<string, { meters: number; count: number }>();
  let first: Date | null = null;
  for (const w of workouts) {
    if (w.deletedAt !== null) continue;
    const date = new Date(w.date);
    if (date.getTime() > now.getTime()) continue;
    const monday = startOfWeek(date);
    if (!first || monday < first) first = monday;
    const key = keyOfDate(monday);
    const week = weeks.get(key) ?? { meters: 0, count: 0 };
    week.meters += w.distanceMeters;
    week.count += 1;
    weeks.set(key, week);
  }

  const done = (key: string) => {
    const week = weeks.get(key);
    if (!week) return false;
    const goal = goalForWeek(key);
    return goal === null ? week.count > 0 : goalProgress(week.meters, goal).reached;
  };

  const currentMonday = startOfWeek(now);
  const currentKey = keyOfDate(currentMonday);
  const currentWeekDone = done(currentKey);

  let best = 0;
  let run = 0;
  // Pelo calendário, não 7×24h em ms, por causa do horário de verão.
  for (let monday = first ?? currentMonday; monday < currentMonday; monday = addDays(monday, 7)) {
    run = done(keyOfDate(monday)) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const current = run + (currentWeekDone ? 1 : 0);
  best = Math.max(best, current);

  const goal = goalForWeek(currentKey);
  const remainingMeters =
    currentWeekDone || goal === null ? null : goalProgress(weeks.get(currentKey)?.meters ?? 0, goal).remainingMeters;

  return { current, best, currentWeekDone, atRisk: current > 0 && !currentWeekDone, remainingMeters };
}

/** "1 semana", "5 semanas". */
export function streakLabel(weeks: number): string {
  return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
}
