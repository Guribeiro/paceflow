import { useSyncExternalStore } from 'react';

import { preferencesRepository } from '../data/preferences';

/** Meta semanal em metros (null = sem meta). */
export function useWeeklyGoal(): [number | null, (meters: number | null) => void] {
  const goal = useSyncExternalStore(preferencesRepository.subscribe, preferencesRepository.getWeeklyGoal);
  return [goal, preferencesRepository.setWeeklyGoal];
}
