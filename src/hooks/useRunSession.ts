import { useEffect, useState, useSyncExternalStore } from 'react';

import { runRepository } from '../data/run-session';
import type { RunState } from '../domain/run-tracker';

/** Corrida atual e um relógio que avança a cada segundo enquanto ela está em andamento. */
export function useRunSession(): { run: RunState | null; now: number } {
  const run = useSyncExternalStore(runRepository.subscribe, runRepository.get);
  const [now, setNow] = useState(Date.now);
  const running = run?.status === 'running';

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  return { run, now };
}
