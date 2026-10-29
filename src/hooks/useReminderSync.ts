import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { preferencesRepository } from '../data/preferences';
import { reminderPreferences, syncReminders } from '../data/reminders';
import { workoutRepository } from '../data/workouts';

/**
 * Mantém os lembretes agendados em dia: ao abrir o app, ao voltar para ele (os
 * lembretes de treino cobrem só as próximas duas semanas) e a cada mudança nos
 * treinos, na meta, na prova ou nos próprios lembretes.
 */
export function useReminderSync() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sync = () => void syncReminders().catch(() => {});
    sync();

    const unsubscribers = [
      workoutRepository.subscribe(sync),
      preferencesRepository.subscribe(sync),
      reminderPreferences.subscribe(sync),
    ];
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      appState.remove();
    };
  }, []);
}
