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
  createdAt: string;
  updatedAt: string;
  /** Soft delete: preserva o registro para uma futura sincronização. */
  deletedAt: string | null;
}

export const isTerrain = (value: unknown): value is Terrain =>
  typeof value === 'string' && (TERRAINS as readonly string[]).includes(value);

export const isValidRpe = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= RPE_MIN && value <= RPE_MAX;
