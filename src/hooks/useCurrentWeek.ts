import { keyOfDate } from '../domain/workout-date';
import { startOfWeek } from '../domain/workout-summary';
import { useCurrentDay } from './useCurrentDay';

/**
 * Segunda-feira (AAAA-MM-DD) da semana atual. Muda na virada da semana com o
 * app aberto ou ao voltar para ele, para os resumos da semana não ficarem velhos.
 */
export function useCurrentWeek(): string {
  const [y, m, d] = useCurrentDay().split('-').map(Number);
  return keyOfDate(startOfWeek(new Date(y, m - 1, d)));
}
