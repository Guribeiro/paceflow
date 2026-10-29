import { type Result, err, isPositiveFinite, ok } from './result';
import { type DistanceUnit, KM_PER_MILE, toKilometers } from './units';

export interface PaceInput {
  distance: number;
  unit: DistanceUnit;
  durationSeconds: number;
}

export interface PaceResult {
  distanceKm: number;
  secondsPerKm: number;
  secondsPerMile: number;
  kmh: number;
  mph: number;
}

export type PaceError = 'INVALID_DISTANCE' | 'INVALID_DURATION';

export function calculatePace({ distance, unit, durationSeconds }: PaceInput): Result<PaceResult, PaceError> {
  if (!isPositiveFinite(distance)) return err('INVALID_DISTANCE');
  if (!isPositiveFinite(durationSeconds)) return err('INVALID_DURATION');

  const distanceKm = toKilometers(distance, unit);
  const secondsPerKm = durationSeconds / distanceKm;
  const kmh = distanceKm / (durationSeconds / 3600);

  return ok({
    distanceKm,
    secondsPerKm,
    secondsPerMile: secondsPerKm * KM_PER_MILE,
    kmh,
    mph: kmh / KM_PER_MILE,
  });
}
