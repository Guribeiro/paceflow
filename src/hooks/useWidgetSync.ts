import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { preferencesRepository } from '../data/preferences';
import { workoutRepository } from '../data/workouts';
import { syncWeekWidget } from '../widgets/sync-week-widget';

/**
 * Mantém o widget "Semana" atualizado: ao abrir o app, ao voltar para ele (cobre
 * a virada de semana, já que o Android não tem timeline de widget) e a cada
 * mudança nos treinos ou na unidade.
 */
export function useWidgetSync() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const sync = () => void syncWeekWidget();
    sync();

    const unsubscribeWorkouts = workoutRepository.subscribe(sync);
    const unsubscribePrefs = preferencesRepository.subscribe(sync);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => {
      unsubscribeWorkouts();
      unsubscribePrefs();
      appState.remove();
    };
  }, []);
}
