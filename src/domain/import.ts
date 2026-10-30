import { type Result, err, ok } from './pace/result';
import { type Route, parseRoute } from './route';
import { type Shoe, parseShoeRecord } from './shoe';
import { type Workout, parseWorkoutRecord } from './workout';

export type ImportError = 'INVALID_JSON' | 'UNSUPPORTED_FORMAT';

export interface ParsedBackup {
  workouts: Workout[];
  shoes: Shoe[];
  /** Trajetos válidos, por id de um treino do próprio backup (v4). */
  routes: Record<string, Route>;
  /** Registros descartados por estarem malformados. */
  invalid: number;
}

const SUPPORTED_SCHEMA_VERSION = 4;

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

  // Até a v3 não há trajetos; um trajeto inválido é só ignorado (não conta em invalid).
  const routes: Record<string, Route> = {};
  const rawRoutes = backup.routes;
  if (typeof rawRoutes === 'object' && rawRoutes !== null && !Array.isArray(rawRoutes)) {
    const ids = new Set(workouts.map((w) => w.id));
    for (const [id, value] of Object.entries(rawRoutes)) {
      const route = ids.has(id) ? parseRoute(value) : null;
      if (route) routes[id] = route;
    }
  }

  return ok({ workouts, shoes, routes, invalid });
}
