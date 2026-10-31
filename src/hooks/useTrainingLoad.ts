import { useMemo } from 'react';

import { type LoadStatus, loadStatus } from '../domain/training-load';
import { useCurrentDay } from './useCurrentDay';
import { useWorkouts } from './useWorkouts';

/** Carga dos últimos 7 dias comparada com a média das últimas 4 semanas. */
export function useTrainingLoad(): LoadStatus {
  const workouts = useWorkouts();
  const today = useCurrentDay();
  return useMemo(
    () => loadStatus(workouts),
    // today: a janela de 7 dias anda na virada do dia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workouts, today],
  );
}
