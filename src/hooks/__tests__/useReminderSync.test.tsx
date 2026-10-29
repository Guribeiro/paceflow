import { act, renderHook } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { reminderPreferences, syncReminders } from '../../data/reminders';
import { workoutRepository } from '../../data/workouts';
import { useReminderSync } from '../useReminderSync';

jest.mock('../../data/reminders', () => ({
  ...jest.requireActual('../../data/reminders'),
  syncReminders: jest.fn(() => Promise.resolve()),
}));
const mockSync = jest.mocked(syncReminders);

beforeEach(() => mockSync.mockClear());

describe('useReminderSync', () => {
  it('reagenda ao montar e a cada mudança de treino, preferência ou lembrete', async () => {
    await renderHook(() => useReminderSync());
    expect(mockSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      workoutRepository.create({ date: new Date().toISOString(), distanceMeters: 5000, durationSeconds: 1500, terrain: 'rua' });
    });
    await act(async () => preferencesRepository.setWeeklyGoal(20_000));
    await act(async () => reminderPreferences.update({ weeklyGoal: true }));
    expect(mockSync).toHaveBeenCalledTimes(4);
  });

  it('para ao desmontar', async () => {
    const { unmount } = await renderHook(() => useReminderSync());
    await act(async () => unmount());
    mockSync.mockClear();
    reminderPreferences.update({ race: true });
    expect(mockSync).not.toHaveBeenCalled();
  });
});
