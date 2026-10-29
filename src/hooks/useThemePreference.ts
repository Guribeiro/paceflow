import { useSyncExternalStore } from 'react';

import { preferencesRepository } from '../data/preferences';
import type { ThemePreference } from '../data/repositories/preferences-repository';

export function useThemePreference(): [ThemePreference, (theme: ThemePreference) => void] {
  const theme = useSyncExternalStore(preferencesRepository.subscribe, preferencesRepository.getTheme);
  return [theme, preferencesRepository.setTheme];
}
