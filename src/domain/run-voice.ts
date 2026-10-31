import { type Measure, type Phase, expandPhases } from './interval-plan';
import { completedWork } from './interval-results';
import { spokenDuration } from './pace/time-format';
import { KM_PER_MILE } from './pace/units';
import type { PhaseResult, RunState } from './run-tracker';
import { splitUnit } from './workout';

/** O que a voz fala a cada parcial; fica no aparelho, como os lembretes. */
export interface VoicePreferences {
  enabled: boolean;
  /** Tempo da parcial que acabou de fechar. */
  splitTime: boolean;
  /** Pace médio da corrida até aqui. */
  averagePace: boolean;
  /** Tempo total em movimento. */
  totalTime: boolean;
}

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  enabled: true,
  splitTime: true,
  averagePace: true,
  totalTime: false,
};

export function parseVoicePreferences(value: unknown): VoicePreferences | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  const keys = ['enabled', 'splitTime', 'averagePace', 'totalTime'] as const;
  if (!keys.every((key) => typeof p[key] === 'boolean')) return null;
  return {
    enabled: p.enabled as boolean,
    splitTime: p.splitTime as boolean,
    averagePace: p.averagePace as boolean,
    totalTime: p.totalTime as boolean,
  };
}

/**
 * Texto falado quando a última parcial fecha, ex.: "Quilômetro 3. Parcial: 5
 * minutos e 12 segundos. Pace médio: 5 minutos e 8 segundos por quilômetro."
 * null sem parcial fechada ou com a voz desligada.
 */
export function splitAnnouncement(
  state: Pick<RunState, 'splits' | 'splitMeters'>,
  prefs: VoicePreferences,
): string | null {
  const count = state.splits.length;
  if (!prefs.enabled || count === 0) return null;

  const km = splitUnit(state.splitMeters) === 'km';
  const closedAt = state.splits[count - 1] / 1000;
  const previous = count > 1 ? state.splits[count - 2] / 1000 : 0;
  const parts = [`${km ? 'Quilômetro' : 'Milha'} ${count}.`];
  if (prefs.splitTime) parts.push(`Parcial: ${spokenDuration(closedAt - previous)}.`);
  // Cada parcial tem exatamente uma unidade: o pace médio é o tempo dividido pelo número de parciais.
  if (prefs.averagePace) parts.push(`Pace médio: ${spokenDuration(closedAt / count)} por ${km ? 'quilômetro' : 'milha'}.`);
  if (prefs.totalTime) parts.push(`Tempo total: ${spokenDuration(closedAt)}.`);
  return parts.join(' ');
}

/** "Pausa automática." ao parar e "Retomando." ao voltar; null sem mudança ou com a voz desligada. */
export function autoPauseAnnouncement(
  before: Pick<RunState, 'autoPaused'>,
  after: Pick<RunState, 'autoPaused' | 'status'>,
  prefs: VoicePreferences,
): string | null {
  if (!prefs.enabled || after.status !== 'running' || before.autoPaused === after.autoPaused) return null;
  return after.autoPaused ? 'Pausa automática.' : 'Retomando.';
}

/** Faltando isso numa fase por tempo antes de um tiro, a voz avisa. */
const HEADS_UP_SECONDS = 10;
/** Diferença do pace-alvo aceita como "no ritmo". */
const PACE_TOLERANCE = 0.03;

/** "400 metros", "1,5 quilômetro", "1 minuto e 30 segundos". */
export function spokenMeasure(measure: Measure): string {
  if (measure.kind === 'time') return spokenDuration(measure.seconds);
  if (measure.meters < 1000) return `${measure.meters} metros`;
  const km = measure.meters / 1000;
  return `${String(km).replace('.', ',')} ${km === 1 ? 'quilômetro' : 'quilômetros'}`;
}

function spokenPace(secondsPerKm: number, km: boolean): string {
  return `${spokenDuration(km ? secondsPerKm : secondsPerKm * KM_PER_MILE)} por ${km ? 'quilômetro' : 'milha'}`;
}

/** Início de uma fase, ex.: "Tiro 3 de 8: 400 metros." */
export function phaseStartText(phase: Phase, reps: number): string {
  const size = spokenMeasure(phase.measure);
  switch (phase.kind) {
    case 'warmup':
      return `Aquecimento: ${size}.`;
    case 'work':
      return `Tiro ${phase.rep} de ${reps}: ${size}.`;
    case 'recovery':
      return `Recuperação: ${size}.`;
    case 'cooldown':
      return `Desaquecimento: ${size}.`;
  }
}

/** Resultado de um tiro, ex.: "Tiro 2: 1 minuto e 32 segundos, pace 3 minutos e 50 segundos por quilômetro." */
function workResultText(result: PhaseResult, km: boolean): string {
  const pace = result.meters >= 1 ? `, pace ${spokenPace(result.ms / 1000 / (result.meters / 1000), km)}` : '';
  return `Tiro ${result.rep}: ${spokenDuration(result.ms / 1000)}${pace}.`;
}

/**
 * O que a voz fala no intervalado entre dois estados: o tiro que acabou e a
 * fase que começa, o aviso de 10 s antes de um tiro e o pace na metade do
 * tiro (com pace-alvo). null sem nada a dizer ou com a voz desligada.
 */
export function intervalAnnouncement(before: RunState, after: RunState, prefs: VoicePreferences): string | null {
  const was = before.intervals;
  const now = after.intervals;
  if (!prefs.enabled || !was || !now || after.status !== 'running') return null;
  const km = splitUnit(after.splitMeters) === 'km';
  const phases = expandPhases(now.plan);
  const parts: string[] = [];

  if (now.index > was.index) {
    const lastWork = completedWork(now.results.slice(was.results.length)).at(-1);
    if (lastWork) parts.push(workResultText(lastWork, km));
    const phase = phases[now.index];
    if (phase) {
      parts.push(phaseStartText(phase, now.plan.reps));
    } else {
      const reps = completedWork(now.results);
      const average = reps.length > 0 ? reps.reduce((sum, r) => sum + r.ms, 0) / reps.length / 1000 : null;
      parts.push(`Treino concluído.${average !== null ? ` Média dos tiros: ${spokenDuration(average)}.` : ''} Pode finalizar a corrida.`);
    }
    return parts.join(' ');
  }

  const phase = phases[now.index];
  if (!phase) return null;

  // Fase por tempo antes de um tiro: avisa quando faltam 10 s.
  if (phase.measure.kind === 'time' && phases[now.index + 1]?.kind === 'work') {
    const end = now.phaseStart.movingMs + phase.measure.seconds * 1000;
    const limit = end - HEADS_UP_SECONDS * 1000;
    if (was.at.movingMs < limit && now.at.movingMs >= limit) return `Tiro em ${HEADS_UP_SECONDS} segundos.`;
  }

  const target = now.plan.targetSecondsPerKm;
  if (phase.kind === 'work' && !was.paceChecked && now.paceChecked && now.midPace !== null && target !== null) {
    const diff = now.midPace / target - 1;
    if (Math.abs(diff) <= PACE_TOLERANCE) return 'No ritmo.';
    return `${diff > 0 ? 'Acelere' : 'Segure'}: ${spokenPace(now.midPace, km)}, alvo ${spokenPace(target, km)}.`;
  }
  return null;
}
