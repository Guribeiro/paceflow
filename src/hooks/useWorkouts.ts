import { useSyncExternalStore } from 'react';

import { workoutRepository } from '../data/workouts';

export function useWorkouts() {
  return useSyncExternalStore(workoutRepository.subscribe, workoutRepository.list);
}
