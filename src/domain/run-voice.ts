import { spokenDuration } from './pace/time-format';
import type { RunState } from './run-tracker';
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
