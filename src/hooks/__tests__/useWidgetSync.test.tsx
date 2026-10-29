import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { syncWeekWidget } from '../../widgets/sync-week-widget';
import { useWidgetSync } from '../useWidgetSync';

jest.mock('../../widgets/sync-week-widget', () => ({ syncWeekWidget: jest.fn(() => Promise.resolve()) }));
const mockSync = jest.mocked(syncWeekWidget);

const newWorkout = {
  date: new Date().toISOString(),
  distanceMeters: 5000,
  durationSeconds: 1500,
  terrain: 'rua' as const,
};

beforeEach(() => mockSync.mockClear());

describe('useWidgetSync no Android', () => {
  let platform: jest.ReplaceProperty<typeof Platform.OS>;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => platform.restore());

  it('sincroniza ao montar, ao salvar treino e ao trocar a unidade', async () => {
    await renderHook(() => useWidgetSync());
    expect(mockSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      workoutRepository.create(newWorkout);
    });
    expect(mockSync).toHaveBeenCalledTimes(2);

    await act(async () => preferencesRepository.setUnit('mi'));
    expect(mockSync).toHaveBeenCalledTimes(3);
  });

  it('para de sincronizar ao desmontar', async () => {
    const { unmount } = await renderHook(() => useWidgetSync());
    await act(async () => unmount());
    mockSync.mockClear();
    workoutRepository.create(newWorkout);
    expect(mockSync).not.toHaveBeenCalled();
  });
});

describe('useWidgetSync fora do Android', () => {
  it('não faz nada', async () => {
    await renderHook(() => useWidgetSync());
    expect(mockSync).not.toHaveBeenCalled();
  });
});
