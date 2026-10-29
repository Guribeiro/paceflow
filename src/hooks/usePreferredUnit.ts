import { useSyncExternalStore } from 'react';

import { preferencesRepository } from '../data/preferences';
import type { DistanceUnit } from '../domain/pace';

export function usePreferredUnit(): [DistanceUnit, (unit: DistanceUnit) => void] {
  const unit = useSyncExternalStore(preferencesRepository.subscribe, preferencesRepository.getUnit);
  return [unit, preferencesRepository.setUnit];
}
