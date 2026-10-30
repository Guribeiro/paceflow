import { useCallback, useSyncExternalStore } from 'react';

import { routeRepository } from '../data/routes';
import type { Route } from '../domain/route';

/** Há trajeto salvo para o treino? Atualiza quando um trajeto é gravado, importado ou apagado. */
export function useHasRoute(workoutId: string): boolean {
  const has = useCallback(() => routeRepository.has(workoutId), [workoutId]);
  return useSyncExternalStore(routeRepository.subscribe, has);
}

/** Trajeto salvo do treino (null sem trajeto ou corrompido); referência estável até mudar. */
export function useRoute(workoutId: string): Route | null {
  const get = useCallback(() => routeRepository.get(workoutId), [workoutId]);
  return useSyncExternalStore(routeRepository.subscribe, get);
}
