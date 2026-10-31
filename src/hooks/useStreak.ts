import { useMemo, useSyncExternalStore } from 'react';

import { preferencesRepository } from '../data/preferences';
import { goalForWeek } from '../domain/goal-history';
import { type Streak, weeklyStreak } from '../domain/streak';
import { useCurrentWeek } from './useCurrentWeek';
import { useWeeklyGoal } from './useWeeklyGoal';
import { useWorkouts } from './useWorkouts';

/** Sequência de semanas com a meta batida (ou com treino, sem meta). */
export function useStreak(): Streak {
  const workouts = useWorkouts();
  const [goal] = useWeeklyGoal();
  const history = useSyncExternalStore(preferencesRepository.subscribe, preferencesRepository.getGoalHistory);
  const currentWeek = useCurrentWeek();
  return useMemo(
    () => weeklyStreak(workouts, (week) => goalForWeek(history, week, goal)),
    // currentWeek: recalcula na virada da semana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workouts, history, goal, currentWeek],
  );
}
