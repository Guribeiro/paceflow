export const TERRAINS = ['rua', 'pista', 'esteira'] as const;
export type Terrain = (typeof TERRAINS)[number];

export const TERRAIN_LABELS: Record<Terrain, string> = {
  rua: 'Rua',
  pista: 'Pista',
  esteira: 'Esteira',
};

export const RPE_MIN = 1;
export const RPE_MAX = 10;
export const NOTE_MAX_LENGTH = 280;

export interface Workout {
  id: string;
  /** Quando o treino aconteceu (ISO 8601). */
  date: string;
  distanceMeters: number;
  durationSeconds: number;
  terrain: Terrain;
  /** Percepção de esforço, 1–10. */
  rpe?: number;
  note?: string;
  /** Tênis usado (id de Shoe). */
  shoeId?: string;
  createdAt: string;
  updatedAt: string;
  /** Soft delete: preserva o registro para uma futura sincronização. */
  deletedAt: string | null;
}

export const isTerrain = (value: unknown): value is Terrain =>
  typeof value === 'string' && (TERRAINS as readonly string[]).includes(value);

export const isValidRpe = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= RPE_MIN && value <= RPE_MAX;

export const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

// O id vira parte da chave no armazenamento; o MMKV na web rejeita "\".
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;

export const isSafeId = (value: unknown): value is string => typeof value === 'string' && SAFE_ID.test(value);

/** Valida um treino vindo do armazenamento ou de um backup; null se inválido. */
export function parseWorkoutRecord(value: unknown): Workout | null {
  if (typeof value !== 'object' || value === null) return null;
  const w = value as Record<string, unknown>;
  const valid =
    isSafeId(w.id) &&
    isIsoDate(w.date) &&
    isIsoDate(w.createdAt) &&
    isIsoDate(w.updatedAt) &&
    (w.deletedAt === null || isIsoDate(w.deletedAt)) &&
    isPositiveNumber(w.distanceMeters) &&
    isPositiveNumber(w.durationSeconds) &&
    isTerrain(w.terrain) &&
    (w.rpe === undefined || isValidRpe(w.rpe)) &&
    (w.note === undefined || (typeof w.note === 'string' && w.note.length <= NOTE_MAX_LENGTH)) &&
    (w.shoeId === undefined || isSafeId(w.shoeId));
  return valid ? (w as unknown as Workout) : null;
}
