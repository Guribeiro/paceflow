import { type RunState, parseRunState } from '../../domain/run-tracker';
import type { KeyValueStorage } from '../storage/key-value';

// Corrida em andamento (ou finalizada e ainda não salva). Sobrevive a fechar o app.
const KEY = 'run:v1';

export interface RunRepository {
  /** Referência estável até mudar (para useSyncExternalStore). */
  get(): RunState | null;
  set(state: RunState | null): void;
  subscribe(listener: () => void): () => void;
}

export function createRunRepository(storage: KeyValueStorage): RunRepository {
  const listeners = new Set<() => void>();
  let cache: { raw: string | undefined; value: RunState | null } | null = null;

  return {
    get() {
      const raw = storage.getString(KEY);
      if (cache && cache.raw === raw) return cache.value;
      let value: RunState | null = null;
      try {
        value = raw === undefined ? null : parseRunState(JSON.parse(raw));
      } catch {
        value = null;
      }
      cache = { raw, value };
      return value;
    },

    set(state) {
      if (state === null) storage.remove(KEY);
      else storage.set(KEY, JSON.stringify(state));
      listeners.forEach((listener) => listener());
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
