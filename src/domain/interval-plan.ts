import { formatDuration } from './pace/time-format';
import { type DistanceUnit, KM_PER_MILE } from './pace/units';

/** Como uma fase termina: ao percorrer uma distância ou depois de um tempo em movimento. */
export type Measure = { kind: 'distance'; meters: number } | { kind: 'time'; seconds: number };

/** Treino intervalado montado na aba Correr; fica no aparelho, como as preferências da corrida. */
export interface IntervalPlan {
  warmup: Measure | null;
  reps: number;
  work: Measure;
  /** null: sem recuperação entre os tiros. */
  recovery: Measure | null;
  cooldown: Measure | null;
  /** Pace-alvo dos tiros (s/km); null sem alvo. */
  targetSecondsPerKm: number | null;
}

export type PhaseKind = 'warmup' | 'work' | 'recovery' | 'cooldown';

export interface Phase {
  kind: PhaseKind;
  measure: Measure;
  /** Número do tiro (1…reps) em tiros e recuperações. */
  rep?: number;
}

export const MAX_REPS = 50;
const MIN_METERS = 50;
const MAX_METERS = 10_000;
const MIN_SECONDS = 10;
const MAX_SECONDS = 30 * 60;

export const DEFAULT_INTERVAL_PLAN: IntervalPlan = {
  warmup: { kind: 'time', seconds: 10 * 60 },
  reps: 8,
  work: { kind: 'distance', meters: 400 },
  recovery: { kind: 'time', seconds: 60 },
  cooldown: { kind: 'time', seconds: 5 * 60 },
  targetSecondsPerKm: null,
};

/** Fases em ordem; não há recuperação depois do último tiro. */
export function expandPhases(plan: IntervalPlan): Phase[] {
  const phases: Phase[] = [];
  if (plan.warmup) phases.push({ kind: 'warmup', measure: plan.warmup });
  for (let rep = 1; rep <= plan.reps; rep++) {
    phases.push({ kind: 'work', measure: plan.work, rep });
    if (plan.recovery && rep < plan.reps) phases.push({ kind: 'recovery', measure: plan.recovery, rep });
  }
  if (plan.cooldown) phases.push({ kind: 'cooldown', measure: plan.cooldown });
  return phases;
}

export function parseMeasure(value: unknown): Measure | null {
  if (typeof value !== 'object' || value === null) return null;
  const m = value as Record<string, unknown>;
  if (m.kind === 'distance' && typeof m.meters === 'number' && m.meters >= MIN_METERS && m.meters <= MAX_METERS) {
    return { kind: 'distance', meters: m.meters };
  }
  if (m.kind === 'time' && typeof m.seconds === 'number' && m.seconds >= MIN_SECONDS && m.seconds <= MAX_SECONDS) {
    return { kind: 'time', seconds: m.seconds };
  }
  return null;
}

const optionalMeasure = (value: unknown): Measure | null | undefined =>
  value === null ? null : (parseMeasure(value) ?? undefined);

/** Valida o plano salvo; null se algo estiver fora dos limites. */
export function parseIntervalPlan(value: unknown): IntervalPlan | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  const work = parseMeasure(p.work);
  const [warmup, recovery, cooldown] = [p.warmup, p.recovery, p.cooldown].map(optionalMeasure);
  const target = p.targetSecondsPerKm;
  const targetOk = target === null || (typeof target === 'number' && Number.isFinite(target) && target > 0);
  const repsOk = Number.isInteger(p.reps) && (p.reps as number) >= 1 && (p.reps as number) <= MAX_REPS;
  if (!work || !repsOk || !targetOk || warmup === undefined || recovery === undefined || cooldown === undefined) {
    return null;
  }
  return { warmup, reps: p.reps as number, work, recovery, cooldown, targetSecondsPerKm: target as number | null };
}

/** "400 m", "1,5 km", "30 s", "2 min", "1:30 min". */
export function describeMeasure(measure: Measure): string {
  if (measure.kind === 'distance') {
    return measure.meters < 1000 ? `${measure.meters} m` : `${String(measure.meters / 1000).replace('.', ',')} km`;
  }
  if (measure.seconds < 60) return `${measure.seconds} s`;
  return measure.seconds % 60 === 0 ? `${measure.seconds / 60} min` : `${formatDuration(measure.seconds)} min`;
}

/** "Aquecimento 10 min · 8 × 400 m (rec. 1 min) · alvo 3:50/km · Desaquecimento 5 min". */
export function describePlan(plan: IntervalPlan, unit: DistanceUnit): string {
  const series = `${plan.reps} × ${describeMeasure(plan.work)}${
    plan.recovery ? ` (rec. ${describeMeasure(plan.recovery)})` : ''
  }`;
  const target =
    plan.targetSecondsPerKm === null
      ? null
      : `alvo ${formatDuration(unit === 'mi' ? plan.targetSecondsPerKm * KM_PER_MILE : plan.targetSecondsPerKm)}/${unit}`;
  return [
    plan.warmup ? `Aquecimento ${describeMeasure(plan.warmup)}` : null,
    series,
    target,
    plan.cooldown ? `Desaquecimento ${describeMeasure(plan.cooldown)}` : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}
