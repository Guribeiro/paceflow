import { useSyncExternalStore } from 'react';

import { preferencesRepository } from '../data/preferences';
import type { RaceGoal } from '../domain/race-goal';

export function useRaceGoal(): [RaceGoal | null, (goal: RaceGoal | null) => void] {
  const goal = useSyncExternalStore(preferencesRepository.subscribe, preferencesRepository.getRaceGoal);
  return [goal, preferencesRepository.setRaceGoal];
}
