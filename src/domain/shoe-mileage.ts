import { type Shoe, isActiveShoe } from './shoe';
import type { Workout } from './workout';

export type ShoeStatus = 'ok' | 'attention' | 'replace';

/** A partir desta fração do limite, o tênis está "perto da troca". */
export const SHOE_ATTENTION_RATIO = 0.9;

export function shoeMileage(shoe: Shoe, workouts: readonly Workout[]): number {
  return workouts.reduce(
    (total, w) => (w.deletedAt === null && w.shoeId === shoe.id ? total + w.distanceMeters : total),
    shoe.initialMeters,
  );
}

export function shoeStatus(meters: number, limitMeters: number): ShoeStatus {
  if (meters >= limitMeters) return 'replace';
  if (meters >= limitMeters * SHOE_ATTENTION_RATIO) return 'attention';
  return 'ok';
}

/** Tênis do treino mais recente (se ainda ativo); sem histórico, o único ativo. */
export function suggestedShoeId(workouts: readonly Workout[], shoes: readonly Shoe[]): string | undefined {
  const active = new Set(shoes.filter(isActiveShoe).map((s) => s.id));
  const latest = workouts
    .filter((w) => w.deletedAt === null && w.shoeId !== undefined && active.has(w.shoeId))
    .reduce<Workout | null>((acc, w) => (!acc || Date.parse(w.date) > Date.parse(acc.date) ? w : acc), null);
  if (latest) return latest.shoeId;
  return active.size === 1 ? [...active][0] : undefined;
}
