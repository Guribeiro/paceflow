import { useMemo, useSyncExternalStore } from 'react';

import { preferencesRepository } from '../data/preferences';
import { goalForWeek } from '../domain/goal-history';
import { type Streak, weeklyStreak } from '../domain/streak';
import { useWeeklyGoal } from './useWeeklyGoal';
import { useWorkouts } from './useWorkouts';

/** Sequência de semanas com a meta batida (ou com treino, sem meta). */
export function useStreak(): Streak {
  const workouts = useWorkouts();
  const [goal] = useWeeklyGoal();
  const history = useSyncExternalStore(preferencesRepository.subscribe, preferencesRepository.getGoalHistory);
  return useMemo(() => weeklyStreak(workouts, (week) => goalForWeek(history, week, goal)), [workouts, history, goal]);
}
