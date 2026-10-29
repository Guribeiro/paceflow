import { useEffect } from 'react';
import { AppState } from 'react-native';

import { hasPendingChanges, isCloudConfigured, subscribeToAccount, syncNow } from '../data/cloud';
import { preferencesRepository } from '../data/preferences';
import { shoeRepository } from '../data/shoes';
import { workoutRepository } from '../data/workouts';

/** Espera após a última alteração local antes de sincronizar (agrupa edições). */
export const AUTO_SYNC_DELAY_MS = 5000;

/**
 * Sincroniza sozinho com a conta conectada: ao entrar, ao voltar para o app e
 * alguns segundos depois de salvar, editar ou excluir. Falhas ficam no
 * SyncState (mostradas em Ajustes); o motor já impede execuções simultâneas.
 */
export function useAutoSync() {
  useEffect(() => {
    if (!isCloudConfigured) return;

    let signedIn = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (signedIn) void syncNow();
    };

    const unsubscribeAccount = subscribeToAccount((email) => {
      const justSignedIn = !signedIn && email !== null;
      signedIn = email !== null;
      if (justSignedIn) run();
    });

    // O repositório também notifica quando o pull aplica dados do servidor;
    // só há o que enviar se a fila tiver pendências (evita sync em loop).
    const scheduleIfPending = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (hasPendingChanges()) run();
      }, AUTO_SYNC_DELAY_MS);
    };
    const unsubscribeRepo = workoutRepository.subscribe(scheduleIfPending);
    const unsubscribeShoes = shoeRepository.subscribe(scheduleIfPending);
    // O tema também notifica, mas não marca pendência: não dispara sync.
    const unsubscribePrefs = preferencesRepository.subscribe(scheduleIfPending);

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });

    return () => {
      clearTimeout(timer);
      unsubscribeAccount();
      unsubscribeRepo();
      unsubscribeShoes();
      unsubscribePrefs();
      appState.remove();
    };
  }, []);
}
