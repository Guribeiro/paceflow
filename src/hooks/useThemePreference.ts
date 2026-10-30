import { colorScheme } from 'nativewind';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { preferencesRepository } from '../data/preferences';
import type { ThemePreference } from '../data/repositories/preferences-repository';

/**
 * Aplica o tema salvo antes do primeiro render (chamado no topo do _layout e ao trocar o tema).
 * O efeito do useApplyTheme só roda depois da primeira pintura, então sem isto
 * o app abria por um instante no tema do sistema e depois trocava.
 * Na web o tema depende do navegador e continua resolvido pelo hook.
 */
export function applyStoredTheme() {
  if (Platform.OS !== 'web') colorScheme.set(preferencesRepository.getTheme());
}

/** Grava o tema e já pede a troca, sem esperar o re-render (a troca nativa leva um tempo). */
function setTheme(theme: ThemePreference) {
  preferencesRepository.setTheme(theme);
  applyStoredTheme();
}

export function useThemePreference(): [ThemePreference, (theme: ThemePreference) => void] {
  const theme = useSyncExternalStore(preferencesRepository.subscribe, preferencesRepository.getTheme);
  return [theme, setTheme];
}
