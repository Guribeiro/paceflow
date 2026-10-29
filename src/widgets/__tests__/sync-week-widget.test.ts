import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { syncWeekWidget } from '../sync-week-widget';

// O Jest não executa import() dinâmico sem flag experimental; o teste injeta o módulo.
const updateSnapshot = jest.fn();
const load = async () => ({ default: { updateSnapshot } }) as never;

describe('syncWeekWidget', () => {
  beforeEach(() => updateSnapshot.mockReset());

  it('envia o resumo da semana na unidade preferida', async () => {
    workoutRepository.create({
      date: new Date(2026, 9, 28, 7).toISOString(),
      distanceMeters: 10000,
      durationSeconds: 3000,
      terrain: 'pista',
    });
    preferencesRepository.setUnit('km');

    await syncWeekWidget(new Date(2026, 9, 29, 12), load);

    expect(updateSnapshot).toHaveBeenCalledWith({
      weekLabel: 'Semana de 26/10',
      distance: '10,00',
      unit: 'km',
      count: '1 treino',
      lastPace: '5:00/km',
      goal: null,
      goalRatio: null,
    });
  });

  it('não lança erro se o módulo do widget falhar', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = () => Promise.reject(new Error('módulo nativo ausente'));
    await expect(syncWeekWidget(new Date(), failing)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
