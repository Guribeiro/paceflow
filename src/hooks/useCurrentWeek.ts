import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { keyOfDate } from '../domain/workout-date';
import { startOfWeek } from '../domain/workout-summary';

const CHECK_MS = 60_000;

const currentWeek = () => keyOfDate(startOfWeek(new Date()));

/**
 * Segunda-feira (AAAA-MM-DD) da semana atual. Muda na virada da semana com o
 * app aberto ou ao voltar para ele, para os resumos da semana não ficarem velhos.
 */
export function useCurrentWeek(): string {
  const [week, setWeek] = useState(currentWeek);

  useEffect(() => {
    const refresh = () => setWeek(currentWeek());
    // Checagem curta em vez de um timer até segunda: o relógio pode mudar
    // (fuso, ajuste manual) e timers longos atrasam com o aparelho dormindo.
    const interval = setInterval(refresh, CHECK_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      appState.remove();
    };
  }, []);

  return week;
}
