import type { DistanceUnit } from './pace/units';
import { type RaceGoal, parseRaceGoal } from './race-goal';
import { isIsoDate } from './workout';

export const PREFERENCES_ID = 'preferences';

/**
 * Preferências que acompanham a conta, como um registro único para o motor de
 * sync. O tema fica de fora: é por aparelho.
 */
export interface SyncedPreferences {
  id: typeof PREFERENCES_ID;
  unit: DistanceUnit;
  weeklyGoalMeters: number | null;
  raceGoal: RaceGoal | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
}

export function parsePreferencesRecord(value: unknown): SyncedPreferences | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  const goalOk =
    p.weeklyGoalMeters === null ||
    (typeof p.weeklyGoalMeters === 'number' && Number.isFinite(p.weeklyGoalMeters) && p.weeklyGoalMeters > 0);
  const raceGoal = p.raceGoal === null ? null : parseRaceGoal(p.raceGoal);
  const valid =
    p.id === PREFERENCES_ID &&
    (p.unit === 'km' || p.unit === 'mi') &&
    goalOk &&
    (p.raceGoal === null || raceGoal !== null) &&
    isIsoDate(p.createdAt) &&
    isIsoDate(p.updatedAt) &&
    p.deletedAt === null;
  return valid ? { ...(p as unknown as SyncedPreferences), raceGoal } : null;
}
