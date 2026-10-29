import { preferencesRepository } from '../data/preferences';
import { workoutRepository } from '../data/workouts';
import { buildWeekWidgetProps } from '../domain/widget-snapshot';

type WidgetModule = typeof import('./WeekWidget');

// Import dinâmico: num build sem o módulo nativo o app segue funcionando sem widget.
const loadWidget = (): Promise<WidgetModule> => import('./WeekWidget');

/** Envia ao widget o resumo atual. Falhas são engolidas: o widget é secundário. */
export async function syncWeekWidget(now: Date = new Date(), load: () => Promise<WidgetModule> = loadWidget) {
  try {
    const { default: WeekWidget } = await load();
    WeekWidget.updateSnapshot(buildWeekWidgetProps(workoutRepository.list(), preferencesRepository.getUnit(), now));
  } catch (error) {
    if (__DEV__) console.warn('Widget não atualizado:', error);
  }
}
