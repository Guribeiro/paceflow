import { type Result, err, ok } from './pace/result';
import { type Shoe, parseShoeRecord } from './shoe';
import { type Workout, parseWorkoutRecord } from './workout';

export type ImportError = 'INVALID_JSON' | 'UNSUPPORTED_FORMAT';

export interface ParsedBackup {
  workouts: Workout[];
  shoes: Shoe[];
  /** Registros descartados por estarem malformados. */
  invalid: number;
}

const SUPPORTED_SCHEMA_VERSION = 2;

/** Lê um backup gerado por workoutsToJson. Registros inválidos são descartados e contados. */
export function parseWorkoutsBackup(json: string): Result<ParsedBackup, ImportError> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return err('INVALID_JSON');
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) return err('UNSUPPORTED_FORMAT');
  const backup = data as Record<string, unknown>;
  if (
    backup.app !== 'PaceFlow' ||
    typeof backup.schemaVersion !== 'number' ||
    backup.schemaVersion > SUPPORTED_SCHEMA_VERSION ||
    !Array.isArray(backup.workouts)
  ) {
    return err('UNSUPPORTED_FORMAT');
  }

  const workouts: Workout[] = [];
  let invalid = 0;
  for (const item of backup.workouts) {
    // O backup não traz deletedAt; importar nunca remove treinos.
    const workout =
      typeof item === 'object' && item !== null ? parseWorkoutRecord({ ...item, deletedAt: null }) : null;
    if (workout) workouts.push(workout);
    else invalid++;
  }
  const shoes: Shoe[] = [];
  // v1 não tem tênis; em v2 a lista é opcional.
  for (const item of Array.isArray(backup.shoes) ? backup.shoes : []) {
    const shoe = typeof item === 'object' && item !== null ? parseShoeRecord({ ...item, deletedAt: null }) : null;
    if (shoe) shoes.push(shoe);
    else invalid++;
  }

  return ok({ workouts, shoes, invalid });
}
