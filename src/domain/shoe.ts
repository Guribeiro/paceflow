import { isIsoDate, isSafeId } from './workout';

export const SHOE_NAME_MAX_LENGTH = 60;
/** Faixa comum de troca: 600 a 800 km. */
export const DEFAULT_SHOE_LIMIT_METERS = 700_000;

export interface Shoe {
  id: string;
  name: string;
  /** Km já rodados antes de entrar no app. */
  initialMeters: number;
  limitMeters: number;
  /** Aposentado: some das escolhas, mas mantém o histórico. */
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const isValidShoeName = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= SHOE_NAME_MAX_LENGTH;

const isNonNegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isOptionalDate = (v: unknown) => v === null || isIsoDate(v);

/** Valida um tênis vindo do armazenamento, de um backup ou do servidor; null se inválido. */
export function parseShoeRecord(value: unknown): Shoe | null {
  if (typeof value !== 'object' || value === null) return null;
  const s = value as Record<string, unknown>;
  const valid =
    isSafeId(s.id) &&
    isValidShoeName(s.name) &&
    isNonNegative(s.initialMeters) &&
    isPositive(s.limitMeters) &&
    isOptionalDate(s.retiredAt) &&
    isIsoDate(s.createdAt) &&
    isIsoDate(s.updatedAt) &&
    isOptionalDate(s.deletedAt);
  return valid ? (s as unknown as Shoe) : null;
}

export const isActiveShoe = (shoe: Shoe) => shoe.deletedAt === null && shoe.retiredAt === null;
