import { EXPORT_MIME_TYPES, type ExportFormat, exportFileName, workoutsToCsv, workoutsToJson } from '../../domain/export';
import { shoeRepository } from '../shoes';
import { workoutRepository } from '../workouts';
import { shareFile } from './share-file';

export async function exportWorkouts(format: ExportFormat, now: Date = new Date()): Promise<void> {
  const workouts = workoutRepository.list();
  const shoes = shoeRepository.listAll();
  const content = format === 'csv' ? workoutsToCsv(workouts, shoes) : workoutsToJson(workouts, now, shoes);
  await shareFile(exportFileName(format, now), content, EXPORT_MIME_TYPES[format]);
}
