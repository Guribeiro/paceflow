/**
 * Textos da notificação da corrida (o equivalente Android de uma Live
 * Activity). Puro: a camada de dados só posta o que sai daqui. A unidade é a
 * das parciais da corrida (1000 m ou uma milha), sem ler preferências.
 */

import { type DistanceUnit, KM_PER_MILE, formatDistance, formatDuration } from './pace';
import { type RunState, currentPace, elapsedMs, isAutoPaused, splitDurations } from './run-tracker';
import { splitUnit } from './workout';

export type RunNotificationStatus = 'running' | 'paused' | 'autoPaused';

export interface RunNotificationProps {
  status: RunNotificationStatus;
  /** Tempo em movimento, ex.: "23:41". */
  time: string;
  /** Distância sem unidade, ex.: "4,32". */
  distance: string;
  unit: DistanceUnit;
  /** Pace atual por unidade, ex.: "5:12"; null parado ou sem deslocamento suficiente. */
  pace: string | null;
  /** Última parcial fechada, ex.: "Parcial 4: 5:08"; null antes da primeira. */
  lastSplit: string | null;
  /** Fração (0–1) da parcial em andamento. */
  splitProgress: number;
}

export interface RunSummaryProps {
  distance: string;
  unit: DistanceUnit;
  time: string;
  /** Pace médio por unidade; null quando a corrida foi curta demais para ter um. */
  pace: string | null;
}

const perUnit = (secondsPerKm: number, unit: DistanceUnit) => (unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);

/** Abaixo disso o pace médio é ruído do GPS (o mesmo piso de salvar a corrida). */
const MIN_SUMMARY_METERS = 10;

export function runNotificationProps(state: RunState, now: number): RunNotificationProps {
  const unit = splitUnit(state.splitMeters);
  const paused = state.status === 'paused';
  const autoPaused = !paused && isAutoPaused(state, now);
  const pace = paused || autoPaused ? null : currentPace(state);
  const splits = splitDurations(state);
  const last = splits.at(-1);
  return {
    status: paused ? 'paused' : autoPaused ? 'autoPaused' : 'running',
    time: formatDuration(Math.floor(elapsedMs(state, now) / 1000)),
    distance: formatDistance(state.distanceMeters, unit),
    unit,
    pace: pace === null ? null : formatDuration(Math.round(perUnit(pace, unit))),
    lastSplit: last === undefined ? null : `Parcial ${splits.length}: ${formatDuration(Math.round(last))}`,
    splitProgress: Math.min(1, Math.max(0, (state.distanceMeters % state.splitMeters) / state.splitMeters)),
  };
}

export function runSummaryProps(state: RunState): RunSummaryProps {
  const unit = splitUnit(state.splitMeters);
  const seconds = Math.round(state.movingMs / 1000);
  const enough = state.distanceMeters >= MIN_SUMMARY_METERS && seconds > 0;
  return {
    distance: formatDistance(state.distanceMeters, unit),
    unit,
    time: formatDuration(seconds),
    pace: enough ? formatDuration(Math.round(perUnit(seconds / (state.distanceMeters / 1000), unit))) : null,
  };
}

/**
 * Tudo o que aparece na notificação: muda só quando algum texto ou bloco da
 * barra muda, para não repostar a cada amostra sem diferença visível.
 */
export function notificationKey(props: RunNotificationProps): string {
  const blocks = Math.floor(props.splitProgress * 10);
  return [props.status, props.time, props.distance, props.unit, props.pace, props.lastSplit, blocks].join('|');
}
