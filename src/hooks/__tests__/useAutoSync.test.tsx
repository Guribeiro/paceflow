import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import * as cloud from '../../data/cloud';
import { syncState } from '../../data/sync';
import { workoutRepository } from '../../data/workouts';
import { AUTO_SYNC_DELAY_MS, useAutoSync } from '../useAutoSync';

jest.mock('../../data/cloud', () => ({
  isCloudConfigured: true,
  hasPendingChanges: () => jest.requireActual('../../data/sync').syncState.getDirty().length > 0,
  syncNow: jest.fn(() => Promise.resolve({ ok: true })),
  subscribeToAccount: jest.fn(),
}));
const mocked = jest.mocked(cloud);

let emitAccount: (email: string | null) => void = () => {};
let emitAppState: (state: AppStateStatus) => void = () => {};

const newWorkout = {
  date: new Date().toISOString(),
  distanceMeters: 5000,
  durationSeconds: 1500,
  terrain: 'rua' as const,
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  syncState.reset();
  mocked.subscribeToAccount.mockImplementation((listener) => {
    emitAccount = listener;
    return () => {};
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    emitAppState = listener as (state: AppStateStatus) => void;
    return { remove: () => {} };
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAutoSync', () => {
  it('sincroniza ao entrar na conta, uma vez', async () => {
    await renderHook(() => useAutoSync());
    await act(async () => emitAccount('a@b.co'));
    await act(async () => emitAccount('a@b.co')); // INITIAL_SESSION + getSession
    expect(mocked.syncNow).toHaveBeenCalledTimes(1);
  });

  it('não faz nada sem conta', async () => {
    await renderHook(() => useAutoSync());
    await act(async () => emitAccount(null));
    await act(async () => emitAppState('active'));
    expect(mocked.syncNow).not.toHaveBeenCalled();
  });

  it('sincroniza ao voltar para o app', async () => {
    await renderHook(() => useAutoSync());
    await act(async () => emitAccount('a@b.co'));
    mocked.syncNow.mockClear();
    await act(async () => emitAppState('active'));
    expect(mocked.syncNow).toHaveBeenCalledTimes(1);
  });

  it('agrupa alterações locais e sincroniza depois do intervalo', async () => {
    await renderHook(() => useAutoSync());
    await act(async () => emitAccount('a@b.co'));
    mocked.syncNow.mockClear();

    await act(async () => {
      workoutRepository.create(newWorkout);
      jest.advanceTimersByTime(AUTO_SYNC_DELAY_MS - 1000);
      workoutRepository.create(newWorkout);
      jest.advanceTimersByTime(AUTO_SYNC_DELAY_MS - 1000);
    });
    expect(mocked.syncNow).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(1000));
    expect(mocked.syncNow).toHaveBeenCalledTimes(1);
  });

  it('não sincroniza por mudanças vindas do servidor (fila vazia)', async () => {
    await renderHook(() => useAutoSync());
    await act(async () => emitAccount('a@b.co'));
    mocked.syncNow.mockClear();

    await act(async () => {
      workoutRepository.importWorkouts(
        [
          {
            ...newWorkout,
            id: 'remote-1',
            createdAt: '2026-10-29T10:00:00.000Z',
            updatedAt: '2026-10-29T10:00:00.000Z',
            deletedAt: null,
          },
        ],
        { origin: 'remote' },
      );
      jest.advanceTimersByTime(AUTO_SYNC_DELAY_MS);
    });
    expect(mocked.syncNow).not.toHaveBeenCalled();
  });
});
