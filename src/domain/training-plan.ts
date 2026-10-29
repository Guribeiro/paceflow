import { RACE_DISTANCES } from './pace/predictor';
import type { PaceRange } from './pace/training-paces';
import { type DistanceUnit, distanceInUnit } from './pace/units';
import { type RaceGoal, raceGoalSummary } from './race-goal';
import type { Workout } from './workout';
import { startOfWeek } from './workout-summary';
import { weeklyTotals } from './workout-trends';

/**
 * Plano semana a semana rumo à prova: volume, fase e treinos-chave. Os outros
 * dias ficam livres e leves. É um plano genérico de referência, não prescrição.
 */

export type PlanPhase = 'base' | 'build' | 'peak' | 'taper' | 'race';
export type SessionKind = 'long' | 'threshold' | 'interval' | 'racePace' | 'race';

export interface KeySession {
  kind: SessionKind;
  title: string;
  detail: string;
  /** s/km; ausente quando não há meta nem histórico para calcular. */
  pace?: PaceRange;
}

export interface TrainingPlanWeek {
  index: number;
  /** Segunda-feira 00:00 local, em ISO. */
  weekStart: string;
  phase: PlanPhase;
  targetMeters: number;
  longRunMeters: number;
  isCutback: boolean;
  isRaceWeek: boolean;
  sessions: KeySession[];
}

export interface TrainingPlan {
  weeks: TrainingPlanWeek[];
  /** Pouco tempo até a prova: o plano é só polimento. */
  shortNotice: boolean;
}

type Category = '5k' | '10k' | 'half' | 'marathon';

const category = (km: number): Category => (km <= 7.5 ? '5k' : km <= 15 ? '10k' : km <= 30 ? 'half' : 'marathon');

const RULES: Record<Category, { floor: number; cap: number; longCap: number; taperWeeks: number }> = {
  '5k': { floor: 15_000, cap: 50_000, longCap: 12_000, taperWeeks: 2 },
  '10k': { floor: 20_000, cap: 60_000, longCap: 16_000, taperWeeks: 2 },
  half: { floor: 25_000, cap: 75_000, longCap: 21_000, taperWeeks: 2 },
  marathon: { floor: 30_000, cap: 90_000, longCap: 32_000, taperWeeks: 3 },
};

/** Volume do polimento como fração do pico; a última semana é a da prova. */
const TAPER_FACTORS: Record<number, number[]> = { 1: [0.6], 2: [0.7, 0.5], 3: [0.75, 0.6, 0.4] };

const WEEKLY_GROWTH = 1.08;
const CUTBACK = 0.8;
const PEAK_OVER_START = 1.5;
const LONG_SHARE = 0.28;

const raceName = (km: number) =>
  RACE_DISTANCES.find((r) => Math.abs(r.distanceKm - km) < 1e-6)?.label ?? `${String(km).replace('.', ',')} km`;

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

