import { type Result, err, isPositiveFinite, ok } from './result';

export type RaceId = '5k' | '10k' | 'half' | 'marathon';

export const RACE_DISTANCES: readonly { id: RaceId; label: string; distanceKm: number }[] = [
  { id: '5k', label: '5 km', distanceKm: 5 },
  { id: '10k', label: '10 km', distanceKm: 10 },
  { id: 'half', label: 'Meia Maratona', distanceKm: 21.0975 },
  { id: 'marathon', label: 'Maratona', distanceKm: 42.195 },
];

/** Expoente de fadiga clássico de Peter Riegel (1977). */
export const RIEGEL_EXPONENT = 1.06;

export interface PredictionInput {
  distanceKm: number;
  durationSeconds: number;
}

export interface PredictionOptions {
  /** 'riegel' (padrão) considera fadiga; 'linear' mantém o mesmo pace. */
  method?: 'riegel' | 'linear';
  exponent?: number;
}

export interface RacePrediction {
  id: RaceId;
  label: string;
  distanceKm: number;
  durationSeconds: number;
  secondsPerKm: number;
}

export type PredictionError = 'INVALID_DISTANCE' | 'INVALID_DURATION' | 'INVALID_EXPONENT';

export function predictRaceTimes(
  { distanceKm, durationSeconds }: PredictionInput,
  { method = 'riegel', exponent = RIEGEL_EXPONENT }: PredictionOptions = {},
): Result<RacePrediction[], PredictionError> {
  if (!isPositiveFinite(distanceKm)) return err('INVALID_DISTANCE');
  if (!isPositiveFinite(durationSeconds)) return err('INVALID_DURATION');
  if (!isPositiveFinite(exponent)) return err('INVALID_EXPONENT');

  const k = method === 'linear' ? 1 : exponent;

  return ok(
    RACE_DISTANCES.map((race) => {
      const predicted = durationSeconds * Math.pow(race.distanceKm / distanceKm, k);
      return { ...race, durationSeconds: predicted, secondsPerKm: predicted / race.distanceKm };
    }),
  );
}
