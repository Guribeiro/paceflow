export type DistanceUnit = 'km' | 'mi';

/** Milha internacional, por definição. */
export const KM_PER_MILE = 1.609344;

export function toKilometers(distance: number, unit: DistanceUnit): number {
  return unit === 'mi' ? distance * KM_PER_MILE : distance;
}

export function toMiles(km: number): number {
  return km / KM_PER_MILE;
}
