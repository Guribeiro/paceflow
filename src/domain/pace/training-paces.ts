import { predictRaceTimes } from './predictor';
import { type Result, err, isPositiveFinite, ok } from './result';

/**
 * Paces de treino pelas fórmulas públicas de Daniels e Gilbert. O índice de
 * condicionamento é o VO2 do esforço dividido pela fração do VO2máx que dá
 * para sustentar por aquele tempo; cada zona é uma porcentagem desse índice.
 */

const MIN_DISTANCE_KM = 1.5;
const MAX_DISTANCE_KM = 42.195;
const MIN_DURATION_S = 3 * 60;
const MAX_DURATION_S = 6 * 60 * 60;

// Porcentagens calibradas contra as tabelas de Daniels para o índice 50
// (5 km em 19:57): leve 5:08–5:38, limiar 4:15, intervalado 3:55, tiros 3:40.
const EASY = { slowest: 0.62, fastest: 0.7 };
const THRESHOLD = 0.88;
const INTERVAL = 0.975;
const REPETITION = 1.05;

/** VO2 (ml/kg/min) a uma velocidade em m/min. */
const vo2AtVelocity = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v;

/** Fração do VO2máx sustentável por `minutes` minutos. */
const fractionSustainable = (minutes: number) =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);

/** Velocidade (m/min) cujo custo é `vo2`: raiz positiva de 0,000104v² + 0,182258v − (4,6 + vo2) = 0. */
function velocityForVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

const paceAt = (index: number, fraction: number) => 60_000 / velocityForVo2(index * fraction);

export function fitnessIndex(distanceKm: number, durationSeconds: number): number {
  const minutes = durationSeconds / 60;
  return vo2AtVelocity((distanceKm * 1000) / minutes) / fractionSustainable(minutes);
}

/** Faixa de pace em s/km; `fastest` = limite rápido (zonas de valor único têm os dois iguais). */
export interface PaceRange {
  fastest: number;
  slowest: number;
}

export type TrainingZone = 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition';
export type TrainingPaces = Record<TrainingZone, PaceRange> & { index: number };
export type TrainingPacesError = 'DISTANCE_OUT_OF_RANGE' | 'DURATION_OUT_OF_RANGE';

const single = (secondsPerKm: number): PaceRange => ({ fastest: secondsPerKm, slowest: secondsPerKm });

export function trainingPaces(distanceKm: number, durationSeconds: number): Result<TrainingPaces, TrainingPacesError> {
  if (!isPositiveFinite(distanceKm) || distanceKm < MIN_DISTANCE_KM || distanceKm > MAX_DISTANCE_KM) {
    return err('DISTANCE_OUT_OF_RANGE');
  }
  if (!isPositiveFinite(durationSeconds) || durationSeconds < MIN_DURATION_S || durationSeconds > MAX_DURATION_S) {
    return err('DURATION_OUT_OF_RANGE');
  }

  const index = fitnessIndex(distanceKm, durationSeconds);
  // Maratona: a mesma projeção (Riegel) mostrada na Projeção de provas.
  const prediction = predictRaceTimes({ distanceKm, durationSeconds });
  const marathon = prediction.ok ? prediction.value.find((r) => r.id === 'marathon')!.secondsPerKm : paceAt(index, 0.82);

  return ok({
    index,
    easy: { fastest: paceAt(index, EASY.fastest), slowest: paceAt(index, EASY.slowest) },
    marathon: single(marathon),
    threshold: single(paceAt(index, THRESHOLD)),
    interval: single(paceAt(index, INTERVAL)),
    repetition: single(paceAt(index, REPETITION)),
  });
}
