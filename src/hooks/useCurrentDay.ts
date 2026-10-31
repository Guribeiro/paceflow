import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { keyOfDate } from '../domain/workout-date';

const CHECK_MS = 60_000;

const today = () => keyOfDate(new Date());

/**
 * Dia local atual (AAAA-MM-DD). Muda na virada do dia com o app aberto ou ao
 * voltar para ele, para janelas como "últimos 7 dias" não ficarem velhas.
 */
export function useCurrentDay(): string {
  const [day, setDay] = useState(today);

  useEffect(() => {
    const refresh = () => setDay(today());
    // Checagem curta em vez de um timer até meia-noite: o relógio pode mudar
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

  return day;
}
