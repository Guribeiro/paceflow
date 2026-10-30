import { EXPORT_MIME_TYPES, type ExportFormat, exportFileName, workoutsToCsv, workoutsToJson } from '../../domain/export';
import type { Route } from '../../domain/route';
import { routeRepository } from '../routes';
import { shoeRepository } from '../shoes';
import { workoutRepository } from '../workouts';
import { shareFile } from './share-file';

/** Trajetos guardados dos treinos ativos (só eles vão para o backup). */
function routes(workouts: readonly { id: string; deletedAt: string | null }[]): Record<string, Route> {
  const result: Record<string, Route> = {};
  for (const w of workouts) {
    const route = w.deletedAt === null ? routeRepository.get(w.id) : null;
    if (route) result[w.id] = route;
  }
  return result;
}

export async function exportWorkouts(format: ExportFormat, now: Date = new Date()): Promise<void> {
  const workouts = workoutRepository.list();
  const shoes = shoeRepository.listAll();
  const content = format === 'csv' ? workoutsToCsv(workouts, shoes) : workoutsToJson(workouts, now, shoes, routes(workouts));
  await shareFile(exportFileName(format, now), content, EXPORT_MIME_TYPES[format]);
}
