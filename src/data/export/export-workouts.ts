import { EXPORT_MIME_TYPES, type ExportFormat, exportFileName, workoutsToCsv, workoutsToJson } from '../../domain/export';
import { workoutRepository } from '../workouts';
import { shareFile } from './share-file';

export async function exportWorkouts(format: ExportFormat, now: Date = new Date()): Promise<void> {
  const workouts = workoutRepository.list();
  const content = format === 'csv' ? workoutsToCsv(workouts) : workoutsToJson(workouts, now);
  await shareFile(exportFileName(format, now), content, EXPORT_MIME_TYPES[format]);
}
