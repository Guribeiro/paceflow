import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useCurrentWeek } from '../useCurrentWeek';

// Domingo, 08/11/2026, 23:59:30 (horário local): fim da semana de 02/11.
const SUNDAY_NIGHT = new Date(2026, 10, 8, 23, 59, 30);

let emitAppState: (state: AppStateStatus) => void = () => {};
const removeAppState = jest.fn();

beforeEach(() => {
  jest.useFakeTimers({ now: SUNDAY_NIGHT });
  removeAppState.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    emitAppState = listener as (state: AppStateStatus) => void;
    return { remove: removeAppState };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useCurrentWeek', () => {
  it('devolve a segunda-feira da semana atual', async () => {
    const { result } = await renderHook(() => useCurrentWeek());
    expect(result.current).toBe('2026-11-02');
  });

  it('vira para a segunda seguinte na checagem de 60 s com o app aberto', async () => {
    const { result } = await renderHook(() => useCurrentWeek());
    // 30 s depois já é segunda, mas a checagem só acontece aos 60 s.
    await act(async () => {
      jest.advanceTimersByTime(59_999);
    });
    expect(result.current).toBe('2026-11-02');
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('2026-11-09');
  });

  it('atualiza ao voltar para o app, sem esperar a checagem', async () => {
    const { result } = await renderHook(() => useCurrentWeek());
    // O aparelho dormiu: o relógio andou sem os timers dispararem.
    jest.setSystemTime(new Date(2026, 10, 10, 8));

    await act(async () => emitAppState('background'));
    expect(result.current).toBe('2026-11-02');

    await act(async () => emitAppState('active'));
    expect(result.current).toBe('2026-11-09');
  });

  it('para a checagem e o listener ao desmontar', async () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    const { unmount } = await renderHook(() => useCurrentWeek());
    const checks = setIntervalSpy.mock.calls.filter(([, ms]) => ms === 60_000);
    expect(checks).toHaveLength(1);
    const intervalId = setIntervalSpy.mock.results[setIntervalSpy.mock.calls.indexOf(checks[0])].value;
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    await unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    expect(removeAppState).toHaveBeenCalledTimes(1);
  });
});
