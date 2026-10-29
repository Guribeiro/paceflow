import { type ImportError, parseWorkoutsBackup } from '../../domain/import';
import type { ImportSummary } from '../repositories/workout-repository';
import { workoutRepository } from '../workouts';
import { pickTextFile } from './pick-text-file';

export type ImportOutcome =
  | { status: 'canceled' }
  | { status: 'error'; error: ImportError }
  | { status: 'done'; summary: ImportSummary; invalid: number };

/** Escolhe um backup JSON, valida e mescla no diário. */
export async function importWorkoutsFromFile(): Promise<ImportOutcome> {
  // Alguns gerenciadores de arquivo do Android marcam .json como octet-stream.
  const text = await pickTextFile(['application/json', 'application/octet-stream', 'text/plain']);
  if (text === null) return { status: 'canceled' };

  const parsed = parseWorkoutsBackup(text);
  if (!parsed.ok) return { status: 'error', error: parsed.error };

  const summary = workoutRepository.importWorkouts(parsed.value.workouts);
  return { status: 'done', summary, invalid: parsed.value.invalid };
}
