import { act, renderHook } from '@testing-library/react-native';

import { runRepository } from '../../data/run-session';
import { finishRun, pauseRun, startRun } from '../../domain/run-tracker';
import { useRunSession } from '../useRunSession';

const T0 = new Date(2026, 10, 4, 10).getTime();

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  runRepository.set(null);
});

afterEach(() => {
  jest.useRealTimers();
  runRepository.set(null);
});

describe('useRunSession', () => {
  it('sem corrida, devolve null', async () => {
    const { result } = await renderHook(() => useRunSession());
    expect(result.current).toEqual({ run: null, now: T0 });
  });

  it('acompanha a corrida salva no repositório', async () => {
    const { result } = await renderHook(() => useRunSession());
    const run = startRun(T0);
    await act(async () => runRepository.set(run));
    expect(result.current.run).toEqual(run);
  });

  it('o relógio avança a cada segundo durante a corrida', async () => {
    runRepository.set(startRun(T0));
    const { result } = await renderHook(() => useRunSession());
    await act(async () => jest.advanceTimersByTime(3000));
    expect(result.current.now).toBe(T0 + 3000);
  });

  it.each([
    ['pausada', pauseRun(startRun(T0), T0)],
    ['finalizada', finishRun(startRun(T0), T0)],
  ])('o relógio fica parado com a corrida %s', async (_name, run) => {
    runRepository.set(run);
    const { result } = await renderHook(() => useRunSession());
    await act(async () => jest.advanceTimersByTime(3000));
    expect(result.current.now).toBe(T0);
  });

  it('para o relógio ao pausar', async () => {
    runRepository.set(startRun(T0));
    const { result } = await renderHook(() => useRunSession());
    await act(async () => jest.advanceTimersByTime(2000));
    await act(async () => runRepository.set(pauseRun(runRepository.get()!, Date.now())));
    await act(async () => jest.advanceTimersByTime(5000));
    expect(result.current.now).toBe(T0 + 2000);
  });
});
