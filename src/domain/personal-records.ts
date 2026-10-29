import { RACE_DISTANCES, type RaceId } from './pace/predictor';
import type { Workout } from './workout';

/** Um treino conta para a distância se tiver até 3% a mais (GPS e voltas de quarteirão). */
const TOLERANCE = 1.03;

export interface PersonalRecord {
  id: RaceId;
  label: string;
  distanceKm: number;
  /** Tempo na distância exata, normalizado pelo pace do treino. */
  seconds: number;
  workoutId: string;
  date: string;
}

/** Melhor marca em cada distância de prova, na ordem de RACE_DISTANCES. */
export function personalRecords(workouts: readonly Workout[]): PersonalRecord[] {
  const active = workouts.filter((w) => w.deletedAt === null);
  const records: PersonalRecord[] = [];

  for (const race of RACE_DISTANCES) {
    const meters = race.distanceKm * 1000;
    let best: PersonalRecord | null = null;
    for (const w of active) {
      if (w.distanceMeters < meters || w.distanceMeters > meters * TOLERANCE) continue;
      const seconds = (w.durationSeconds * meters) / w.distanceMeters;
      // Empate: fica quem fez o tempo primeiro.
      const better = !best || seconds < best.seconds || (seconds === best.seconds && w.date < best.date);
      if (better) {
        best = { id: race.id, label: race.label, distanceKm: race.distanceKm, seconds, workoutId: w.id, date: w.date };
      }
    }
    if (best) records.push(best);
  }
  return records;
}

/** Recordes de `after` que não existiam ou eram piores em `before` (para comemorar ao salvar). */
export function newRecords(before: readonly PersonalRecord[], after: readonly PersonalRecord[]): PersonalRecord[] {
  return after.filter((record) => {
    const previous = before.find((r) => r.id === record.id);
    return !previous || record.seconds < previous.seconds;
  });
}
