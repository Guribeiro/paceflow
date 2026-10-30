import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { ensureRunUpdates } from '../data/run-session';

/**
 * Corrida ativa ao abrir ou voltar ao app: se o Android encerrou o serviço de
 * localização, volta a gravar (o sistema só permite isso com o app à frente).
 */
export function useRunRecovery() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ensure = () => void ensureRunUpdates().catch(() => {});
    ensure();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') ensure();
    });
    return () => appState.remove();
  }, []);
}
