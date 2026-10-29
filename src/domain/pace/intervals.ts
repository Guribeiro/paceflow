import { isPositiveFinite } from './result';
import { formatDuration, parseDuration } from './time-format';
import { type DistanceUnit, KM_PER_MILE } from './units';

export const TRACK_DISTANCES = [200, 400, 800, 1000] as const;

/** Tempo de cada distância de pista para um pace em s/km. */
export function splitTimes(
  secondsPerKm: number,
  distancesMeters: readonly number[] = TRACK_DISTANCES,
): { distanceMeters: number; seconds: number }[] {
  return distancesMeters.map((distanceMeters) => ({ distanceMeters, seconds: (secondsPerKm * distanceMeters) / 1000 }));
}

export interface LapStats {
  count: number;
  totalSeconds: number;
  average: number;
  best: number;
  worst: number;
  /** Índices dentro das voltas válidas. */
  bestIndex: number;
  worstIndex: number;
  /** Pior menos melhor: quão constante foi a série. */
  spread: number;
  /** Desvio-padrão populacional, em segundos. */
  stdDev: number;
  secondsPerKm: number;
}

/** Estatísticas de uma série de tiros iguais; null sem voltas válidas. */
export function lapStats(laps: readonly number[], repDistanceMeters: number): LapStats | null {
  const valid = laps.filter(isPositiveFinite);
  if (valid.length === 0 || !isPositiveFinite(repDistanceMeters)) return null;

  const totalSeconds = valid.reduce((sum, s) => sum + s, 0);
  const average = totalSeconds / valid.length;
  const best = Math.min(...valid);
  const worst = Math.max(...valid);
  const variance = valid.reduce((sum, s) => sum + (s - average) ** 2, 0) / valid.length;

  return {
    count: valid.length,
    totalSeconds,
    average,
    best,
    worst,
    bestIndex: valid.indexOf(best),
    worstIndex: valid.indexOf(worst),
    spread: worst - best,
    stdDev: Math.sqrt(variance),
    secondsPerKm: average / (repDistanceMeters / 1000),
  };
}

/** Nota automática da série, ex.: "8×400 m · média 1:32 (3:50/km) · variação 4 s". */
export function describeSeries(stats: LapStats, repDistanceMeters: number, unit: DistanceUnit): string {
  const pace = unit === 'mi' ? stats.secondsPerKm * KM_PER_MILE : stats.secondsPerKm;
  return [
    `${stats.count}×${repDistanceMeters} m`,
    `média ${formatDuration(stats.average)} (${formatDuration(pace)}/${unit})`,
    `variação ${Math.round(stats.spread)} s`,
  ].join(' · ');
}

/**
 * Tempo de um tiro: aceita segundos soltos ("92", "92,5"), comum na pista, além
 * de m:ss ("1:32"). Diferente de parseDuration, que exige m:ss para não
 * confundir "25" (minutos? segundos?) na calculadora de ritmo.
 */
export function parseLapTime(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    return seconds > 0 ? seconds : null;
  }
  const parsed = parseDuration(text);
  return parsed.ok && parsed.value > 0 ? parsed.value : null;
}