function raceDate(goal: RaceGoal): Date {
  const [y, m, d] = goal.date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Média das últimas 4 semanas completas com treino; 0 sem histórico. */
function recentWeeklyAverage(workouts: readonly Workout[], now: Date): number {
  const previous = weeklyTotals(workouts, now, 5).slice(0, 4).filter((w) => w.count > 0);
  return previous.length > 0 ? previous.reduce((sum, w) => sum + w.distanceMeters, 0) / previous.length : 0;
}

const round500 = (m: number) => Math.round(m / 500) * 500;

/** Minutos no limiar: 15→20 na base, 20→30 na construção, 30 no pico, 15 no polimento. */
function thresholdMinutes(phase: PlanPhase, progress: number): number {
  if (phase === 'taper') return 15;
  if (phase === 'peak') return 30;
  if (phase === 'base') return 15 + 5 * Math.round(progress);
  return 20 + 10 * Math.round(progress);
}

function thresholdSession(minutes: number, pace?: PaceRange): KeySession {
  // Blocos de 5 min até 20 min; acima disso, de 10 min.
  const block = minutes <= 20 ? 5 : 10;
  const reps = Math.max(2, Math.round(minutes / block));
  return { kind: 'threshold', title: 'Limiar', detail: `${reps}×${block} min no ritmo de limiar`, ...(pace && { pace }) };
}

export function buildTrainingPlan(
  goal: RaceGoal,
  workouts: readonly Workout[],
  now: Date = new Date(),
  /** Unidade dos textos das sessões (o volume continua em metros). */
  unit: DistanceUnit = 'km',
): TrainingPlan | null {
  const inUnit = (meters: number) => `${distanceInUnit(meters, unit).toFixed(1).replace('.', ',')} ${unit}`;

  const race = raceDate(goal);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (race < today) return null;

  const rules = RULES[category(goal.distanceKm)];
  const firstWeek = startOfWeek(now);
  const raceWeek = startOfWeek(race);
  // Pelo calendário: semanas entre as segundas-feiras, mais a semana da prova.
  const totalWeeks = Math.round((raceWeek.getTime() - firstWeek.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  const shortNotice = totalWeeks <= rules.taperWeeks;
  const taperWeeks = Math.min(totalWeeks, rules.taperWeeks);
  const trainingWeeks = totalWeeks - taperWeeks;
  const peakWeeks = Math.min(2, trainingWeeks);
  // Base: primeiros ~40% das semanas de treino (sem invadir o pico).
  const baseWeeks = Math.min(Math.floor(trainingWeeks * 0.4), trainingWeeks - peakWeeks);

  const start = Math.max(rules.floor, recentWeeklyAverage(workouts, now));
  const ceiling = Math.min(rules.cap, start * PEAK_OVER_START);

  // Progressão das semanas antes do pico: o nível cresce ~8% só nas semanas
  // normais; o alívio (a cada 4ª, nunca logo antes do pico) usa 80% do nível
  // sem avançá-lo. O pico parte do último nível, então com pouco tempo até a
  // prova não há salto brusco de volume.
  const growthWeeks = trainingWeeks - peakWeeks;
  const buildTargets: { target: number; isCutback: boolean }[] = [];
  let level = start;
  for (let i = 0; i < growthWeeks; i++) {
    const isCutback = i % 4 === 3 && i !== growthWeeks - 1;
    if (isCutback) {
      buildTargets.push({ target: level * CUTBACK, isCutback });
    } else {
      if (i > 0) level = Math.min(ceiling, level * WEEKLY_GROWTH);
      buildTargets.push({ target: level, isCutback });
    }
  }
  const peak = Math.min(ceiling, growthWeeks > 0 ? level * WEEKLY_GROWTH : start);

  const summary = raceGoalSummary(goal, workouts, now);
  const paces = summary.goalPaces ?? summary.projectedPaces;
  const racePaceSeconds =
    summary.targetSecondsPerKm ?? (summary.projectedSeconds !== null ? summary.projectedSeconds / goal.distanceKm : null);
  const racePace = racePaceSeconds !== null ? { fastest: racePaceSeconds, slowest: racePaceSeconds } : undefined;
  const isShortRace = goal.distanceKm <= 15;

  const weeks: TrainingPlanWeek[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addDays(firstWeek, i * 7).toISOString();
    const taperIndex = i - trainingWeeks;
    const isRaceWeek = i === totalWeeks - 1;

    let phase: PlanPhase;
    let target: number;
    let isCutback = false;
    if (taperIndex >= 0) {
      phase = isRaceWeek ? 'race' : 'taper';
      target = peak * TAPER_FACTORS[taperWeeks][taperIndex + (rules.taperWeeks - taperWeeks)];
    } else if (i >= trainingWeeks - peakWeeks) {
      phase = 'peak';
      target = peak;
    } else {
      phase = i < baseWeeks ? 'base' : 'build';
      ({ target, isCutback } = buildTargets[i]);
    }
    target = round500(Math.max(target, isRaceWeek ? goal.distanceKm * 1000 * 1.2 : 0));

    const longRun = round500(Math.min(rules.longCap, target * LONG_SHARE));
    const sessions: KeySession[] = [];

    if (isRaceWeek) {
      sessions.push({
        kind: 'race',
        title: `Prova: ${raceName(goal.distanceKm)}`,
        detail: 'Dias anteriores com 2 ou 3 corridas leves e curtas.',
        ...(racePace && { pace: racePace }),
      });
    } else {
      sessions.push({
        kind: 'long',
        title: 'Longão',
        detail: `${inUnit(longRun)} em ritmo leve`,
        ...(paces && { pace: paces.easy }),
      });
      const progress = trainingWeeks > 1 ? Math.min(1, i / (trainingWeeks - 1)) : 1;
      sessions.push(thresholdSession(thresholdMinutes(phase, progress), paces?.threshold));

      if (phase === 'build' || phase === 'peak') {
        if (isShortRace) {
          const reps = phase === 'peak' ? 6 : 4 + Math.round(progress);
          sessions.push({
            kind: 'interval',
            title: 'Intervalado',
            detail: `${reps}×1000 m com 2–3 min de trote`,
            ...(paces && { pace: paces.interval }),
          });
        } else {
          // Bloco no ritmo de prova dentro do longão: meia 5→8 km (pico 10); maratona 8→14 km (pico 16).
          const marathon = goal.distanceKm > 30;
          const planned =
            phase === 'peak' ? (marathon ? 16 : 10) : marathon ? 8 + Math.round(6 * progress) : 5 + Math.round(3 * progress);
          const blockKm = Math.min(Math.round(longRun / 1000) - 4, planned);
          sessions.push({
            kind: 'racePace',
            title: 'Ritmo de prova',
            detail: `Longão com ${unit === 'km' ? `${Math.max(3, blockKm)} km` : inUnit(Math.max(3, blockKm) * 1000)} no ritmo da prova`,
            ...(racePace && { pace: racePace }),
          });
        }
      }
    }

    weeks.push({ index: i, weekStart, phase, targetMeters: target, longRunMeters: longRun, isCutback, isRaceWeek, sessions });
  }

  return { weeks, shortNotice };
}

/** Andamento da semana pelo diário: km feitos e se o longão foi cumprido. */
export function planProgress(week: TrainingPlanWeek, workouts: readonly Workout[]): { doneMeters: number; longRunDone: boolean } {
  const start = new Date(week.weekStart);
  const from = start.getTime();
  const to = addDays(start, 7).getTime();
  const inWeek = workouts.filter((w) => {
    const t = Date.parse(w.date);
    return w.deletedAt === null && t >= from && t < to;
  });
  return {
    doneMeters: inWeek.reduce((sum, w) => sum + w.distanceMeters, 0),
    longRunDone: !week.isRaceWeek && inWeek.some((w) => w.distanceMeters >= week.longRunMeters * 0.85),
  };
}
