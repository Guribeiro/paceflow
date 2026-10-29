export type DistanceUnit = 'km' | 'mi';

/** Milha internacional, por definição. */
export const KM_PER_MILE = 1.609344;

export function toKilometers(distance: number, unit: DistanceUnit): number {
  return unit === 'mi' ? distance * KM_PER_MILE : distance;
}

export function toMiles(km: number): number {
  return km / KM_PER_MILE;
}

/** Metros → distância na unidade escolhida. */
export function distanceInUnit(meters: number, unit: DistanceUnit): number {
  const km = meters / 1000;
  return unit === 'mi' ? toMiles(km) : km;
}

/** Distância com 2 casas e vírgula decimal, ex.: "21,10". */
export function formatDistance(meters: number, unit: DistanceUnit): string {
  return distanceInUnit(meters, unit).toFixed(2).replace('.', ',');
}
