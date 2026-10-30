import type { KeyValueStorage } from '../storage/key-value';

/** Liga/desliga guardado no aparelho (fora do sync). */
export interface FlagRepository {
  get(): boolean;
  set(value: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createFlagRepository(storage: KeyValueStorage, key: string, defaultValue: boolean): FlagRepository {
  const listeners = new Set<() => void>();

  return {
    get() {
      const raw = storage.getString(key);
      return raw === 'true' ? true : raw === 'false' ? false : defaultValue;
    },

    set(value) {
      storage.set(key, String(value));
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
