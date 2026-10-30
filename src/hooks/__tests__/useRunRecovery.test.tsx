import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { ensureRunUpdates } from '../../data/run-session';
import { useRunRecovery } from '../useRunRecovery';

jest.mock('../../data/run-session', () => ({ ensureRunUpdates: jest.fn(() => Promise.resolve()) }));
const mockEnsure = jest.mocked(ensureRunUpdates);

let emitAppState: (state: AppStateStatus) => void = () => {};
const removeListener = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    emitAppState = listener as (state: AppStateStatus) => void;
    return { remove: removeListener };
  });
});

describe('useRunRecovery', () => {
  it('confere o GPS da corrida ao abrir o app', async () => {
    await renderHook(() => useRunRecovery());
    expect(mockEnsure).toHaveBeenCalledTimes(1);
  });

  it('confere de novo só quando o app volta a ficar ativo', async () => {
    await renderHook(() => useRunRecovery());
    await act(async () => emitAppState('background'));
    await act(async () => emitAppState('inactive'));
    expect(mockEnsure).toHaveBeenCalledTimes(1);
    await act(async () => emitAppState('active'));
    expect(mockEnsure).toHaveBeenCalledTimes(2);
  });

  it('engole a falha ao religar o GPS', async () => {
    mockEnsure.mockRejectedValueOnce(new Error('sem permissão em segundo plano'));
    await expect(renderHook(() => useRunRecovery())).resolves.toBeDefined();
    // Uma rejeição não tratada derrubaria o teste ao final das microtarefas.
    await act(async () => {});
    expect(mockEnsure).toHaveBeenCalledTimes(1);
  });

  it('para de ouvir o AppState ao desmontar', async () => {
    const { unmount } = await renderHook(() => useRunRecovery());
    await unmount();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
