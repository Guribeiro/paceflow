import { type TrainingPaces, fitnessIndex, trainingPaces } from './pace/training-paces';
import type { Workout } from './workout';

/** Prova-alvo: distância, data local (AAAA-MM-DD) e tempo desejado opcional. */
export interface RaceGoal {
  distanceKm: number;
  date: string;
  targetSeconds?: number;
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function parseRaceGoal(value: unknown): RaceGoal | null {
  if (typeof value !== 'object' || value === null) return null;
  const g = value as Record<string, unknown>;
  if (!isPositive(g.distanceKm) || typeof g.date !== 'string' || !DATE_KEY.test(g.date)) return null;
  if (g.targetSeconds !== undefined && !isPositive(g.targetSeconds)) return null;
  return {
    distanceKm: g.distanceKm,
    date: g.date,
    ...(g.targetSeconds !== undefined && { targetSeconds: g.targetSeconds as number }),
  };
}

// Mesmos limites de training-paces: esforços muito curtos ou longos distorcem o índice.
const MIN_KM = 1.5;
const MAX_KM = 42.195;
const MIN_S = 3 * 60;
const MAX_S = 6 * 60 * 60;

/** Treino ativo das últimas `weeks` semanas com o maior índice de condicionamento. */
export function bestRecentEffort(
  workouts: readonly Workout[],
  now: Date = new Date(),
  weeks = 8,
): { workout: Workout; index: number } | null {
  const since = now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000;
  let best: { workout: Workout; index: number } | null = null;
  for (const w of workouts) {
    const km = w.distanceMeters / 1000;
    const time = Date.parse(w.date);
    if (w.deletedAt !== null || time < since || time > now.getTime()) continue;
    if (km < MIN_KM || km > MAX_KM || w.durationSeconds < MIN_S || w.durationSeconds > MAX_S) continue;
    const index = fitnessIndex(km, w.durationSeconds);
    if (!best || index > best.index) best = { workout: w, index };
  }
  return best;
}

/**
 * Tempo (s) em que `distanceKm` corresponde ao índice dado. O índice cai à
 * medida que o tempo aumenta, então uma busca binária inverte a fórmula de
 * forma exata e coerente com os paces de treino.
 */
export function predictTimeForIndex(index: number, distanceKm: number): number {
  let lo = 60;
  let hi = 24 * 60 * 60;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (fitnessIndex(distanceKm, mid) > index) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface RaceGoalSummary {
  daysLeft: number;
  weeksLeft: number;
  past: boolean;
  targetSecondsPerKm: number | null;
  projectedSeconds: number | null;
  /** Treino que gerou a projeção (para o usuário reconhecer um registro errado). */
  effort: Pick<Workout, 'date' | 'distanceMeters' | 'durationSeconds'> | null;
  /** Projeção − meta: positivo = falta melhorar; negativo = já abaixo da meta. */
  deltaSeconds: number | null;
  /** Paces de treino para o tempo-alvo. */
  goalPaces: TrainingPaces | null;
  /** Paces de treino do condicionamento atual (melhor esforço recente). */
  projectedPaces: TrainingPaces | null;
}

function daysUntil(dateKey: string, now: Date): number {
  const [, y, m, d] = DATE_KEY.exec(dateKey)!;
  const race = new Date(Number(y), Number(m) - 1, Number(d));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Arredonda: dias de 23 ou 25 h no horário de verão.
  return Math.round((race.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function raceGoalSummary(goal: RaceGoal, workouts: readonly Workout[], now: Date = new Date()): RaceGoalSummary {
  const daysLeft = daysUntil(goal.date, now);
  const effort = bestRecentEffort(workouts, now);
  const projectedSeconds = effort ? predictTimeForIndex(effort.index, goal.distanceKm) : null;
  const goalPaces = goal.targetSeconds ? trainingPaces(goal.distanceKm, goal.targetSeconds) : null;
  const projectedPaces = effort
    ? trainingPaces(effort.workout.distanceMeters / 1000, effort.workout.durationSeconds)
    : null;

  return {
    daysLeft,
    weeksLeft: Math.max(0, Math.floor(daysLeft / 7)),
    past: daysLeft < 0,
    targetSecondsPerKm: goal.targetSeconds ? goal.targetSeconds / goal.distanceKm : null,
    projectedSeconds,
    effort: effort
      ? {
          date: effort.workout.date,
          distanceMeters: effort.workout.distanceMeters,
          durationSeconds: effort.workout.durationSeconds,
        }
      : null,
    deltaSeconds: projectedSeconds !== null && goal.targetSeconds ? projectedSeconds - goal.targetSeconds : null,
    goalPaces: goalPaces?.ok ? goalPaces.value : null,
    projectedPaces: projectedPaces?.ok ? projectedPaces.value : null,
  };
}

/** "23/11/2026" → "2026-11-23"; null se o formato ou a data forem inválidos (ex.: 31/02). */
export function parseDateInput(input: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
