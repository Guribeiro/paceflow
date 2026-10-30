import { type ImportError, parseWorkoutsBackup } from '../../domain/import';
import type { ImportSummary } from '../repositories/workout-repository';
import { routeRepository } from '../routes';
import { shoeRepository } from '../shoes';
import { workoutRepository } from '../workouts';
import { pickTextFile } from './pick-text-file';

export type ImportOutcome =
  | { status: 'canceled' }
  | { status: 'error'; error: ImportError }
  | { status: 'done'; summary: ImportSummary; shoesAdded: number; invalid: number };

/** Escolhe um backup JSON, valida e mescla no diário. */
export async function importWorkoutsFromFile(): Promise<ImportOutcome> {
  // Alguns gerenciadores de arquivo do Android marcam .json como octet-stream.
  const text = await pickTextFile(['application/json', 'application/octet-stream', 'text/plain']);
  if (text === null) return { status: 'canceled' };

  const parsed = parseWorkoutsBackup(text);
  if (!parsed.ok) return { status: 'error', error: parsed.error };

  // Tênis antes dos treinos, para que os shoeId importados já tenham dono.
  const shoes = shoeRepository.importShoes(parsed.value.shoes);
  const summary = workoutRepository.importWorkouts(parsed.value.workouts);
  // Depois dos treinos; um trajeto já guardado no aparelho fica.
  routeRepository.importRoutes(parsed.value.routes);
  return { status: 'done', summary, shoesAdded: shoes.added, invalid: parsed.value.invalid };
}
